import { Router as ExpressRouter } from 'express';
import type { Router } from 'express';
import { checkDbConnection } from '../db/index.js';
import { logger } from '../logger.js';

export const healthRouter: Router = ExpressRouter();

healthRouter.get('/health', async (_req, res) => {
  const dbOk = await checkDbConnection();

  const status = dbOk ? 'ok' : 'degraded';
  const httpStatus = dbOk ? 200 : 503;

  logger.info({ status, dbOk }, 'Health check');

  res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'ok' : 'error',
    },
  });
});
