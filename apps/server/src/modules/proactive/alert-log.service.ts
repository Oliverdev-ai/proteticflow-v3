import { createHash } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { alertLog } from '../../db/schema/proactive.js';
import type { ProactiveAlertType } from '@proteticflow/shared';

export type DispatchChannel = 'push' | 'email' | 'whatsapp' | 'in_app';

function monthStart(baseDate: Date): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 0, 0, 0, 0);
}

export function buildDedupKey(seed: string): string {
  return createHash('sha256').update(seed, 'utf8').digest('hex');
}

export async function hasDedupInWindow(
  tenantId: number,
  dedupKey: string,
  windowMs: number,
  now: Date = new Date(),
): Promise<boolean> {
  const lowerBound = new Date(now.getTime() - windowMs);
  const [existing] = await db
    .select({ id: alertLog.id })
    .from(alertLog)
    .where(and(
      eq(alertLog.tenantId, tenantId),
      eq(alertLog.dedupKey, dedupKey),
      gte(alertLog.sentAt, lowerBound),
    ))
    .limit(1);
  return Boolean(existing);
}

export async function claimAlertDispatch(input: {
  tenantId: number;
  userId?: number | null;
  alertType: ProactiveAlertType;
  entityType?: string | null;
  entityId?: number | null;
  dedupKey: string;
  payload?: Record<string, unknown> | null;
}): Promise<string | null> {
  const inserted = await db
    .insert(alertLog)
    .values({
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      alertType: input.alertType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      dedupKey: input.dedupKey,
      channel: 'pending',
      payload: input.payload ?? null,
    })
    .onConflictDoNothing({
      target: [alertLog.tenantId, alertLog.dedupKey],
    })
    .returning({ id: alertLog.id });

  return inserted[0]?.id ?? null;
}

export async function finalizeAlertDispatch(
  tenantId: number,
  claimId: string,
  channel: DispatchChannel,
  payload?: Record<string, unknown> | null,
): Promise<void> {
  await db
    .update(alertLog)
    .set({
      channel,
      payload: payload ?? null,
      sentAt: new Date(),
    })
    .where(and(
      eq(alertLog.tenantId, tenantId),
      eq(alertLog.id, claimId),
    ));
}

export async function releaseAlertClaim(
  tenantId: number,
  claimId: string,
): Promise<void> {
  await db
    .delete(alertLog)
    .where(and(
      eq(alertLog.tenantId, tenantId),
      eq(alertLog.id, claimId),
    ));
}

export async function countChannelDispatchesThisMonth(
  tenantId: number,
  channel: DispatchChannel,
  now: Date = new Date(),
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(alertLog)
    .where(and(
      eq(alertLog.tenantId, tenantId),
      eq(alertLog.channel, channel),
      gte(alertLog.sentAt, monthStart(now)),
    ));
  return row?.value ?? 0;
}
