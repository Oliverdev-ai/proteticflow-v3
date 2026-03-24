import { router, adminProcedure, tenantProcedure } from '../../trpc/trpc.js';
import {
  getSettingsOverviewSchema,
  removeLogoSchema,
  testSmtpConnectionSchema,
  updateLabBrandingSchema,
  updateLabIdentitySchema,
  updatePrinterSettingsSchema,
  updateSmtpSettingsSchema,
  updateUserRoleFromSettingsSchema,
  uploadLogoSchema,
} from '@proteticflow/shared';
import * as settingsService from './service.js';

export const settingsRouter = router({
  getSettingsOverview: tenantProcedure
    .input(getSettingsOverviewSchema.optional())
    .query(({ ctx, input }) => {
      return settingsService.getSettingsOverview(ctx.tenantId!, input?.includeUsers ?? false);
    }),

  updateLabIdentity: adminProcedure
    .input(updateLabIdentitySchema)
    .mutation(({ ctx, input }) => {
      return settingsService.updateLabIdentity(ctx.tenantId!, ctx.user!.id, input);
    }),

  updateLabBranding: adminProcedure
    .input(updateLabBrandingSchema)
    .mutation(({ ctx, input }) => {
      return settingsService.updateLabBranding(ctx.tenantId!, ctx.user!.id, input);
    }),

  uploadLogo: adminProcedure
    .input(uploadLogoSchema)
    .mutation(({ ctx, input }) => {
      return settingsService.uploadLogo(ctx.tenantId!, ctx.user!.id, input);
    }),

  removeLogo: adminProcedure
    .input(removeLogoSchema)
    .mutation(({ ctx }) => {
      return settingsService.removeLogo(ctx.tenantId!, ctx.user!.id);
    }),

  updatePrinterSettings: adminProcedure
    .input(updatePrinterSettingsSchema)
    .mutation(({ ctx, input }) => {
      return settingsService.updatePrinterSettings(ctx.tenantId!, ctx.user!.id, input);
    }),

  updateSmtpSettings: adminProcedure
    .input(updateSmtpSettingsSchema)
    .mutation(({ ctx, input }) => {
      return settingsService.updateSmtpSettings(ctx.tenantId!, ctx.user!.id, input);
    }),

  testSmtpConnection: adminProcedure
    .input(testSmtpConnectionSchema.optional())
    .mutation(({ ctx }) => {
      return settingsService.testSmtpConnection(ctx.tenantId!, ctx.user!.id);
    }),

  listUsers: adminProcedure.query(({ ctx }) => {
    return settingsService.listUsers(ctx.tenantId!);
  }),

  updateUserRoleFromSettings: adminProcedure
    .input(updateUserRoleFromSettingsSchema)
    .mutation(({ ctx, input }) => {
      return settingsService.updateUserRole(ctx.tenantId!, ctx.user!.id, input);
    }),
});
