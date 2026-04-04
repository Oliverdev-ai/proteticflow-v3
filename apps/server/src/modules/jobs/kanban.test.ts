import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { osBlocks, users, tenants, tenantMembers } from '../../db/schema/index.js';
import { jobs, jobItems, jobLogs, orderCounters } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import * as jobService from './service.js';

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

async function createTestClient(tenantId: number, userId: number, name = 'Clínica K') {
  const { createClient } = await import('../clients/service.js');
  return createClient(tenantId, { name, priceAdjustmentPercent: 0 }, userId);
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.delete(jobLogs);
  await db.delete(jobItems);
  await db.delete(jobs);
  await db.delete(orderCounters);
  await db.delete(osBlocks);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

const baseItem = { serviceNameSnapshot: 'Coroa', quantity: 1, unitPriceCents: 10000, adjustmentPercent: 0 };

async function createJobForTest(tenantId: number, clientId: number, userId: number, deadline?: Date) {
  return jobService.createJob(tenantId, {
    clientId,
    deadline: (deadline ?? new Date(Date.now() + 86400000)).toISOString(),
    items: [baseItem],
  }, userId);
}

describe('Kanban Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. getBoard retorna jobs agrupados por status (5 colunas)', async () => {
    const user = await createTestUser('k1@test.com');
    const tenant = await createTestTenant(user.id, 'Lab K1');
    const client = await createTestClient(tenant.id, user.id);
    await createJobForTest(tenant.id, client.id, user.id);
    const board = await jobService.getKanbanBoard(tenant.id, {});
    expect(board.columns).toHaveLength(5);
    const total = board.columns.reduce((s, c) => s + c.jobs.length, 0);
    expect(total).toBe(1);
  });

  it('2. moveCard com transição válida — atualiza status', async () => {
    const user = await createTestUser('k2@test.com');
    const tenant = await createTestTenant(user.id, 'Lab K2');
    const client = await createTestClient(tenant.id, user.id);
    const job = await createJobForTest(tenant.id, client.id, user.id);
    await jobService.moveKanban(tenant.id, job.id, 'in_progress', user.id);
    const [jdb] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(jdb?.status).toBe('in_progress');
  });

  it('3. moveCard com transição inválida — rejeita', async () => {
    const user = await createTestUser('k3@test.com');
    const tenant = await createTestTenant(user.id, 'Lab K3');
    const client = await createTestClient(tenant.id, user.id);
    const job = await createJobForTest(tenant.id, client.id, user.id);
    // pending → ready é inválido
    await expect(jobService.moveKanban(tenant.id, job.id, 'ready', user.id))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('4. moveCard gera jobLog', async () => {
    const user = await createTestUser('k4@test.com');
    const tenant = await createTestTenant(user.id, 'Lab K4');
    const client = await createTestClient(tenant.id, user.id);
    const job = await createJobForTest(tenant.id, client.id, user.id);
    await jobService.moveKanban(tenant.id, job.id, 'in_progress', user.id);
    const logs = await jobService.getLogs(tenant.id, job.id);
    expect(logs.some(l => l.toStatus === 'in_progress')).toBe(true);
  });

  it('5. Filtro por clientId funciona no getBoard', async () => {
    const user = await createTestUser('k5@test.com');
    const tenant = await createTestTenant(user.id, 'Lab K5');
    const c1 = await createTestClient(tenant.id, user.id, 'C1');
    const c2 = await createTestClient(tenant.id, user.id, 'C2');
    await createJobForTest(tenant.id, c1.id, user.id);
    await createJobForTest(tenant.id, c2.id, user.id);
    const board = await jobService.getKanbanBoard(tenant.id, { clientId: c1.id });
    const allJobs = board.columns.flatMap(c => c.jobs);
    expect(allJobs.every(j => j.clientId === c1.id)).toBe(true);
  });

  it('6. Filtro por assignedTo funciona', async () => {
    const user = await createTestUser('k6@test.com');
    const tenant = await createTestTenant(user.id, 'Lab K6');
    const client = await createTestClient(tenant.id, user.id);
    const job = await createJobForTest(tenant.id, client.id, user.id);
    await jobService.assignTechnician(tenant.id, job.id, user.id, user.id);
    const board = await jobService.getKanbanBoard(tenant.id, { assignedTo: user.id });
    const allJobs = board.columns.flatMap(c => c.jobs);
    expect(allJobs.some(j => j.id === job.id)).toBe(true);
  });

  it('7. Indicador overdue calculado — OS com deadline passado aparece', async () => {
    const user = await createTestUser('k7@test.com');
    const tenant = await createTestTenant(user.id, 'Lab K7');
    const client = await createTestClient(tenant.id, user.id);
    // OS com deadline ontem
    await createJobForTest(tenant.id, client.id, user.id, new Date(Date.now() - 86400000));
    const board = await jobService.getKanbanBoard(tenant.id, { overdue: true });
    const allJobs = board.columns.flatMap(c => c.jobs);
    expect(allJobs.length).toBeGreaterThan(0);
  });

  it('8. assignTechnician atualiza jobs.assignedTo', async () => {
    const user = await createTestUser('k8@test.com');
    const tenant = await createTestTenant(user.id, 'Lab K8');
    const client = await createTestClient(tenant.id, user.id);
    const job = await createJobForTest(tenant.id, client.id, user.id);
    await jobService.assignTechnician(tenant.id, job.id, user.id, user.id);
    const [jdb] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(jdb?.assignedTo).toBe(user.id);
  });

  it('9. Tenant isolation — board de A não mostra jobs de B', async () => {
    const u1 = await createTestUser('k9a@test.com');
    const u2 = await createTestUser('k9b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab K9A');
    const t2 = await createTestTenant(u2.id, 'Lab K9B');
    await createTestClient(t1.id, u1.id);
    const c2 = await createTestClient(t2.id, u2.id);
    await createJobForTest(t2.id, c2.id, u2.id);
    const board = await jobService.getKanbanBoard(t1.id, {});
    const allJobs = board.columns.flatMap(c => c.jobs);
    expect(allJobs.some(j => j.clientId === c2.id)).toBe(false);
  });
});
