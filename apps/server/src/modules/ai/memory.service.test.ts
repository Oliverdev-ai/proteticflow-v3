import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import { db } from '../../db/index.js';
import { aiMemory } from '../../db/schema/ai-memory.js';
import { tenantMembers, tenants } from '../../db/schema/tenants.js';
import { users } from '../../db/schema/users.js';
import {
  MAX_MEMORY_KEYS,
  clearAllMemory,
  countMemoryKeys,
  getMemory,
  setMemory,
} from './memory.service.js';

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

describe('memory.service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('getMemory nao retorna chaves expiradas', async () => {
    const user = await createTestUser('memory-expire@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Memory Expire');

    await setMemory(tenant.id, user.id, 'favorite_color', 'azul', 'assistant');
    await setMemory(
      tenant.id,
      user.id,
      'expired_note',
      'nao deve aparecer',
      'assistant',
      new Date(Date.now() - 60_000),
    );

    const memory = await getMemory(tenant.id, user.id);
    expect(memory.favorite_color).toBe('azul');
    expect(memory.expired_note).toBeUndefined();
  }, 20_000);

  it('setMemory faz upsert para mesma key', async () => {
    const user = await createTestUser('memory-upsert@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Memory Upsert');

    await setMemory(tenant.id, user.id, 'delivery_slot', 'manha', 'assistant');
    await setMemory(tenant.id, user.id, 'delivery_slot', 'tarde', 'assistant');

    const memory = await getMemory(tenant.id, user.id);
    const [row] = await db.select({ count: sql<number>`count(*)` })
      .from(aiMemory)
      .where(and(
        eq(aiMemory.tenantId, tenant.id),
        eq(aiMemory.userId, user.id),
        eq(aiMemory.key, 'delivery_slot'),
      ));

    expect(memory.delivery_slot).toBe('tarde');
    expect(Number(row?.count ?? 0)).toBe(1);
  }, 20_000);

  it('clearAllMemory filtra por tenantId e userId', async () => {
    const userA = await createTestUser('memory-tenant-a@test.com');
    const tenantA = await createTestTenant(userA.id, 'Lab A');
    const userB = await createTestUser('memory-tenant-b@test.com');
    const tenantB = await createTestTenant(userB.id, 'Lab B');

    await setMemory(tenantA.id, userA.id, 'key_a', 'valor_a', 'assistant');
    await setMemory(tenantB.id, userB.id, 'key_b', 'valor_b', 'assistant');

    await clearAllMemory(tenantA.id, userA.id);

    const memoryA = await getMemory(tenantA.id, userA.id);
    const memoryB = await getMemory(tenantB.id, userB.id);

    expect(memoryA.key_a).toBeUndefined();
    expect(memoryB.key_b).toBe('valor_b');
  }, 20_000);

  it('countMemoryKeys retorna total e permite validar limite MAX_MEMORY_KEYS', async () => {
    const user = await createTestUser('memory-count@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Memory Count');

    for (let idx = 0; idx < MAX_MEMORY_KEYS; idx += 1) {
      await setMemory(tenant.id, user.id, `k_${idx}`, `v_${idx}`, 'assistant');
    }

    const count = await countMemoryKeys(tenant.id, user.id);
    expect(count).toBe(MAX_MEMORY_KEYS);
  }, 20_000);
});
