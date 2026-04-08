import {
  createCheckoutSessionSchema,
  superadminUpdateTenantPlanSchema,
} from '@proteticflow/shared';
import {
  router,
  superadminProcedure,
  tenantProcedure,
} from '../../trpc/trpc.js';
import * as licensingService from './service.js';

export const licensingRouter = router({
  getStatus: tenantProcedure
    .query(({ ctx }) => licensingService.getLicenseStatus(ctx.tenantId!)),

  createCheckoutSession: tenantProcedure
    .input(createCheckoutSessionSchema)
    .mutation(({ ctx, input }) => licensingService.createCheckoutSession(ctx.tenantId!, input)),

  createBillingPortalSession: tenantProcedure
    .mutation(({ ctx }) => licensingService.createBillingPortalSession(ctx.tenantId!)),

  adminUpdatePlan: superadminProcedure
    .input(superadminUpdateTenantPlanSchema)
    .mutation(({ input }) => licensingService.adminUpdatePlan(input)),

  adminListTenants: superadminProcedure
    .query(() => licensingService.listAllTenantsAdmin()),
});
