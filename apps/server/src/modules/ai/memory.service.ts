import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { aiMemory } from '../../db/schema/ai-memory.js';

export const MAX_MEMORY_KEYS = 50;

export async function getMemory(
  tenantId: number,
  userId: number,
  now: Date = new Date(),
): Promise<Record<string, string>> {
  const rows = await db
    .select({ key: aiMemory.key, value: aiMemory.value })
    .from(aiMemory)
    .where(and(
      eq(aiMemory.tenantId, tenantId),
      eq(aiMemory.userId, userId),
      or(isNull(aiMemory.expiresAt), gt(aiMemory.expiresAt, now)),
    ));

  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setMemory(
  tenantId: number,
  userId: number,
  key: string,
  value: string,
  source: 'assistant' | 'user_explicit' = 'assistant',
  expiresAt?: Date,
): Promise<void> {
  await db
    .insert(aiMemory)
    .values({
      tenantId,
      userId,
      key,
      value,
      source,
      expiresAt: expiresAt ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [aiMemory.tenantId, aiMemory.userId, aiMemory.key],
      set: {
        value,
        source,
        expiresAt: expiresAt ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function deleteMemoryKey(tenantId: number, userId: number, key: string): Promise<void> {
  await db.delete(aiMemory).where(and(
    eq(aiMemory.tenantId, tenantId),
    eq(aiMemory.userId, userId),
    eq(aiMemory.key, key),
  ));
}

export async function clearAllMemory(tenantId: number, userId: number): Promise<void> {
  await db.delete(aiMemory).where(and(
    eq(aiMemory.tenantId, tenantId),
    eq(aiMemory.userId, userId),
  ));
}

export async function countMemoryKeys(tenantId: number, userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiMemory)
    .where(and(
      eq(aiMemory.tenantId, tenantId),
      eq(aiMemory.userId, userId),
    ));
  return Number(row?.count ?? 0);
}
