import { Router as ExpressRouter } from 'express';
import type { Router } from 'express';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { s3 } from '../core/storage.js';
import { checkDbConnection } from '../db/index.js';
import { env } from '../env.js';
import { checkRedisConnection } from '../redis.js';
import { logger } from '../logger.js';

export const healthRouter: Router = ExpressRouter();

async function checkStorageConnection(): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.MINIO_BUCKET ?? 'proteticflow' }));
    return true;
  } catch {
    return false;
  }
}

healthRouter.get('/health', async (_req, res) => {
  const dbOk = await checkDbConnection();
  const redisOk = await checkRedisConnection();
  const storageOk = await checkStorageConnection();

  const status = dbOk ? (redisOk && storageOk ? 'ok' : 'degraded') : 'error';
  const httpStatus = dbOk ? 200 : 503;

  logger.info({ status, dbOk, redisOk, storageOk }, 'Health check');

  res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'ok' : 'error',
      redis: redisOk ? 'ok' : 'error',
      storage: storageOk ? 'ok' : 'error',
    },
  });
});
