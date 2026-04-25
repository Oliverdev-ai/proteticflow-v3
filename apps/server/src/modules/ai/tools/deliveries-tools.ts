import { and, desc, eq, gte, inArray, ilike, lte, sql } from 'drizzle-orm';
import {
  deliveriesRouteByDaySchema,
  type DeliveriesRouteByDayInput,
} from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { deliveryItems, deliverySchedules } from '../../../db/schema/deliveries.js';
import { clients } from '../../../db/schema/clients.js';
import { jobs } from '../../../db/schema/jobs.js';
import type { ToolContext } from '../tool-executor.js';
import { resolveDeliveryPerson } from '../resolvers.js';

function normalizeDate(raw?: string): Date {
  if (!raw || raw === 'hoje') return new Date();
  if (raw === 'amanha' || raw === 'amanhã') {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return next;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function dayRange(base: Date): { start: Date; end: Date } {
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function executeDeliveriesRouteByDay(
  ctx: ToolContext,
  input: DeliveriesRouteByDayInput,
) {
  const parsed = deliveriesRouteByDaySchema.parse(input);
  const targetDate = normalizeDate(parsed.date);
  const range = dayRange(targetDate);

  let driverName: string | null = null;
  if (parsed.deliveryPersonName) {
    const resolved = await resolveDeliveryPerson(ctx.tenantId, parsed.deliveryPersonName);
    if (resolved.status === 'not_found') {
      return {
        status: 'not_found',
        message: `Nenhum entregador encontrado para "${resolved.searchTerm}"`,
      };
    }
    if (resolved.status === 'ambiguous') {
      return {
        status: 'ambiguous',
        message: 'Encontrei mais de um entregador com esse nome.',
        candidates: resolved.candidates,
      };
    }
    driverName = resolved.driverName;
  }

  const scheduleConditions = [
    eq(deliverySchedules.tenantId, ctx.tenantId),
    gte(deliverySchedules.date, range.start),
    lte(deliverySchedules.date, range.end),
  ];

  if (driverName) {
    scheduleConditions.push(ilike(deliverySchedules.driverName, `%${driverName}%`));
  }

  const schedules = await db
    .select({
      id: deliverySchedules.id,
      date: deliverySchedules.date,
      driverName: deliverySchedules.driverName,
      vehicle: deliverySchedules.vehicle,
    })
    .from(deliverySchedules)
    .where(and(...scheduleConditions))
    .orderBy(desc(deliverySchedules.date), desc(deliverySchedules.id));

  if (schedules.length === 0) {
    return {
      status: 'ok',
      date: range.start.toISOString(),
      totalStops: 0,
      message: 'Nenhuma entrega agendada para a data informada.',
      routes: [],
    };
  }

  const scheduleIds = schedules.map((row) => row.id);
  const items = await db
    .select({
      scheduleId: deliveryItems.scheduleId,
      stopOrder: deliveryItems.sortOrder,
      stopStatus: deliveryItems.status,
      jobId: deliveryItems.jobId,
      jobCode: jobs.code,
      clientId: deliveryItems.clientId,
      clientName: clients.name,
      phone: clients.phone,
      neighborhood: clients.neighborhood,
      city: clients.city,
      state: clients.state,
      address: sql<string>`coalesce(${deliveryItems.deliveryAddress}, ${clients.street})`,
    })
    .from(deliveryItems)
    .leftJoin(clients, and(
      eq(clients.id, deliveryItems.clientId),
      eq(clients.tenantId, ctx.tenantId),
    ))
    .leftJoin(jobs, and(
      eq(jobs.id, deliveryItems.jobId),
      eq(jobs.tenantId, ctx.tenantId),
    ))
    .where(and(
      eq(deliveryItems.tenantId, ctx.tenantId),
      inArray(deliveryItems.scheduleId, scheduleIds),
    ))
    .orderBy(deliveryItems.scheduleId, deliveryItems.sortOrder, deliveryItems.id);

  const routes = items.map((item, index) => {
    const schedule = schedules.find((row) => row.id === item.scheduleId);
    return {
      sequence: index + 1,
      scheduleId: item.scheduleId,
      scheduledDate: schedule?.date.toISOString() ?? range.start.toISOString(),
      driverName: schedule?.driverName ?? null,
      vehicle: schedule?.vehicle ?? null,
      clientId: item.clientId,
      clientName: item.clientName ?? 'Cliente sem nome',
      phone: item.phone ?? null,
      address: item.address ?? null,
      neighborhood: item.neighborhood ?? null,
      city: item.city ?? null,
      state: item.state ?? null,
      jobId: item.jobId ?? null,
      jobCode: item.jobCode ?? null,
      status: item.stopStatus,
      stopOrder: item.stopOrder,
    };
  });

  return {
    status: 'ok',
    date: range.start.toISOString(),
    totalSchedules: schedules.length,
    totalStops: routes.length,
    routes,
  };
}
