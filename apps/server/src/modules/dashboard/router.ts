import { router, tenantProcedure } from '../../trpc/trpc.js';
import { getDashboardSummary } from './service.js';

export const dashboardRouter = router({
  getSummary: tenantProcedure.query(({ ctx }) =>
    getDashboardSummary(ctx.tenantId!),
  ),
});
