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

type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, unknown>;
};

function parseRedisUrl(url: string): RedisConnectionOptions {
  const parsed = new URL(url);
  const port = parsed.port.length > 0 ? Number.parseInt(parsed.port, 10) : 6379;
  const dbFromPath = parsed.pathname.replace('/', '');
  const db = dbFromPath.length > 0 ? Number.parseInt(dbFromPath, 10) : 0;

  return {
    host: parsed.hostname,
    port: Number.isFinite(port) ? port : 6379,
    ...(parsed.username.length > 0 ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password.length > 0 ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(Number.isFinite(db) ? { db } : {}),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

export function getRedisUrl(): string {
  return redisUrl;
}

export function getRedisConnectionOptions(): RedisConnectionOptions {
  return parseRedisUrl(redisUrl);
}

let redis: Redis | null = null;
let redisDisabled = false;
let redisDisabledLogged = false;

function isRecoverableConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String(err.code ?? '') : '';
  return ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT'].includes(code);
}

function disableRedis(err?: unknown): void {
  redisDisabled = true;

  if (redis) {
    redis.disconnect();
    redis = null;
  }

  if (!redisDisabledLogged) {
    redisDisabledLogged = true;
    logger.warn(
      { err, redisRequired: env.REDIS_REQUIRED, redisUrl },
      'Redis indisponivel; backend segue em modo degradado (sem cache/distributed locks).',
    );
  }
}

function getRedisClient(): Redis | null {
  if (redisDisabled && !env.REDIS_REQUIRED) return null;
  if (redis) return redis;

  redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (!env.REDIS_REQUIRED && times > 1) return null;
      return Math.min(times * 100, 2000);
    },
  });

  redis.on('connect', () => {
    logger.info({ action: 'redis.connection.connected' }, 'Connected to Redis');
  });

  redis.on('error', (err) => {
    if (!env.REDIS_REQUIRED && isRecoverableConnectionError(err)) {
      disableRedis(err);
      return;
    }
    logger.error({ err }, 'Redis connection error');
  });

  return redis;
}

export async function checkRedisConnection(): Promise<boolean> {
  if (redisDisabled && !env.REDIS_REQUIRED) return false;

  const client = getRedisClient();
  if (!client) return false;

  try {
    if (client.status === 'wait') {
      await client.connect();
    }
    const result = await client.ping();
    return result === 'PONG';
  } catch (err) {
    if (!env.REDIS_REQUIRED) {
      const isClosedConnection =
        err instanceof Error && /connection is closed/i.test(err.message);
      if (isRecoverableConnectionError(err) || isClosedConnection || redisDisabled) {
        disableRedis(err);
        return false;
      }
    }
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
}

export async function withRedisClient<T>(
  operation: (client: Redis) => Promise<T>,
): Promise<T | null> {
  if (redisDisabled && !env.REDIS_REQUIRED) return null;

  const client = getRedisClient();
  if (!client) return null;

  try {
    if (client.status === 'wait') {
      await client.connect();
    }
    return await operation(client);
  } catch (err) {
    if (!env.REDIS_REQUIRED) {
      const isClosedConnection =
        err instanceof Error && /connection is closed/i.test(err.message);
      if (isRecoverableConnectionError(err) || isClosedConnection || redisDisabled) {
        disableRedis(err);
        return null;
      }
    }
    throw err;
  }
}
