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
import * as fiscalService from './modules/fiscal/service.js';
import { securityHeaders } from './middleware/security-headers.js';
import { globalLimiter, authLimiter } from './middleware/rate-limit.js';
import { requestLogger } from './middleware/request-logger.js';
import { initSentry } from './core/sentry.js';
import { ensureBucket } from './core/storage-bootstrap.js';
import { handleWhatsappWebhook, WhatsappWebhookError } from './modules/messaging/webhook.service.js';
import { AsaasWebhookError } from './modules/fiscal/service.js';

const app = express();
initSentry();

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(globalLimiter);
app.use(requestLogger);

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

app.post(
  '/webhooks/asaas',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? '');
      const webhookInput: Parameters<typeof fiscalService.handleAuthenticatedAsaasWebhook>[0] = {
        rawBody,
      };
      const accessToken = req.header('asaas-access-token');
      if (accessToken) webhookInput.accessToken = accessToken;
      const result = await fiscalService.handleAuthenticatedAsaasWebhook(webhookInput);
      return res.status(200).json({ received: result.accepted, replay: result.replay });
    } catch (error) {
      if (error instanceof AsaasWebhookError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      logger.error({ err: error }, 'Asaas webhook error');
      return res.status(500).json({ error: 'Webhook error' });
    }
  },
);

app.post(
  '/webhooks/whatsapp/:tenantSlug',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const tenantSlug = String(req.params['tenantSlug'] ?? '');
    const signature = req.header('x-whatsapp-signature')
      ?? req.header('x-hub-signature-256')
      ?? req.header('x-signature')
      ?? '';

    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');
      const result = await handleWhatsappWebhook({
        tenantSlug,
        rawBody,
        signature,
      });
      return res.status(200).json({ received: result.accepted, replay: result.replay });
    } catch (error) {
      if (error instanceof WhatsappWebhookError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      logger.error({ err: error, tenantSlug }, 'WhatsApp webhook error');
      return res.status(500).json({ error: 'Webhook error' });
    }
  },
);

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health check (sem auth)
app.use(healthRouter);

// tRPC
app.use('/trpc/auth.login', authLimiter);
app.use('/trpc/auth.register', authLimiter);
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

  ensureBucket().catch(() => {
    logger.warn('Storage bucket bootstrap failed - uploads may fail');
  });
});
