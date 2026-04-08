import { z } from 'zod';

export const notificationTypeSchema = z.enum(['info', 'warning', 'error']);
export const notificationEventSchema = z.enum([
  'invite',
  'password_reset',
  'report_ready',
  'deadline_24h',
  'ar_overdue',
]);

export const listNotificationsSchema = z.object({
  unreadOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(20),
});

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export const upsertNotificationPreferenceSchema = z.object({
  eventKey: notificationEventSchema,
  inAppEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
});

export const savePushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const deletePushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});

export const NOTIFICATION_EVENT_LABELS: Record<z.infer<typeof notificationEventSchema>, string> = {
  invite: 'Convites',
  password_reset: 'Reset de senha',
  report_ready: 'Relatorios por email',
  deadline_24h: 'Alerta de prazo em 24h',
  ar_overdue: 'Lembrete de contas vencidas',
};
