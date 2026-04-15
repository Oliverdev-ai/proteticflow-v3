import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { sql, eq } from 'drizzle-orm';
import { osBlocks, users, tenants, tenantMembers } from '../../db/schema/index.js';
import { jobs, jobItems, jobLogs, orderCounters } from '../../db/schema/jobs.js';
import { clients, pricingTables, priceItems } from '../../db/schema/clients.js';
import { deliverySchedules, deliveryItems } from '../../db/schema/deliveries.js';
import { hashPassword } from '../../core/auth.js';
import * as deliveryService from './service.js';
import * as jobService from '../jobs/service.js';

async function createTestUser(email: string) {
  const [u] = await db.insert(users).values({
    name: 'Test', email, passwordHash: await hashPassword('Test123!'), role: 'user',
  }).returning();
  return u!;
}

async function createTestTenant(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function createTestClient(tenantId: number, userId: number) {
  const { createClient } = await import('../clients/service.js');
  const client = await createClient(tenantId, { name: 'Clínica Delivery', neighborhood: 'Centro', priceAdjustmentPercent: 0 }, userId);
  if (!client) throw new Error('Falha ao criar cliente de teste');
  return client;
}

async function createTestJob(tenantId: number, clientId: number, userId: number) {
  const job = await jobService.createJob(tenantId, {
    clientId,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    items: [{ serviceNameSnapshot: 'Coroa', quantity: 1, unitPriceCents: 10000, adjustmentPercent: 0 }],
  }, userId);
  if (!job) throw new Error('Falha ao criar job de teste');
  return job;
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.delete(deliveryItems);
  await db.delete(deliverySchedules);
  await db.delete(jobLogs);
  await db.delete(jobItems);
  await db.delete(jobs);
  await db.delete(orderCounters);
  await db.delete(priceItems);
  await db.delete(pricingTables);
  await db.delete(osBlocks);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('Delivery Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. Criar roteiro com items — retorna schedule + items', async () => {
    const user = await createTestUser('del1@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Del1');
    const client = await createTestClient(tenant.id, user.id);
    const job = await createTestJob(tenant.id, client.id, user.id);

    const result = await deliveryService.createSchedule(tenant.id, {
      date: new Date().toISOString(),
      driverName: 'João',
      vehicle: 'HB20-1234',
      items: [{ jobId: job.id, clientId: client.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 1 }],
    }, user.id);

    expect(result.schedule.tenantId).toBe(tenant.id);
    expect(result.schedule.driverName).toBe('João');
    expect(result.items.length).toBe(1);
    expect(result.items[0]?.jobId).toBe(job.id);
  });

  it('2. Listar roteiros — filtra por tenant', async () => {
    const u1 = await createTestUser('del2a@test.com');
    const u2 = await createTestUser('del2b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab Del2A');
    const t2 = await createTestTenant(u2.id, 'Lab Del2B');
    const c1 = await createTestClient(t1.id, u1.id);
    const j1 = await createTestJob(t1.id, c1.id, u1.id);

    await deliveryService.createSchedule(t1.id, {
      date: new Date().toISOString(),
      items: [{ jobId: j1.id, clientId: c1.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 0 }],
    }, u1.id);

    const { data } = await deliveryService.listSchedules(t2.id, { page: 1, limit: 20 });
    expect(data.length).toBe(0);
  });

  it('3. Listar — filtra por período', async () => {
    const user = await createTestUser('del3@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Del3');
    const client = await createTestClient(tenant.id, user.id);
    const job1 = await createTestJob(tenant.id, client.id, user.id);
    const job2 = await createTestJob(tenant.id, client.id, user.id);

    const yesterday = new Date(Date.now() - 86400000);
    const tomorrow = new Date(Date.now() + 86400000);

    await deliveryService.createSchedule(tenant.id, {
      date: yesterday.toISOString(),
      items: [{ jobId: job1.id, clientId: client.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 0 }],
    }, user.id);

    await deliveryService.createSchedule(tenant.id, {
      date: tomorrow.toISOString(),
      items: [{ jobId: job2.id, clientId: client.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 0 }],
    }, user.id);

    const now = new Date();
    const { data } = await deliveryService.listSchedules(tenant.id, {
      dateTo: now.toISOString(),
      page: 1, limit: 20,
    });
    expect(data.length).toBe(1); // só ontem
  });

  it('4. Atualizar item status → delivered → setar deliveredAt', async () => {
    const user = await createTestUser('del4@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Del4');
    const client = await createTestClient(tenant.id, user.id);
    const job = await createTestJob(tenant.id, client.id, user.id);

    const { items } = await deliveryService.createSchedule(tenant.id, {
      date: new Date().toISOString(),
      items: [{ jobId: job.id, clientId: client.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 0 }],
    }, user.id);

    const updated = await deliveryService.updateItemStatus(tenant.id, {
      itemId: items[0]!.id,
      status: 'delivered',
    }, user.id);

    expect(updated.status).toBe('delivered');
    expect(updated.deliveredAt).not.toBeNull();
  });

  it('5. Atualizar item status → failed → exigir failedReason', async () => {
    const user = await createTestUser('del5@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Del5');
    const client = await createTestClient(tenant.id, user.id);
    const job = await createTestJob(tenant.id, client.id, user.id);

    const { items } = await deliveryService.createSchedule(tenant.id, {
      date: new Date().toISOString(),
      items: [{ jobId: job.id, clientId: client.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 0 }],
    }, user.id);

    // Sem failedReason deve rejeitar
    await expect(
      deliveryService.updateItemStatus(tenant.id, { itemId: items[0]!.id, status: 'failed' }, user.id)
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    // Com failedReason deve funcionar
    const updated = await deliveryService.updateItemStatus(tenant.id, {
      itemId: items[0]!.id,
      status: 'failed',
      failedReason: 'Cliente ausente',
    }, user.id);
    expect(updated.status).toBe('failed');
    expect(updated.failedReason).toBe('Cliente ausente');
  });

  it('6. markAllInTransit — batch update funcional', async () => {
    const user = await createTestUser('del6@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Del6');
    const client = await createTestClient(tenant.id, user.id);
    const j1 = await createTestJob(tenant.id, client.id, user.id);
    const j2 = await createTestJob(tenant.id, client.id, user.id);

    const { schedule } = await deliveryService.createSchedule(tenant.id, {
      date: new Date().toISOString(),
      items: [
        { jobId: j1.id, clientId: client.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 1 },
        { jobId: j2.id, clientId: client.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 2 },
      ],
    }, user.id);

    await deliveryService.markAllInTransit(tenant.id, schedule.id, user.id);

    const { items: updated } = await deliveryService.getSchedule(tenant.id, schedule.id);
    expect(updated.every(i => i.item.status === 'in_transit')).toBe(true);
  });

  it('7. Relatório de entregas — contagens corretas', async () => {
    const user = await createTestUser('del7@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Del7');
    const client = await createTestClient(tenant.id, user.id);
    const j1 = await createTestJob(tenant.id, client.id, user.id);
    const j2 = await createTestJob(tenant.id, client.id, user.id);

    const now = new Date();
    const { items } = await deliveryService.createSchedule(tenant.id, {
      date: now.toISOString(),
      items: [
        { jobId: j1.id, clientId: client.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 1 },
        { jobId: j2.id, clientId: client.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 2 },
      ],
    }, user.id);

    await deliveryService.updateItemStatus(tenant.id, { itemId: items[0]!.id, status: 'delivered' }, user.id);
    await deliveryService.updateItemStatus(tenant.id, { itemId: items[1]!.id, status: 'failed', failedReason: 'Endereço errado' }, user.id);

    const dateFrom = new Date(now.getTime() - 3600000);
    const dateTo = new Date(now.getTime() + 3600000);
    const report = await deliveryService.getDeliveryReport(tenant.id, dateFrom, dateTo);

    expect(report.totalSchedules).toBe(1);
    expect(report.delivered).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.successRate).toBe(50);
  });

  it('8. Agrupamento por bairro funcional', async () => {
    const user = await createTestUser('del8@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Del8');

    // Criar clientes em bairros diferentes
    const { createClient } = await import('../clients/service.js');
    const c1 = await createClient(tenant.id, { name: 'C1', neighborhood: 'Centro', priceAdjustmentPercent: 0 }, user.id);
    const c2 = await createClient(tenant.id, { name: 'C2', neighborhood: 'Centro', priceAdjustmentPercent: 0 }, user.id);
    const c3 = await createClient(tenant.id, { name: 'C3', neighborhood: 'Jardins', priceAdjustmentPercent: 0 }, user.id);
    if (!c1 || !c2 || !c3) throw new Error('Falha ao criar clientes de teste');

    const j1 = await createTestJob(tenant.id, c1.id, user.id);
    const j2 = await createTestJob(tenant.id, c2.id, user.id);
    const j3 = await createTestJob(tenant.id, c3.id, user.id);

    const grouped = await deliveryService.groupByNeighborhood(tenant.id, [j1.id, j2.id, j3.id]);

    expect(grouped['Centro']?.length).toBe(2);
    expect(grouped['Jardins']?.length).toBe(1);
  });

  it('9. PDF gerado sem crash', async () => {
    const user = await createTestUser('del9@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Del9');
    const client = await createTestClient(tenant.id, user.id);
    const job = await createTestJob(tenant.id, client.id, user.id);

    const { schedule } = await deliveryService.createSchedule(tenant.id, {
      date: new Date().toISOString(),
      driverName: 'Carlos',
      items: [{ jobId: job.id, clientId: client.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 0 }],
    }, user.id);

    const pdf = await deliveryService.generateRoutePdf(tenant.id, schedule.id);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(100);
  });

  it('10. Tenant isolation — schedule de A invisível para B', async () => {
    const u1 = await createTestUser('del10a@test.com');
    const u2 = await createTestUser('del10b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab Del10A');
    const t2 = await createTestTenant(u2.id, 'Lab Del10B');
    const c1 = await createTestClient(t1.id, u1.id);
    const j1 = await createTestJob(t1.id, c1.id, u1.id);

    await deliveryService.createSchedule(t1.id, {
      date: new Date().toISOString(),
      items: [{ jobId: j1.id, clientId: c1.id, stopType: 'delivery', deliveryAddress: 'Rua Teste, 123', sortOrder: 0 }],
    }, u1.id);

    const { data } = await deliveryService.listSchedules(t2.id, { page: 1, limit: 20 });
    expect(data.length).toBe(0);
  });

  it('11. Fluxo reverso: item entregue da baixa na OS pronta e gera job log', async () => {
    const user = await createTestUser('del11@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Del11');
    const client = await createTestClient(tenant.id, user.id);
    const job = await createTestJob(tenant.id, client.id, user.id);

    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'quality_check' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'ready' }, user.id);

    const [routeItem] = await db.select().from(deliveryItems).where(eq(deliveryItems.jobId, job.id));
    expect(routeItem).toBeDefined();

    await deliveryService.updateItemStatus(tenant.id, { itemId: routeItem!.id, status: 'delivered' }, user.id);

    const [updatedJob] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(updatedJob?.status).toBe('delivered');
    expect(updatedJob?.deliveredAt).not.toBeNull();

    const logs = await db.select().from(jobLogs).where(eq(jobLogs.jobId, job.id));
    const autoBaixaLog = logs.find((log) => log.fromStatus === 'ready' && log.toStatus === 'delivered');
    expect(autoBaixaLog).toBeDefined();
    expect(autoBaixaLog?.notes).toContain('Baixa automatica');
  });
});


