import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, router, tenantProcedure } from '../../trpc/trpc.js';
import {
  deletePushSubscriptionSchema,
  listNotificationsSchema,
  markNotificationsReadSchema,
  muteAlertsSchema,
  savePushSubscriptionSchema,
  updateUserPreferencesSchema,
  upsertNotificationPreferenceSchema,
} from '@proteticflow/shared';
import { getPublicVapidKey } from './push.js';
import * as notificationService from './service.js';
import * as proactivePreferencesService from '../proactive/preferences.service.js';

export const notificationRouter = router({
  list: tenantProcedure
    .input(listNotificationsSchema)
    .query(({ ctx, input }) => notificationService.listUserNotifications(ctx.tenantId!, ctx.user!.id, input)),

  unreadCount: tenantProcedure
    .query(({ ctx }) => notificationService.countUnread(ctx.tenantId!, ctx.user!.id)),

  markRead: tenantProcedure
    .input(markNotificationsReadSchema)
    .mutation(({ ctx, input }) => notificationService.markRead(ctx.tenantId!, ctx.user!.id, input.ids)),

  markAllRead: tenantProcedure
    .mutation(({ ctx }) => notificationService.markAllRead(ctx.tenantId!, ctx.user!.id)),

  listPreferences: tenantProcedure
    .query(({ ctx }) => notificationService.listPreferences(ctx.tenantId!, ctx.user!.id)),

  getUserPreferences: tenantProcedure
    .query(({ ctx }) => proactivePreferencesService.getUserPreferences(ctx.tenantId!, ctx.user!.id)),

  updateUserPreferences: tenantProcedure
    .input(updateUserPreferencesSchema)
    .mutation(({ ctx, input }) =>
      proactivePreferencesService.updateUserPreferences(ctx.tenantId!, ctx.user!.id, input)),

  muteAlerts: tenantProcedure
    .input(muteAlertsSchema)
    .mutation(({ ctx, input }) => {
      const targetUserId = input.userId ?? ctx.user!.id;
      const canMuteOtherUsers = ctx.user!.role === 'superadmin' || ctx.user!.role === 'gerente';
      if (targetUserId !== ctx.user!.id && !canMuteOtherUsers) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissao para alterar preferencias de outro usuario' });
      }
      return proactivePreferencesService.muteAlerts(ctx.tenantId!, ctx.user!.id, input);
    }),

  upsertPreference: tenantProcedure
    .input(upsertNotificationPreferenceSchema)
    .mutation(({ ctx, input }) => notificationService.upsertPreference(ctx.tenantId!, ctx.user!.id, input)),

  savePushSubscription: tenantProcedure
    .input(savePushSubscriptionSchema)
    .mutation(({ ctx, input }) => {
      const userAgent = typeof ctx.req.headers['user-agent'] === 'string' ? ctx.req.headers['user-agent'] : undefined;
      return notificationService.savePushSubscription(ctx.tenantId!, ctx.user!.id, input, userAgent);
    }),

  deletePushSubscription: tenantProcedure
    .input(deletePushSubscriptionSchema)
    .mutation(({ ctx, input }) => notificationService.deletePushSubscription(ctx.tenantId!, ctx.user!.id, input.endpoint)),

  vapidPublicKey: tenantProcedure
    .query(() => ({ key: getPublicVapidKey() })),

  testDispatch: adminProcedure
    .input(z.object({ message: z.string().min(1).max(200).default('Teste de notificacao') }))
    .mutation(async ({ ctx, input }) => {
      await notificationService.dispatchByPreference({
        tenantId: ctx.tenantId!,
        userId: ctx.user!.id,
        eventKey: 'report_ready',
        type: 'info',
        title: 'Teste de notificacao',
        message: input.message,
      });
      return { success: true };
    }),
});
