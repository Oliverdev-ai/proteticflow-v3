import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { hashPassword } from '../core/auth.js';
import { clients } from '../db/schema/clients.js';
import { jobs, jobItems, jobLogs, orderCounters } from '../db/schema/jobs.js';
import { osBlocks, tenantMembers, tenants, users } from '../db/schema/index.js';
import * as jobService from '../modules/jobs/service.js';

type SeedContext = {
  tenantId: number;
  userId: number;
  clientId: number;
};

const baseItem = {
  serviceNameSnapshot: 'Coroa Zircônia',
  quantity: 1,
  unitPriceCents: 12000,
  adjustmentPercent: 0,
};

async function createTestUser(email: string) {
  const [created] = await db
    .insert(users)
    .values({
      name: 'Tester',
      email,
      passwordHash: await hashPassword('Test123!'),
      role: 'user',
    })
    .returning();

  return created!;
}

async function createTestTenant(ownerUserId: number, name: string) {
  const { createTenant } = await import('../modules/tenants/service.js');
  return createTenant(ownerUserId, { name });
}

async function createTestClient(tenantId: number, userId: number, name = 'Clínica F34') {
  const { createClient } = await import('../modules/clients/service.js');
  return createClient(tenantId, { name, priceAdjustmentPercent: 0 }, userId);
}

async function createSeed(prefix: string): Promise<SeedContext> {
  const user = await createTestUser(`${prefix}@test.com`);
  const tenant = await createTestTenant(user.id, `Tenant ${prefix}`);
  const client = await createTestClient(tenant.id, user.id);

  return { tenantId: tenant.id, userId: user.id, clientId: client.id };
}

async function createJobForSeed(seed: SeedContext) {
  return jobService.createJob(
    seed.tenantId,
    {
      clientId: seed.clientId,
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      items: [baseItem],
    },
    seed.userId,
  );
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

describe('Jobs subtypes (F34)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. Suspender OS preenche campos de suspensão', async () => {
    const seed = await createSeed('f34-suspend-ok');
    const job = await createJobForSeed(seed);

    await jobService.suspendJob(
      seed.tenantId,
      { jobId: job.id, reason: 'Aguardando material' },
      seed.userId,
    );

    const [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored?.status).toBe('suspended');
    expect(stored?.suspendedAt).not.toBeNull();
    expect(stored?.suspendedBy).toBe(seed.userId);
    expect(stored?.suspendReason).toBe('Aguardando material');
    expect(stored?.resumeStatus).toBe('pending');
  });

  it('2. Suspender OS já suspensa retorna erro', async () => {
    const seed = await createSeed('f34-suspend-dup');
    const job = await createJobForSeed(seed);

    await jobService.suspendJob(seed.tenantId, { jobId: job.id, reason: 'Primeira suspensão' }, seed.userId);

    await expect(
      jobService.suspendJob(seed.tenantId, { jobId: job.id, reason: 'Segunda suspensão' }, seed.userId),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('3. Reativar OS suspensa limpa campos de suspensão', async () => {
    const seed = await createSeed('f34-unsuspend');
    const job = await createJobForSeed(seed);

    await jobService.suspendJob(seed.tenantId, { jobId: job.id, reason: 'Aguardando retorno' }, seed.userId);
    await jobService.unsuspendJob(seed.tenantId, { jobId: job.id }, seed.userId);

    const [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored?.status).toBe('pending');
    expect(stored?.suspendedAt).toBeNull();
    expect(stored?.suspendedBy).toBeNull();
    expect(stored?.suspendReason).toBeNull();
    expect(stored?.resumeStatus).toBeNull();
  });

  it('4. Remoldagem pausa a mesma OS sem criar filha nem nova cobranca', async () => {
    const seed = await createSeed('f34-rework');
    const original = await createJobForSeed(seed);

    const rework = await jobService.createReworkJob(
      seed.tenantId,
      {
        jobId: original.id,
        reason: 'Ajuste oclusal necessário',
      },
      seed.userId,
    );

    const storedJobs = await db.select().from(jobs);
    const originalAfter = storedJobs.find((job) => job.id === original.id);

    expect(rework.id).toBe(original.id);
    expect(storedJobs).toHaveLength(1);
    expect(originalAfter?.status).toBe('rework_in_progress');
    expect(originalAfter?.jobSubType).toBe('rework');
    expect(originalAfter?.reworkParentId).toBeNull();
    expect(originalAfter?.reworkReason).toBe('Ajuste oclusal necessário');
    expect(originalAfter?.suspendedAt).not.toBeNull();
    expect(originalAfter?.resumeStatus).toBe('pending');
  });

  it('5. Marcar prova define subtype proof e proofDueDate', async () => {
    const seed = await createSeed('f34-mark-proof');
    const job = await createJobForSeed(seed);
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    await jobService.markJobAsProof(seed.tenantId, { jobId: job.id, proofDueDate: dueDate }, seed.userId);

    const [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored?.jobSubType).toBe('proof');
    expect(stored?.proofDueDate?.toISOString()).toBe(new Date(dueDate).toISOString());
  });

  it('6. Retornar prova define proofReturnedAt', async () => {
    const seed = await createSeed('f34-return-proof');
    const job = await createJobForSeed(seed);
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    await jobService.markJobAsProof(seed.tenantId, { jobId: job.id, proofDueDate: dueDate }, seed.userId);
    await jobService.returnJobProof(seed.tenantId, { jobId: job.id }, seed.userId);

    const [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored?.proofReturnedAt).not.toBeNull();
  });

  it('7. Toggle urgente atualiza flag isUrgent', async () => {
    const seed = await createSeed('f34-urgent');
    const job = await createJobForSeed(seed);

    await jobService.toggleJobUrgent(seed.tenantId, { jobId: job.id, isUrgent: true }, seed.userId);
    let [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored?.isUrgent).toBe(true);

    await jobService.toggleJobUrgent(seed.tenantId, { jobId: job.id, isUrgent: false }, seed.userId);
    [stored] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(stored?.isUrgent).toBe(false);
  });

  it('8. Tenant isolation: suspender OS de outro tenant deve falhar', async () => {
    const ownerA = await createSeed('f34-tenant-a');
    const ownerB = await createSeed('f34-tenant-b');
    const jobA = await createJobForSeed(ownerA);

    await expect(
      jobService.suspendJob(ownerB.tenantId, { jobId: jobA.id, reason: 'Tentativa indevida' }, ownerB.userId),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
