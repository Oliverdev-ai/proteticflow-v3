import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import { db } from '../../db/index.js';
import { aiCommandRuns } from '../../db/schema/ai.js';
import { aiMemory, lgpdRequests } from '../../db/schema/ai-memory.js';
import { alertLog } from '../../db/schema/proactive.js';
import { tenantMembers, tenants } from '../../db/schema/tenants.js';
import { users } from '../../db/schema/users.js';
import { requestLgpdDelete, requestLgpdExport } from './lgpd.service.js';
import { setMemory } from './memory.service.js';

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

async function cleanup() {
  await db.delete(alertLog);
  await db.delete(aiCommandRuns);
  await db.delete(aiMemory);
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
  beforeEach(cleanup);
  afterEach(cleanup);

  it('export gera JSON esperado sem dados de outros tenants', async () => {
    const userA = await createTestUser('lgpd-export-a@test.com');
    const tenantA = await createTestTenant(userA.id, 'Lab LGPD A');
    const userB = await createTestUser('lgpd-export-b@test.com');
    const tenantB = await createTestTenant(userB.id, 'Lab LGPD B');

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
    expect(result.payload.memory[0]?.value).toBe('email');
    expect(result.payload.aiCommandRuns).toHaveLength(1);
    expect(result.payload.aiCommandRuns[0]?.rawInput).toBe('mostrar jobs');
    expect(result.payload.alerts).toHaveLength(1);
    expect(result.payload.alerts[0]?.alertType).toBe('deadline_24h');
  }, 20_000);

  it('delete limpa ai_memory mas preserva lgpd_requests (audit trail)', async () => {
    const user = await createTestUser('lgpd-delete@test.com');
    const tenant = await createTestTenant(user.id, 'Lab LGPD Delete');

    await setMemory(tenant.id, user.id, 'contact_window', 'manha', 'assistant');
    await db.insert(aiCommandRuns).values({
      tenantId: tenant.id,
      userId: user.id,
      channel: 'text',
      rawInput: 'quero lembrar',
      intent: 'memory.remember',
      executionStatus: 'success',
      toolName: 'memory.remember',
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
