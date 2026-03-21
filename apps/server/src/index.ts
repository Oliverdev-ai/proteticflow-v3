import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { env } from './env.js';
import { logger } from './logger.js';
import { db } from './db/index.js';
import { createContext } from './trpc/context.js';
import { appRouter } from './trpc/router.js';
import { healthRouter } from './routes/health.js';
import { startCronJobs } from './cron/scheduler.js';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health check (sem auth)
app.use(healthRouter);

// tRPC
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: createContext(db),
  }),
);

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server iniciado');
  
  if (env.NODE_ENV !== 'test') {
    startCronJobs();
  }
});
