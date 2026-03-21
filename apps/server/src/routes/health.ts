import { Router as ExpressRouter } from 'express';
import type { Router } from 'express';
import { checkDbConnection } from '../db/index.js';
import { checkRedisConnection } from '../redis.js';
import { logger } from '../logger.js';

export const healthRouter: Router = ExpressRouter();

healthRouter.get('/health', async (_req, res) => {
  const dbOk = await checkDbConnection();
  const redisOk = await checkRedisConnection();

  const status = (dbOk && redisOk) ? 'ok' : 'degraded';
  const httpStatus = (dbOk && redisOk) ? 200 : 503;

  logger.info({ status, dbOk, redisOk }, 'Health check');

  res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'ok' : 'error',
      redis: redisOk ? 'ok' : 'error',
    },
  });
});
