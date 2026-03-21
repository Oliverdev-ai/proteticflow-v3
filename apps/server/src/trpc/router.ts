import { router } from './trpc.js';
import { authRouter } from '../modules/auth/router.js';
import { tenantRouter } from '../modules/tenants/router.js';
import { clientRouter } from '../modules/clients/router.js';
import { pricingRouter } from '../modules/pricing/router.js';
import { jobRouter } from '../modules/jobs/router.js';
import { financialRouter } from '../modules/financial/router.js';

export const appRouter = router({
  auth: authRouter,
  tenant: tenantRouter,
  client: clientRouter,
  pricing: pricingRouter,
  job: jobRouter,
  financial: financialRouter,
});

export type AppRouter = typeof appRouter;
