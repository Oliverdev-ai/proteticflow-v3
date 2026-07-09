import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import { db } from '../../db/index.js';
import { aiCommandRuns } from '../../db/schema/ai.js';
import { aiMemory } from '../../db/schema/ai-memory.js';
import { alertLog } from '../../db/schema/proactive.js';
import { tenantMembers, tenants } from '../../db/schema/tenants.js';
import { users } from '../../db/schema/users.js';
import { exportUserData } from './service.js';

async function createTestUser(email: string) {
  const [user] = await db
    .insert(users)
    .values({
      name: 'Export User',
      email,
      passwordHash: await hashPassword('Password123!'),
      role: 'user',
      phone: '11999999999',
      whatsappOptIn: true,
    })
    .returning();

  return user!;
}

async function createTestTenant(userId: number, name: string) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  const [tenant] = await db
    .insert(tenants)
    .values({
      name,
      slug,
      plan: 'pro',
      userCount: 1,
    })
    .returning();

  await db.insert(tenantMembers).values({
    tenantId: tenant!.id,
    userId,
    role: 'superadmin',
  });

  await db.update(users).set({ activeTenantId: tenant!.id }).where(eq(users.id, userId));
  return tenant!;
}

async function cleanup() {
  await db.delete(alertLog);
  await db.delete(aiCommandRuns);
  await db.delete(aiMemory);
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

describe('auth exportUserData LGPD', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('exports profile, membership and AI LGPD payload only for the active tenant', async () => {
    const userA = await createTestUser('auth-lgpd-a@test.com');
    const tenantA = await createTestTenant(userA.id, 'Auth LGPD A');
    const userB = await createTestUser('auth-lgpd-b@test.com');
    const tenantB = await createTestTenant(userB.id, 'Auth LGPD B');

    await db.insert(aiMemory).values({
      tenantId: tenantA.id,
      userId: userA.id,
      scope: 'user',
      category: 'general',
      keyText: 'preferred_channel',
      valueJson: { value: 'email' },
      source: 'flow_ia',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await db.insert(aiMemory).values({
      tenantId: tenantB.id,
      userId: userB.id,
      scope: 'user',
      category: 'general',
      keyText: 'preferred_channel',
      valueJson: { value: 'whatsapp' },
      source: 'flow_ia',
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await db.insert(aiCommandRuns).values({
      tenantId: tenantA.id,
      userId: userA.id,
      channel: 'text',
      rawInput: 'mostrar entregas',
      intent: 'deliveries.list',
      executionStatus: 'success',
      toolName: 'deliveries.list',
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
      dedupKey: `auth-lgpd-a-${Date.now()}`,
      channel: 'in_app',
    });
    await db.insert(alertLog).values({
      tenantId: tenantB.id,
      userId: userB.id,
      alertType: 'stock_low',
      dedupKey: `auth-lgpd-b-${Date.now() + 1}`,
      channel: 'in_app',
    });

    const exported = await exportUserData(userA.id, tenantA.id);

    expect(exported.tenantId).toBe(tenantA.id);
    expect(exported.userId).toBe(userA.id);
    expect(exported.profile.email).toBe(userA.email);
    expect(exported.profile.whatsappOptIn).toBe(true);
    expect(exported.profile.twoFactorEnabled).toBe(false);
    expect(exported.profile).not.toHaveProperty('passwordHash');
    expect(exported.profile).not.toHaveProperty('twoFactorSecret');
    expect(exported.memberships).toHaveLength(1);
    expect(exported.memberships[0]?.tenantId).toBe(tenantA.id);
    expect(exported.memberships[0]?.tenantName).toBe(tenantA.name);
    expect(exported.ai.memory).toHaveLength(1);
    expect(exported.ai.memory[0]?.valueJson).toEqual({ value: 'email' });
    expect(exported.ai.aiCommandRuns).toHaveLength(1);
    expect(exported.ai.aiCommandRuns[0]?.rawInput).toBe('mostrar entregas');
    expect(exported.ai.alerts).toHaveLength(1);
    expect(exported.ai.alerts[0]?.alertType).toBe('deadline_24h');

    await expect(exportUserData(userA.id, tenantB.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  }, 20_000);
});
