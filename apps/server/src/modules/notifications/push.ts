import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { pushSubscriptions } from '../../db/schema/users.js';
import { logger } from '../../logger.js';
import { env } from '../../env.js';

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export function getPublicVapidKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}

export async function sendPushToUser(tenantId: number, userId: number, payload: PushPayload) {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.userId, userId)));

  if (subs.length === 0) return { sent: 0 };

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    logger.warn(
      { action: 'notifications.push.skipped', tenantId, userId, subscriptions: subs.length },
      'VAPID nao configurado. Push nao enviado.',
    );
    return { sent: 0 };
  }

  // Stub sem dependencia externa.
  logger.info(
    { action: 'notifications.push.stub_send', tenantId, userId, subscriptions: subs.length, payload },
    'Push preparado para envio',
  );

  await db
    .update(pushSubscriptions)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.userId, userId)));

  return { sent: subs.length };
}
