import { router } from './trpc.js';
import { authRouter } from '../modules/auth/router.js';
import { tenantRouter } from '../modules/tenants/router.js';

export const appRouter = router({
  auth: authRouter,
  tenant: tenantRouter,
});

export type AppRouter = typeof appRouter;
