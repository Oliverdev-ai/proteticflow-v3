import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { tenants, tenantMembers } from '../../db/schema/tenants.js';
import { events } from '../../db/schema/agenda.js';
import { scans } from '../../db/schema/scans.js';
import { notifications } from '../../db/schema/notifications.js';
import { clients, priceItems, pricingTables } from '../../db/schema/clients.js';
import { jobs, jobItems, jobLogs, orderCounters } from '../../db/schema/jobs.js';
import { employees } from '../../db/schema/employees.js';
import { payrollEntries, payrollPeriods, commissionPayments, employeeSkills, jobAssignments } from '../../db/schema/employees.js';
import { osBlocks } from '../../db/schema/os-blocks.js';
import { hashPassword } from '../../core/auth.js';
import { eq, sql } from 'drizzle-orm';
import * as jobService from '../jobs/service.js';
import * as agendaService from './service.js';
import { eventReminders } from '../../cron/event-reminders.js';

async function createTestUser(email: string) {
  const [u] = await db.insert(users).values({
    name: 'Test User',
    email,
    passwordHash: await hashPassword('Test123!'),
    role: 'user',
  }).returning();
  return u!;
}

async function createTestTenant(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function createTestClient(tenantId: number, userId: number, name: string) {
  const { createClient } = await import('../clients/service.js');
  const client = await createClient(tenantId, { name, priceAdjustmentPercent: 0 }, userId);
  if (!client) throw new Error('Falha ao criar cliente de teste');
  return client;
}

async function createTestJob(tenantId: number, clientId: number, userId: number) {
  const job = await jobService.createJob(tenantId, {
    clientId,
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    items: [{ serviceNameSnapshot: 'Coroa', quantity: 1, unitPriceCents: 10000, adjustmentPercent: 0 }],
  }, userId);
  if (!job) throw new Error('Falha ao criar job de teste');
  return job;
}

async function createTestEmployee(tenantId: number, userId: number, name: string) {
  const [employee] = await db.insert(employees).values({
    tenantId,
    name,
    type: 'auxiliar',
    contractType: 'clt',
    createdBy: userId,
  }).returning();
  return employee!;
}

async function cleanup() {
  await db.delete(notifications);
  await db.delete(events);
  await db.delete(scans);
  await db.delete(jobAssignments);
  await db.delete(employeeSkills);
  await db.delete(commissionPayments);
  await db.delete(payrollEntries);
  await db.delete(payrollPeriods);
  await db.delete(employees);
  await db.delete(jobLogs);
  await db.delete(jobItems);
  await db.delete(jobs);
  await db.delete(orderCounters);
  await db.delete(priceItems);
  await db.delete(pricingTables);
  await db.delete(osBlocks);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  try {
    await db.delete(tenants);
  } catch {
    await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
    await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
    await db.delete(tenants);
  }
  await db.delete(users);
}

describe('Agenda Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. Criar evento com todos os campos', async () => {
    const user = await createTestUser('agenda1@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 1');
    const client = await createTestClient(tenant.id, user.id, 'Cliente Agenda');
    const job = await createTestJob(tenant.id, client.id, user.id);
    const employee = await createTestEmployee(tenant.id, user.id, 'Joao');
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const event = await agendaService.createEvent(tenant.id, {
      title: 'Prova do paciente',
      description: 'Evento completo',
      type: 'prova',
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allDay: false,
      jobId: job.id,
      clientId: client.id,
      employeeId: employee.id,
      recurrence: 'none',
      reminderMinutesBefore: 30,
      color: '#f59e0b',
    }, user.id);

    expect(event.title).toBe('Prova do paciente');
    expect(event.jobId).toBe(job.id);
    expect(event.clientId).toBe(client.id);
    expect(event.employeeId).toBe(employee.id);
  });

  it('2. Criar evento recorrente semanal - gera instancias', async () => {
    const user = await createTestUser('agenda2@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 2');
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const parent = await agendaService.createEvent(tenant.id, {
      title: 'Reuniao semanal',
      type: 'reuniao',
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allDay: false,
      recurrence: 'weekly',
      recurrenceEndDate: new Date(start.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      reminderMinutesBefore: 60,
    }, user.id);

    const list = await agendaService.listEvents(tenant.id, {
      dateFrom: start.toISOString(),
      dateTo: new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(parent.parentEventId).toBeNull();
    expect(list.length).toBeGreaterThan(1);
  });

  it('3. Listar eventos por periodo', async () => {
    const user = await createTestUser('agenda3@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 3');
    const now = new Date();
    const inside = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const outside = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    await agendaService.createEvent(tenant.id, {
      title: 'No periodo',
      type: 'outro',
      startAt: inside.toISOString(),
      endAt: new Date(inside.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);
    await agendaService.createEvent(tenant.id, {
      title: 'Fora do periodo',
      type: 'outro',
      startAt: outside.toISOString(),
      endAt: new Date(outside.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);

    const list = await agendaService.listEvents(tenant.id, {
      dateFrom: now.toISOString(),
      dateTo: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(list.length).toBe(1);
  });

  it('4. Listar filtrado por type', async () => {
    const user = await createTestUser('agenda4@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 4');
    const start = new Date(Date.now() + 60 * 60 * 1000);

    await agendaService.createEvent(tenant.id, {
      title: 'Entrega',
      type: 'entrega',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);
    await agendaService.createEvent(tenant.id, {
      title: 'Reuniao',
      type: 'reuniao',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);

    const list = await agendaService.listEvents(tenant.id, {
      dateFrom: new Date(Date.now()).toISOString(),
      dateTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      type: 'entrega',
    });
    expect(list.length).toBe(1);
    expect(list[0]?.event.type).toBe('entrega');
  });

  it('5. Listar filtrado por employeeId', async () => {
    const user = await createTestUser('agenda5@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 5');
    const employeeA = await createTestEmployee(tenant.id, user.id, 'A');
    const employeeB = await createTestEmployee(tenant.id, user.id, 'B');
    const start = new Date(Date.now() + 60 * 60 * 1000);

    await agendaService.createEvent(tenant.id, {
      title: 'Evento A',
      type: 'prova',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
      employeeId: employeeA.id,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);
    await agendaService.createEvent(tenant.id, {
      title: 'Evento B',
      type: 'prova',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      allDay: false,
      employeeId: employeeB.id,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);

    const list = await agendaService.listEvents(tenant.id, {
      dateFrom: new Date(Date.now()).toISOString(),
      dateTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      employeeId: employeeA.id,
    });
    expect(list.length).toBe(1);
    expect(list[0]?.event.employeeId).toBe(employeeA.id);
  });

  it('6. Update evento - atualiza campos', async () => {
    const user = await createTestUser('agenda6@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 6');
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const created = await agendaService.createEvent(tenant.id, {
      title: 'Titulo antigo',
      type: 'outro',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);

    const updated = await agendaService.updateEvent(tenant.id, created.id, {
      title: 'Titulo novo',
      type: 'entrega',
    }, user.id);

    expect(updated.title).toBe('Titulo novo');
    expect(updated.type).toBe('entrega');
  });

  it('7. Move evento - atualiza start/end mantendo duracao', async () => {
    const user = await createTestUser('agenda7@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 7');
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const created = await agendaService.createEvent(tenant.id, {
      title: 'Mover',
      type: 'outro',
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);

    const movedStart = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const moved = await agendaService.moveEvent(tenant.id, {
      eventId: created.id,
      startAt: movedStart.toISOString(),
      endAt: movedStart.toISOString(),
    }, user.id);

    const duration = new Date(moved.endAt).getTime() - new Date(moved.startAt).getTime();
    expect(duration).toBe(2 * 60 * 60 * 1000);
  });

  it('8. Week view - retorna 7 dias com eventos agrupados', async () => {
    const user = await createTestUser('agenda8@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 8');
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

    const eventDate = new Date(weekStart);
    eventDate.setDate(weekStart.getDate() + 2);
    eventDate.setHours(10, 0, 0, 0);
    await agendaService.createEvent(tenant.id, {
      title: 'Semana',
      type: 'outro',
      startAt: eventDate.toISOString(),
      endAt: new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);

    const view = await agendaService.getWeekView(tenant.id, weekStart);
    expect(view.days.length).toBe(7);
    expect(view.days.some((d) => d.events.length > 0)).toBe(true);
  });

  it('9. Month view - retorna dias do mes com eventos', async () => {
    const user = await createTestUser('agenda9@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 9');
    const now = new Date();
    const eventDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 14, 0, 0));
    await agendaService.createEvent(tenant.id, {
      title: 'Mes',
      type: 'outro',
      startAt: eventDate.toISOString(),
      endAt: new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);

    const view = await agendaService.getMonthView(tenant.id, now.getUTCFullYear(), now.getUTCMonth() + 1);
    expect(view.days.length).toBeGreaterThanOrEqual(28);
    expect(view.days.some((d) => d.events.length > 0)).toBe(true);
  });

  it('10. Complete evento - isCompleted = true', async () => {
    const user = await createTestUser('agenda10@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 10');
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const created = await agendaService.createEvent(tenant.id, {
      title: 'Completar',
      type: 'entrega',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);

    const completed = await agendaService.completeEvent(tenant.id, created.id, user.id);
    expect(completed.isCompleted).toBe(true);
  });

  it('11. Cancel evento - isCancelled = true', async () => {
    const user = await createTestUser('agenda11@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 11');
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const created = await agendaService.createEvent(tenant.id, {
      title: 'Cancelar',
      type: 'entrega',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);

    const cancelled = await agendaService.cancelEvent(tenant.id, created.id, user.id);
    expect(cancelled.isCancelled).toBe(true);
  });

  it('12. Delete evento pai - deleta instancias futuras', async () => {
    const user = await createTestUser('agenda12@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 12');
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const parent = await agendaService.createEvent(tenant.id, {
      title: 'Recorrente',
      type: 'reuniao',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'weekly',
      recurrenceEndDate: new Date(start.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      reminderMinutesBefore: 60,
    }, user.id);

    await agendaService.deleteEvent(tenant.id, parent.id, user.id);
    const list = await agendaService.listEvents(tenant.id, {
      dateFrom: start.toISOString(),
      dateTo: new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(list.length).toBe(0);
  });

  it('13. Cron de lembretes - cria notification + marca reminderSent', async () => {
    const user = await createTestUser('agenda13@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Agenda 13');
    const start = new Date(Date.now() + 20 * 60 * 1000);

    const created = await agendaService.createEvent(tenant.id, {
      title: 'Lembrete',
      type: 'outro',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, user.id);

    await eventReminders();

    const [updated] = await db.select().from(events).where(eq(events.id, created.id));
    const notifs = await db.select().from(notifications).where(eq(notifications.tenantId, tenant.id));

    expect(updated?.reminderSent).toBe(true);
    expect(notifs.length).toBeGreaterThan(0);
  });

  it('14. Eventos de tenant A invisiveis para B', async () => {
    const userA = await createTestUser('agenda14a@test.com');
    const userB = await createTestUser('agenda14b@test.com');
    const tenantA = await createTestTenant(userA.id, 'Lab Agenda 14A');
    const tenantB = await createTestTenant(userB.id, 'Lab Agenda 14B');
    const start = new Date(Date.now() + 60 * 60 * 1000);

    await agendaService.createEvent(tenantA.id, {
      title: 'Somente A',
      type: 'outro',
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
      recurrence: 'none',
      reminderMinutesBefore: 60,
    }, userA.id);

    const listB = await agendaService.listEvents(tenantB.id, {
      dateFrom: new Date(Date.now()).toISOString(),
      dateTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(listB.length).toBe(0);
  });
});
