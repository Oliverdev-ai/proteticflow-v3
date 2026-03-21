import { router } from './trpc.js';

import { authRouter } from '../modules/auth/router.js';

// Routers de feature serão adicionados nas fases 4-14
export const appRouter = router({
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
