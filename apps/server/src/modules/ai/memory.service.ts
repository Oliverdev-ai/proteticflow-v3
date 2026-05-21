import { and, asc, eq, gt, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { aiMemory } from '../../db/schema/ai-memory.js';

export const MAX_MEMORY_KEYS = 50;
export const DEFAULT_MEMORY_TTL_DAYS = 365;

function defaultExpiresAt(source: 'assistant' | 'user_explicit', expiresAt?: Date): Date | null {
  if (expiresAt) return expiresAt;
  if (source === 'user_explicit') return null;
  return new Date(Date.now() + DEFAULT_MEMORY_TTL_DAYS * 86_400_000);
}

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
  const resolvedExpiresAt = defaultExpiresAt(source, expiresAt);
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: aiMemory.id })
      .from(aiMemory)
      .where(and(
        eq(aiMemory.tenantId, tenantId),
        eq(aiMemory.userId, userId),
        eq(aiMemory.key, key),
      ))
      .limit(1);

    if (!existing) {
      const [countRow] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(aiMemory)
        .where(and(
          eq(aiMemory.tenantId, tenantId),
          eq(aiMemory.userId, userId),
        ));

      if (Number(countRow?.count ?? 0) >= MAX_MEMORY_KEYS) {
        const [evictionCandidate] = await tx
          .select({ id: aiMemory.id })
          .from(aiMemory)
          .where(and(
            eq(aiMemory.tenantId, tenantId),
            eq(aiMemory.userId, userId),
            ne(aiMemory.source, 'user_explicit'),
          ))
          .orderBy(asc(aiMemory.updatedAt), asc(aiMemory.id))
          .limit(1);

        if (!evictionCandidate) {
          throw new Error('Limite de memoria IA atingido');
        }

        await tx
          .delete(aiMemory)
          .where(and(
            eq(aiMemory.tenantId, tenantId),
            eq(aiMemory.userId, userId),
            eq(aiMemory.id, evictionCandidate.id),
          ));
      }
    }

    await tx
      .insert(aiMemory)
      .values({
        tenantId,
        userId,
        key,
        value,
        source,
        expiresAt: resolvedExpiresAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [aiMemory.tenantId, aiMemory.userId, aiMemory.key],
        set: {
          value,
          source,
          expiresAt: resolvedExpiresAt,
          updatedAt: new Date(),
        },
      });
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
