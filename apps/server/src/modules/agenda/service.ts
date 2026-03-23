import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../../db/index.js';
import { events } from '../../db/schema/agenda.js';
import { jobs } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { employees } from '../../db/schema/employees.js';
import { logger } from '../../logger.js';
import type {
  createEventSchema,
  listEventsSchema,
  moveEventSchema,
  updateEventSchema,
} from '@proteticflow/shared';
import type { z } from 'zod';

type CreateEventInput = z.infer<typeof createEventSchema>;
type UpdateEventInput = z.infer<typeof updateEventSchema>;
type ListEventsInput = z.infer<typeof listEventsSchema>;
type MoveEventInput = z.infer<typeof moveEventSchema>;

type Recurrence = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

type WeekView = {
  days: Array<{ date: string; events: Array<typeof events.$inferSelect> }>;
};

type MonthView = {
  days: Array<{ date: string; events: Array<typeof events.$inferSelect> }>;
};

function recurrenceDays(recurrence: Recurrence): number {
  if (recurrence === 'daily') return 1;
  if (recurrence === 'weekly') return 7;
  if (recurrence === 'biweekly') return 14;
  if (recurrence === 'monthly') return 30;
  return 0;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addRecurrence(date: Date, recurrence: Recurrence): Date {
  if (recurrence === 'monthly') {
    const next = new Date(date);
    next.setMonth(next.getMonth() + 1);
    return next;
  }
  return addDays(date, recurrenceDays(recurrence));
}

async function getEventOwnedByTenant(tenantId: number, eventId: number) {
  const [event] = await db.select().from(events).where(and(eq(events.tenantId, tenantId), eq(events.id, eventId)));
  if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Evento nao encontrado' });
  return event;
}

async function createRecurrenceInstances(
  tenantId: number,
  parentEvent: typeof events.$inferSelect,
  recurrence: Recurrence,
  recurrenceEndDate?: Date,
) {
  if (recurrence === 'none') return;

  const limitDate = recurrenceEndDate ?? addDays(parentEvent.startAt, 90);
  const durationMs = parentEvent.endAt.getTime() - parentEvent.startAt.getTime();
  const instances: Array<typeof events.$inferInsert> = [];

  let nextStart = addRecurrence(parentEvent.startAt, recurrence);
  while (nextStart <= limitDate) {
    const nextEnd = new Date(nextStart.getTime() + durationMs);
    instances.push({
      tenantId,
      title: parentEvent.title,
      description: parentEvent.description,
      type: parentEvent.type,
      startAt: nextStart,
      endAt: nextEnd,
      allDay: parentEvent.allDay,
      jobId: parentEvent.jobId,
      clientId: parentEvent.clientId,
      employeeId: parentEvent.employeeId,
      recurrence: parentEvent.recurrence,
      recurrenceEndDate: parentEvent.recurrenceEndDate,
      parentEventId: parentEvent.id,
      reminderMinutesBefore: parentEvent.reminderMinutesBefore,
      reminderSent: false,
      isCompleted: false,
      isCancelled: false,
      color: parentEvent.color,
      createdBy: parentEvent.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    nextStart = addRecurrence(nextStart, recurrence);
  }

  if (instances.length > 0) await db.insert(events).values(instances);
}

async function regenerateFutureInstances(tenantId: number, parentEvent: typeof events.$inferSelect) {
  await db.delete(events).where(and(eq(events.tenantId, tenantId), eq(events.parentEventId, parentEvent.id)));
  await createRecurrenceInstances(
    tenantId,
    parentEvent,
    parentEvent.recurrence,
    parentEvent.recurrenceEndDate ?? undefined,
  );
}

export async function createEvent(tenantId: number, input: CreateEventInput, userId: number) {
  const [event] = await db.insert(events).values({
    tenantId,
    title: input.title,
    description: input.description,
    type: input.type,
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
    allDay: input.allDay,
    jobId: input.jobId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    recurrence: input.recurrence,
    recurrenceEndDate: input.recurrenceEndDate ? new Date(input.recurrenceEndDate) : undefined,
    reminderMinutesBefore: input.reminderMinutesBefore,
    color: input.color,
    createdBy: userId,
  }).returning();

  if (!event) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar evento' });

  if (event.recurrence !== 'none') {
    await createRecurrenceInstances(
      tenantId,
      event,
      event.recurrence,
      event.recurrenceEndDate ?? undefined,
    );
  }

  logger.info({
    action: 'agenda.event.create',
    tenantId,
    eventId: event.id,
    type: event.type,
    recurrence: event.recurrence,
  }, 'Evento de agenda criado');

  return event;
}

export async function listEvents(tenantId: number, filters: ListEventsInput) {
  const conditions = [
    eq(events.tenantId, tenantId),
    gte(events.startAt, new Date(filters.dateFrom)),
    lte(events.startAt, new Date(filters.dateTo)),
  ];
  if (filters.type) conditions.push(eq(events.type, filters.type));
  if (filters.employeeId) conditions.push(eq(events.employeeId, filters.employeeId));
  if (filters.clientId) conditions.push(eq(events.clientId, filters.clientId));
  if (filters.jobId) conditions.push(eq(events.jobId, filters.jobId));

  return db.select({
    event: events,
    clientName: clients.name,
    employeeName: employees.name,
    jobCode: jobs.code,
  }).from(events)
    .leftJoin(clients, eq(events.clientId, clients.id))
    .leftJoin(employees, eq(events.employeeId, employees.id))
    .leftJoin(jobs, eq(events.jobId, jobs.id))
    .where(and(...conditions));
}

export async function getEvent(tenantId: number, eventId: number) {
  const [event] = await db.select().from(events).where(and(eq(events.tenantId, tenantId), eq(events.id, eventId)));
  if (!event) throw new TRPCError({ code: 'NOT_FOUND', message: 'Evento nao encontrado' });
  return event;
}

export async function updateEvent(tenantId: number, eventId: number, input: UpdateEventInput, userId: number) {
  const existing = await getEventOwnedByTenant(tenantId, eventId);
  const recurrenceNext = (input.recurrence ?? existing.recurrence) as Recurrence;
  const recurrenceChanged = input.recurrence !== undefined && input.recurrence !== existing.recurrence;
  const isParent = existing.parentEventId === null;

  const [updated] = await db.update(events).set({
    title: input.title,
    description: input.description,
    type: input.type,
    startAt: input.startAt ? new Date(input.startAt) : undefined,
    endAt: input.endAt ? new Date(input.endAt) : undefined,
    allDay: input.allDay,
    jobId: input.jobId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    recurrence: input.recurrence,
    recurrenceEndDate: input.recurrenceEndDate ? new Date(input.recurrenceEndDate) : undefined,
    reminderMinutesBefore: input.reminderMinutesBefore,
    color: input.color,
    updatedAt: new Date(),
  }).where(and(eq(events.id, eventId), eq(events.tenantId, tenantId))).returning();

  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Evento nao encontrado' });

  if (isParent && (recurrenceChanged || recurrenceNext !== 'none')) {
    await regenerateFutureInstances(tenantId, updated);
  }

  logger.info({ action: 'agenda.event.update', tenantId, eventId, userId }, 'Evento de agenda atualizado');
  return updated;
}

export async function moveEvent(tenantId: number, input: MoveEventInput, userId: number) {
  const existing = await getEventOwnedByTenant(tenantId, input.eventId);
  const oldDurationMs = existing.endAt.getTime() - existing.startAt.getTime();
  const newStart = new Date(input.startAt);
  const newEnd = new Date(newStart.getTime() + oldDurationMs);

  const [updated] = await db.update(events)
    .set({ startAt: newStart, endAt: newEnd, updatedAt: new Date() })
    .where(and(eq(events.id, input.eventId), eq(events.tenantId, tenantId)))
    .returning();

  logger.info({
    action: 'agenda.event.move',
    tenantId,
    eventId: input.eventId,
    newStart: newStart.toISOString(),
    userId,
  }, 'Evento movido no calendario');

  return updated!;
}

export async function deleteEvent(tenantId: number, eventId: number, userId: number) {
  const existing = await getEventOwnedByTenant(tenantId, eventId);

  if (existing.parentEventId === null) {
    await db.delete(events).where(and(eq(events.tenantId, tenantId), eq(events.parentEventId, eventId)));
  }
  await db.delete(events).where(and(eq(events.tenantId, tenantId), eq(events.id, eventId)));

  logger.info({ action: 'agenda.event.delete', tenantId, eventId, userId }, 'Evento removido');
}

export async function completeEvent(tenantId: number, eventId: number, userId: number) {
  await getEventOwnedByTenant(tenantId, eventId);
  const [updated] = await db.update(events)
    .set({ isCompleted: true, updatedAt: new Date() })
    .where(and(eq(events.tenantId, tenantId), eq(events.id, eventId)))
    .returning();

  logger.info({ action: 'agenda.event.complete', tenantId, eventId, userId }, 'Evento marcado como concluido');
  return updated!;
}

export async function cancelEvent(tenantId: number, eventId: number, userId: number) {
  await getEventOwnedByTenant(tenantId, eventId);
  const [updated] = await db.update(events)
    .set({ isCancelled: true, updatedAt: new Date() })
    .where(and(eq(events.tenantId, tenantId), eq(events.id, eventId)))
    .returning();

  logger.info({ action: 'agenda.event.cancel', tenantId, eventId, userId }, 'Evento cancelado');
  return updated!;
}

export async function getWeekView(tenantId: number, weekStart: Date): Promise<WeekView> {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 7);
  end.setMilliseconds(-1);

  const all = await db.select().from(events).where(and(
    eq(events.tenantId, tenantId),
    gte(events.startAt, start),
    lte(events.startAt, end),
  ));

  const map = new Map<string, Array<typeof events.$inferSelect>>();
  for (let i = 0; i < 7; i++) {
    map.set(dateKey(addDays(start, i)), []);
  }
  for (const event of all) {
    const key = dateKey(event.startAt);
    const group = map.get(key);
    if (group) group.push(event);
  }

  return {
    days: [...map.entries()].map(([date, grouped]) => ({ date, events: grouped })),
  };
}

export async function getMonthView(tenantId: number, year: number, month: number): Promise<MonthView> {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const all = await db.select().from(events).where(and(
    eq(events.tenantId, tenantId),
    gte(events.startAt, start),
    lte(events.startAt, end),
  ));

  const map = new Map<string, Array<typeof events.$inferSelect>>();
  const daysInMonth = end.getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    map.set(dateKey(new Date(Date.UTC(year, month - 1, day))), []);
  }
  for (const event of all) {
    const key = dateKey(event.startAt);
    const group = map.get(key);
    if (group) group.push(event);
  }

  return {
    days: [...map.entries()].map(([date, grouped]) => ({ date, events: grouped })),
  };
}

export async function getEmployeeAgenda(tenantId: number, employeeId: number, dateFrom: Date, dateTo: Date) {
  return db.select().from(events).where(and(
    eq(events.tenantId, tenantId),
    eq(events.employeeId, employeeId),
    gte(events.startAt, dateFrom),
    lte(events.startAt, dateTo),
  ));
}

export async function listPendingReminders(now: Date) {
  const allEvents = await db.select().from(events).where(and(
    eq(events.reminderSent, false),
    eq(events.isCancelled, false),
    gte(events.startAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
  ));

  return allEvents.filter((event) => {
    const triggerAt = new Date(event.startAt.getTime() - (event.reminderMinutesBefore ?? 60) * 60 * 1000);
    return triggerAt <= now;
  });
}

export async function markReminderSent(eventId: number) {
  await db.update(events).set({ reminderSent: true, updatedAt: new Date() }).where(eq(events.id, eventId));
}

export const __testOnly = {
  addRecurrence,
  addDays,
  recurrenceDays,
};

