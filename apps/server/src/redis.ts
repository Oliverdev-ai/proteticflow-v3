import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

const redisUrl =
  process.platform === 'win32'
    ? env.REDIS_URL.replace(/localhost(?=[:/])/i, '127.0.0.1')
    : env.REDIS_URL;

if (redisUrl !== env.REDIS_URL) {
  logger.info({ action: 'redis.connection.normalize_ipv4' }, 'REDIS_URL normalizado para IPv4 no Windows');
}

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
}
