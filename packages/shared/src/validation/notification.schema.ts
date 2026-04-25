import { z } from 'zod';

export const notificationTypeSchema = z.enum(['info', 'warning', 'error']);
export const notificationEventSchema = z.enum([
  'invite',
  'password_reset',
  'report_ready',
  'deadline_24h',
  'ar_overdue',
  'trial_expiring',
  'payment_overdue',
  'plan_upgraded',
]);

export const proactiveAlertTypeSchema = z.enum([
  'briefing_daily',
  'deadline_24h',
  'deadline_overdue',
  'stock_low',
  'payment_overdue',
]);

const hhmmSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Formato esperado HH:MM');

export const proactiveChannelsSchema = z.object({
  push: z.boolean(),
  email: z.boolean(),
  whatsapp: z.boolean(),
  in_app: z.boolean(),
  mutedUntilByType: z.record(z.string(), z.string().datetime()).optional(),
});

export const userPreferencesSchema = z.object({
  briefingEnabled: z.boolean(),
  briefingTime: hhmmSchema,
  quietHoursStart: hhmmSchema,
  quietHoursEnd: hhmmSchema,
  quietModeEnabled: z.boolean(),
  quietModeStart: hhmmSchema,
  quietModeEnd: hhmmSchema,
  channels: proactiveChannelsSchema,
  alertTypesMuted: z.array(proactiveAlertTypeSchema),
  updatedAt: z.string().datetime(),
});

export const updateUserPreferencesSchema = z.object({
  briefingEnabled: z.boolean().optional(),
  briefingTime: hhmmSchema.optional(),
  quietHoursStart: hhmmSchema.optional(),
  quietHoursEnd: hhmmSchema.optional(),
  quietModeEnabled: z.boolean().optional(),
  quietModeStart: hhmmSchema.optional(),
  quietModeEnd: hhmmSchema.optional(),
  channels: proactiveChannelsSchema.partial().optional(),
  alertTypesMuted: z.array(proactiveAlertTypeSchema).optional(),
});

export const muteAlertsSchema = z.object({
  userId: z.number().int().positive().optional(),
  alertTypes: z.array(proactiveAlertTypeSchema).min(1),
  until: z.string().datetime().optional(),
});

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
  trial_expiring: 'Aviso de trial expirando',
  payment_overdue: 'Pagamento em atraso',
  plan_upgraded: 'Upgrade de plano',
};

export const PROACTIVE_ALERT_LABELS: Record<z.infer<typeof proactiveAlertTypeSchema>, string> = {
  briefing_daily: 'Briefing diário',
  deadline_24h: 'Prazo em 24h',
  deadline_overdue: 'Prazo atrasado',
  stock_low: 'Estoque baixo',
  payment_overdue: 'Pagamento em atraso',
};

export type ProactiveAlertType = z.infer<typeof proactiveAlertTypeSchema>;
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;
export type MuteAlertsInput = z.infer<typeof muteAlertsSchema>;
