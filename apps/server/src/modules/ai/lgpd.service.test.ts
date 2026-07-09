import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import { db } from '../../db/index.js';
import { aiTenantSettings } from '../../db/schema/ai-advanced.js';
import { auditLogs } from '../../db/schema/audit.js';
import { aiCommandRuns } from '../../db/schema/ai.js';
import { aiMemory, AI_MEMORY_EMBEDDING_DIMENSIONS, lgpdRequests } from '../../db/schema/ai-memory.js';
import { alertLog } from '../../db/schema/proactive.js';
import { tenantMembers, tenants } from '../../db/schema/tenants.js';
import { users } from '../../db/schema/users.js';
import type { TrpcContext } from '../../trpc/context.js';
import { setEmbeddingsProviderForTests } from './embeddings.provider.js';
import { aiRouter } from './router.js';
import { requestLgpdDelete, requestLgpdExport } from './lgpd.service.js';
import { memoryService, setMemory } from './memory.service.js';

async function createTestUser(email: string) {
  const [user] = await db.insert(users).values({
    name: 'Teste',
    email,
    passwordHash: await hashPassword('Teste123!'),
    role: 'user',
  }).returning();
  return user!;
}

async function createTestTenant(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function enableMemory(tenantId: number, userId: number) {
  await db.update(tenants).set({ plan: 'pro' }).where(eq(tenants.id, tenantId));
  await memoryService.updateSettings({ tenantId, userId }, { enabled: true });
}

async function cleanup() {
  await db.delete(alertLog);
  await db.delete(aiCommandRuns);
  await db.delete(aiMemory);
  await db.delete(auditLogs);
  await db.delete(aiTenantSettings);
  await db.delete(lgpdRequests);
  await db.delete(tenantMembers);
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.delete(tenants).catch(async () => {
    await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
    await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
    await db.delete(tenants);
  });
  await db.delete(users);
}

describe('lgpd.service', () => {
  beforeEach(async () => {
    setEmbeddingsProviderForTests({
      embed: async (text) => Array.from(
        { length: AI_MEMORY_EMBEDDING_DIMENSIONS },
        (_, index) => (index === 0 ? Math.min(text.length / 100, 1) : 0),
      ),
    });
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
    setEmbeddingsProviderForTests(null);
  });

  it('export gera JSON esperado sem dados de outros tenants', async () => {
    const userA = await createTestUser('lgpd-export-a@test.com');
    const tenantA = await createTestTenant(userA.id, 'Lab LGPD A');
    const userB = await createTestUser('lgpd-export-b@test.com');
    const tenantB = await createTestTenant(userB.id, 'Lab LGPD B');

    await enableMemory(tenantA.id, userA.id);
    await enableMemory(tenantB.id, userB.id);
    await setMemory(tenantA.id, userA.id, 'preferred_channel', 'email', 'assistant');
    await setMemory(tenantB.id, userB.id, 'preferred_channel', 'whatsapp', 'assistant');

    await db.insert(aiCommandRuns).values({
      tenantId: tenantA.id,
      userId: userA.id,
      channel: 'text',
      rawInput: 'mostrar jobs',
      intent: 'jobs.listPending',
      executionStatus: 'success',
      toolName: 'jobs.listPending',
    });
    await db.insert(aiCommandRuns).values({
      tenantId: tenantB.id,
      userId: userB.id,
      channel: 'text',
      rawInput: 'mostrar financeiro',
      intent: 'financial.revenueToDate',
      executionStatus: 'success',
      toolName: 'financial.revenueToDate',
    });

    await db.insert(alertLog).values({
      tenantId: tenantA.id,
      userId: userA.id,
      alertType: 'deadline_24h',
      dedupKey: `dedup-a-${Date.now()}`,
      channel: 'in_app',
    });
    await db.insert(alertLog).values({
      tenantId: tenantB.id,
      userId: userB.id,
      alertType: 'stock_low',
      dedupKey: `dedup-b-${Date.now() + 1}`,
      channel: 'in_app',
    });

    const result = await requestLgpdExport(tenantA.id, userA.id);

    expect(result.status).toBe('completed');
    expect(result.payload.tenantId).toBe(tenantA.id);
    expect(result.payload.userId).toBe(userA.id);
    expect(result.payload.memory).toHaveLength(1);
    expect(result.payload.memory[0]?.valueJson).toEqual({ value: 'email' });
    expect(result.payload.aiCommandRuns).toHaveLength(1);
    expect(result.payload.aiCommandRuns[0]?.rawInput).toBe('mostrar jobs');
    expect(result.payload.alerts).toHaveLength(1);
    expect(result.payload.alerts[0]?.alertType).toBe('deadline_24h');
  }, 20_000);

  it('router LGPD requestDelete bloqueia usuario nao-admin', async () => {
    const owner = await createTestUser('lgpd-router-owner@test.com');
    const member = await createTestUser('lgpd-router-member@test.com');
    const tenant = await createTestTenant(owner.id, 'Lab LGPD Router');

    await db.update(tenants).set({ plan: 'enterprise' }).where(eq(tenants.id, tenant.id));
    await db.insert(tenantMembers).values({
      tenantId: tenant.id,
      userId: member.id,
      role: 'producao',
    });

    const caller = aiRouter.createCaller({
      req: {} as TrpcContext['req'],
      res: {} as TrpcContext['res'],
      db,
      user: {
        id: member.id,
        tenantId: tenant.id,
        role: 'producao',
      },
      tenantId: tenant.id,
    });

    await expect(caller.lgpd.requestDelete()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  }, 20_000);

  it('delete limpa ai_memory mas preserva lgpd_requests (audit trail)', async () => {
    const user = await createTestUser('lgpd-delete@test.com');
    const tenant = await createTestTenant(user.id, 'Lab LGPD Delete');

    await enableMemory(tenant.id, user.id);
    await setMemory(tenant.id, user.id, 'contact_window', 'manha', 'assistant');
    await db.insert(aiCommandRuns).values({
      tenantId: tenant.id,
      userId: user.id,
      channel: 'text',
      rawInput: 'quero lembrar',
      intent: 'remember_fact',
      executionStatus: 'success',
      toolName: 'remember_fact',
    });

    const result = await requestLgpdDelete(tenant.id, user.id);
    expect(result.status).toBe('completed');

    const [memoryCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiMemory)
      .where(and(
        eq(aiMemory.tenantId, tenant.id),
        eq(aiMemory.userId, user.id),
      ));

    const [commandRunCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiCommandRuns)
      .where(and(
        eq(aiCommandRuns.tenantId, tenant.id),
        eq(aiCommandRuns.userId, user.id),
      ));

    const [request] = await db
      .select()
      .from(lgpdRequests)
      .where(eq(lgpdRequests.id, result.requestId))
      .limit(1);

    const [anonymizedUser] = await db
      .select({
        email: users.email,
        phone: users.phone,
        phoneE164: users.phoneE164,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    expect(Number(memoryCount?.count ?? 0)).toBe(0);
    expect(Number(commandRunCount?.count ?? 0)).toBe(0);
    expect(request?.type).toBe('delete');
    expect(request?.status).toBe('completed');
    expect(request?.completedAt).toBeTruthy();
    expect(anonymizedUser?.phone).toBeNull();
    expect(anonymizedUser?.phoneE164).toBeNull();
    expect(anonymizedUser?.email).toContain('anon+');
  }, 20_000);
});
