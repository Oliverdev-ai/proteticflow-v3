import { and, eq, gte, ilike, inArray, isNull, lte, not, sql } from 'drizzle-orm';
import {
  agendaTodaySchema,
  type AgendaTodayInput,
} from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { events } from '../../../db/schema/agenda.js';
import { clients } from '../../../db/schema/clients.js';
import { deliveryItems, deliverySchedules } from '../../../db/schema/deliveries.js';
import { employees } from '../../../db/schema/employees.js';
import { jobs } from '../../../db/schema/jobs.js';
import type { ToolContext } from '../tool-executor.js';
import { resolvePeriod } from '../resolvers.js';

async function resolveCurrentEmployee(tenantId: number, userId: number) {
  const [employee] = await db
    .select({
      id: employees.id,
      name: employees.name,
    })
    .from(employees)
    .where(and(
      eq(employees.tenantId, tenantId),
      eq(employees.userId, userId),
      isNull(employees.deletedAt),
      eq(employees.isActive, true),
    ))
    .limit(1);

  return employee ?? null;
}

export async function executeAgendaToday(
  ctx: ToolContext,
  input: AgendaTodayInput,
) {
  const parsed = agendaTodaySchema.parse(input);
  const period = resolvePeriod('today');
  const currentEmployee = await resolveCurrentEmployee(ctx.tenantId, ctx.userId);
  const canSeeAll = ctx.role === 'superadmin' || ctx.role === 'gerente';
  const normalizedScope = parsed.scope === 'all' && canSeeAll ? 'all' : 'own';

  const employeeId = parsed.userId ?? currentEmployee?.id;
  const ownEmployeeName = currentEmployee?.name ?? null;

  const jobsConditions = [
    eq(jobs.tenantId, ctx.tenantId),
    isNull(jobs.deletedAt),
    gte(jobs.deadline, new Date(period.startDate)),
    lte(jobs.deadline, new Date(period.endDate)),
    isNull(jobs.suspendedAt),
    not(inArray(jobs.status, ['delivered', 'cancelled', 'suspended', 'rework_in_progress'])),
  ];

  if (normalizedScope === 'own' && employeeId) {
    jobsConditions.push(eq(jobs.assignedTo, employeeId));
  }

  const jobsToday = await db
    .select({
      id: jobs.id,
      code: jobs.code,
      status: jobs.status,
      deadline: jobs.deadline,
      clientName: clients.name,
    })
    .from(jobs)
    .leftJoin(clients, and(
      eq(clients.id, jobs.clientId),
      eq(clients.tenantId, ctx.tenantId),
    ))
    .where(and(...jobsConditions))
    .orderBy(jobs.deadline, jobs.id);

  const deliveryConditions = [
    eq(deliverySchedules.tenantId, ctx.tenantId),
    gte(deliverySchedules.date, new Date(period.startDate)),
    lte(deliverySchedules.date, new Date(period.endDate)),
  ];

  if (normalizedScope === 'own' && ownEmployeeName) {
    deliveryConditions.push(ilike(deliverySchedules.driverName, `%${ownEmployeeName}%`));
  }

  const deliveriesToday = await db
    .select({
      scheduleId: deliverySchedules.id,
      scheduleDate: deliverySchedules.date,
      driverName: deliverySchedules.driverName,
      itemId: deliveryItems.id,
      status: deliveryItems.status,
      jobId: deliveryItems.jobId,
      jobCode: jobs.code,
      clientName: clients.name,
    })
    .from(deliverySchedules)
    .innerJoin(deliveryItems, and(
      eq(deliveryItems.scheduleId, deliverySchedules.id),
      eq(deliveryItems.tenantId, ctx.tenantId),
    ))
    .leftJoin(jobs, and(
      eq(jobs.id, deliveryItems.jobId),
      eq(jobs.tenantId, ctx.tenantId),
    ))
    .leftJoin(clients, and(
      eq(clients.id, deliveryItems.clientId),
      eq(clients.tenantId, ctx.tenantId),
    ))
    .where(and(...deliveryConditions))
    .orderBy(deliverySchedules.date, deliveryItems.sortOrder, deliveryItems.id);

  const eventConditions = [
    eq(events.tenantId, ctx.tenantId),
    gte(events.startAt, new Date(period.startDate)),
    lte(events.startAt, new Date(period.endDate)),
  ];

  if (normalizedScope === 'own') {
    if (employeeId) {
      eventConditions.push(sql`(${events.employeeId} = ${employeeId} OR ${events.createdBy} = ${ctx.userId})`);
    } else {
      eventConditions.push(eq(events.createdBy, ctx.userId));
    }
  }

  const agendaEvents = await db
    .select({
      id: events.id,
      title: events.title,
      type: events.type,
      startAt: events.startAt,
      endAt: events.endAt,
      allDay: events.allDay,
      isCompleted: events.isCompleted,
      isCancelled: events.isCancelled,
    })
    .from(events)
    .where(and(...eventConditions))
    .orderBy(events.startAt, events.id);

  const summary = {
    jobsDueToday: jobsToday.length,
    deliveriesToday: deliveriesToday.length,
    eventsToday: agendaEvents.length,
  };

  if (summary.jobsDueToday === 0 && summary.deliveriesToday === 0 && summary.eventsToday === 0) {
    return {
      status: 'ok',
      scope: normalizedScope,
      period,
      summary,
      message: 'Agenda vazia hoje. Aproveita.',
      jobs: [],
      deliveries: [],
      events: [],
    };
  }

  return {
    status: 'ok',
    scope: normalizedScope,
    period,
    summary,
    jobs: jobsToday.map((job) => ({
      id: job.id,
      code: job.code,
      status: job.status,
      deadline: job.deadline.toISOString(),
      clientName: job.clientName ?? null,
    })),
    deliveries: deliveriesToday.map((delivery) => ({
      scheduleId: delivery.scheduleId,
      scheduleDate: delivery.scheduleDate.toISOString(),
      driverName: delivery.driverName ?? null,
      itemId: delivery.itemId,
      status: delivery.status,
      jobId: delivery.jobId ?? null,
      jobCode: delivery.jobCode ?? null,
      clientName: delivery.clientName ?? null,
    })),
    events: agendaEvents.map((event) => ({
      id: event.id,
      title: event.title,
      type: event.type,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt.toISOString(),
      allDay: event.allDay,
      isCompleted: event.isCompleted,
      isCancelled: event.isCancelled,
    })),
  };
}
