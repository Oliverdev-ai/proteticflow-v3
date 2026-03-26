import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { pushSubscriptions } from '../../db/schema/users.js';
import { logger } from '../../logger.js';
import { env } from '../../env.js';
import webpush from 'web-push';

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export function getPublicVapidKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}

function configureVapid() {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return false;
  }

  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  return true;
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

  if (!configureVapid()) return { sent: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const invalidSubscriptionIds: number[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }, body);
      sent += 1;
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : undefined;

      if (statusCode === 404 || statusCode === 410) {
        invalidSubscriptionIds.push(sub.id);
      }

      logger.warn(
        {
          action: 'notifications.push.send_failed',
          tenantId,
          userId,
          subscriptionId: sub.id,
          statusCode,
        },
        'Falha ao enviar push para inscricao',
      );
    }
  }

  if (invalidSubscriptionIds.length > 0) {
    await db
      .delete(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.tenantId, tenantId),
        eq(pushSubscriptions.userId, userId),
        inArray(pushSubscriptions.id, invalidSubscriptionIds),
      ));

    logger.info(
      {
        action: 'notifications.push.cleanup',
        tenantId,
        userId,
        removed: invalidSubscriptionIds.length,
      },
      'Inscricoes push invalidas removidas',
    );
  }

  await db
    .update(pushSubscriptions)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.userId, userId)));

  return { sent };
}
