import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, tenants, tenantMembers } from '../../db/schema/index.js';
import { jobs, jobItems, jobLogs, orderCounters } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { hashPassword } from '../../core/auth.js';
import * as jobService from './service.js';
import { sendEmail } from '../notifications/email.js';

vi.mock('../notifications/email.js', () => ({
  sendEmail: vi.fn(async () => ({ sent: true })),
}));

async function createTestUser(email: string) {
  const [u] = await db.insert(users).values({
    name: 'Test',
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

async function createClientWithEmail(tenantId: number, userId: number, email: string) {
  const { createClient } = await import('../clients/service.js');
  return createClient(tenantId, { name: 'Cliente Email', email, priceAdjustmentPercent: 0 }, userId);
}

async function cleanup() {
  await db.delete(jobLogs);
  await db.delete(jobItems);
  await db.delete(jobs);
  await db.delete(orderCounters);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.delete(tenants);
  await db.delete(users);
}

describe('jobs client status notifications', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanup();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanup();
  });

  it('nao envia email para tenant em trial', async () => {
    const user = await createTestUser('job-notif-trial@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Trial');
    const client = await createClientWithEmail(tenant.id, user.id, 'cliente-trial@test.com');

    const job = await jobService.createJob(tenant.id, {
      clientId: client.id,
      deadline: new Date(Date.now() + 86_400_000).toISOString(),
      items: [{ serviceNameSnapshot: 'Servico', quantity: 1, unitPriceCents: 10000, adjustmentPercent: 0 }],
    }, user.id);

    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);

    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
  });

  it('envia email para tenant starter em mudanca de status', async () => {
    const user = await createTestUser('job-notif-starter@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Starter');
    const client = await createClientWithEmail(tenant.id, user.id, 'cliente-starter@test.com');

    await db
      .update(tenants)
      .set({ plan: 'starter' })
      .where(eq(tenants.id, tenant.id));

    const job = await jobService.createJob(tenant.id, {
      clientId: client.id,
      deadline: new Date(Date.now() + 86_400_000).toISOString(),
      items: [{ serviceNameSnapshot: 'Servico', quantity: 1, unitPriceCents: 10000, adjustmentPercent: 0 }],
    }, user.id);

    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);

    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0]).toMatchObject({
      to: 'cliente-starter@test.com',
      subject: expect.stringContaining(job.code),
    });
  });
});

