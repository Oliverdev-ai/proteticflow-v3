import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import { db } from '../../db/index.js';
import { alertLog, userPreferences } from '../../db/schema/proactive.js';
import { tenantMembers, tenants } from '../../db/schema/tenants.js';
import { users } from '../../db/schema/users.js';
import { buildDedupKey, claimAlertDispatch } from './alert-log.service.js';

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
  await db.delete(userPreferences);
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

describe('alert-log.service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('dedup impede segundo claim com mesma dedup_key', async () => {
    const user = await createTestUser('alert-log@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Alert Log');
    const dedupKey = buildDedupKey(`deadline_24h:${tenant.id}:${user.id}:job:1:bucket`);

    const firstClaim = await claimAlertDispatch({
      tenantId: tenant.id,
      userId: user.id,
      alertType: 'deadline_24h',
      entityType: 'job',
      entityId: 1,
      dedupKey,
      payload: { source: 'test' },
    });

    const secondClaim = await claimAlertDispatch({
      tenantId: tenant.id,
      userId: user.id,
      alertType: 'deadline_24h',
      entityType: 'job',
      entityId: 1,
      dedupKey,
      payload: { source: 'test-duplicate' },
    });

    expect(firstClaim).toBeTruthy();
    expect(secondClaim).toBeNull();
  }, 20_000);
});
