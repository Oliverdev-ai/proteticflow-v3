import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  notifications,
  notificationPreferences,
} from '../../db/schema/notifications.js';
import { pushSubscriptions, users } from '../../db/schema/users.js';
import type {
  listNotificationsSchema,
  notificationEventSchema,
  notificationTypeSchema,
  savePushSubscriptionSchema,
  upsertNotificationPreferenceSchema,
} from '@proteticflow/shared';
import type { z } from 'zod';
import { sendPushToUser } from './push.js';
import { sendEmail } from './email.js';
import { logger } from '../../logger.js';

type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
type NotificationType = z.infer<typeof notificationTypeSchema>;
type NotificationEvent = z.infer<typeof notificationEventSchema>;
type PreferenceInput = z.infer<typeof upsertNotificationPreferenceSchema>;
type SubscriptionInput = z.infer<typeof savePushSubscriptionSchema>;

const DEFAULT_EVENTS: NotificationEvent[] = [
  'invite',
  'password_reset',
  'report_ready',
  'deadline_24h',
  'ar_overdue',
];

function normalizeType(type: NotificationType): 'info' | 'warning' | 'error' {
  if (type === 'error') return 'error';
  if (type === 'warning') return 'warning';
  return 'info';
}

export async function listUserNotifications(tenantId: number, userId: number, input: ListNotificationsInput) {
  const whereConditions = [
    eq(notifications.tenantId, tenantId),
    eq(notifications.userId, userId),
    input.unreadOnly ? eq(notifications.isRead, false) : undefined,
  ];

  return db
    .select({
      id: notifications.id,
      title: notifications.title,
      message: notifications.message,
      type: notifications.type,
      eventKey: notifications.eventKey,
      isRead: notifications.isRead,
      relatedJobId: notifications.relatedJobId,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(...whereConditions))
    .orderBy(desc(notifications.createdAt))
    .limit(input.limit);
}

export async function countUnread(tenantId: number, userId: number) {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(
      eq(notifications.tenantId, tenantId),
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
    ));

  return row?.value ?? 0;
}

export async function markRead(tenantId: number, userId: number, ids: number[]) {
  if (ids.length === 0) return { updated: 0 };

  const updated = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(
      eq(notifications.tenantId, tenantId),
      eq(notifications.userId, userId),
      inArray(notifications.id, ids),
    ))
    .returning({ id: notifications.id });

  return { updated: updated.length };
}

export async function markAllRead(tenantId: number, userId: number) {
  const updated = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(
      eq(notifications.tenantId, tenantId),
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
    ))
    .returning({ id: notifications.id });

  return { updated: updated.length };
}

export async function listPreferences(tenantId: number, userId: number) {
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.tenantId, tenantId),
      eq(notificationPreferences.userId, userId),
    ));

  const map = new Map(existing.map((item) => [item.eventKey, item]));
  return DEFAULT_EVENTS.map((eventKey) => {
    const pref = map.get(eventKey);
    return {
      eventKey,
      inAppEnabled: pref?.inAppEnabled ?? true,
      pushEnabled: pref?.pushEnabled ?? true,
      emailEnabled: pref?.emailEnabled ?? true,
    };
  });
}

export async function upsertPreference(tenantId: number, userId: number, input: PreferenceInput) {
  const [existing] = await db
    .select({ id: notificationPreferences.id })
    .from(notificationPreferences)
    .where(and(
      eq(notificationPreferences.tenantId, tenantId),
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.eventKey, input.eventKey),
    ));

  if (existing) {
    const [updated] = await db
      .update(notificationPreferences)
      .set({
        inAppEnabled: input.inAppEnabled,
        pushEnabled: input.pushEnabled,
        emailEnabled: input.emailEnabled,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(notificationPreferences)
    .values({
      tenantId,
      userId,
      eventKey: input.eventKey,
      inAppEnabled: input.inAppEnabled,
      pushEnabled: input.pushEnabled,
      emailEnabled: input.emailEnabled,
    })
    .returning();

  return created;
}

export async function savePushSubscription(tenantId: number, userId: number, input: SubscriptionInput, userAgent?: string) {
  const [existing] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.userId, userId),
      eq(pushSubscriptions.endpoint, input.endpoint),
    ));

  if (existing) {
    const [updated] = await db
      .update(pushSubscriptions)
      .set({
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: userAgent ?? null,
        lastUsedAt: new Date(),
      })
      .where(eq(pushSubscriptions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(pushSubscriptions)
    .values({
      tenantId,
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: userAgent ?? null,
    })
    .returning();

  return created;
}

export async function deletePushSubscription(tenantId: number, userId: number, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(and(
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.userId, userId),
      eq(pushSubscriptions.endpoint, endpoint),
    ));

  return { success: true };
}

export async function createInAppNotification(args: {
  tenantId: number;
  userId: number;
  eventKey: NotificationEvent;
  type: NotificationType;
  title: string;
  message: string;
  relatedJobId?: number | null;
}) {
  const [created] = await db
    .insert(notifications)
    .values({
      tenantId: args.tenantId,
      userId: args.userId,
      eventKey: args.eventKey,
      type: normalizeType(args.type),
      title: args.title,
      message: args.message,
      relatedJobId: args.relatedJobId ?? null,
    })
    .returning();

  return created;
}

export async function dispatchByPreference(args: {
  tenantId: number;
  userId: number;
  eventKey: NotificationEvent;
  type: NotificationType;
  title: string;
  message: string;
  relatedJobId?: number | null;
  emailSubject?: string;
  emailText?: string;
}) {
  const prefs = await listPreferences(args.tenantId, args.userId);
  const pref = prefs.find((item) => item.eventKey === args.eventKey);

  if (!pref || pref.inAppEnabled) {
    await createInAppNotification({
      tenantId: args.tenantId,
      userId: args.userId,
      eventKey: args.eventKey,
      type: args.type,
      title: args.title,
      message: args.message,
      relatedJobId: args.relatedJobId,
    });
  }

  if (pref?.pushEnabled !== false) {
    await sendPushToUser(args.tenantId, args.userId, {
      title: args.title,
      body: args.message,
      url: args.relatedJobId ? `/trabalhos/${args.relatedJobId}` : '/',
    });
  }

  if (pref?.emailEnabled !== false) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, args.userId));

    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: args.emailSubject ?? args.title,
        text: args.emailText ?? args.message,
      });
    }
  }

  logger.info(
    { action: 'notifications.dispatch', tenantId: args.tenantId, userId: args.userId, eventKey: args.eventKey },
    'Notificacao processada por preferencias de canal',
  );
}

export const __testOnly = {
  normalizeType,
};
