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
import * as licensingService from './modules/licensing/service.js';

const app = express();

app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      return res.status(400).send('Stripe signature missing');
    }

    try {
      await licensingService.handleStripeWebhook(req.body as Buffer, signature);
      return res.json({ received: true });
    } catch (error) {
      logger.error({ err: error }, 'Stripe webhook error');
      return res.status(400).send('Webhook error');
    }
  },
);

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
