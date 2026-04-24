import { TRPCError } from '@trpc/server';
import type { Response } from 'express';
import { PLAN_AI_CONFIG, PLAN_TIER, type PlanTier } from '@proteticflow/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { tenants } from '../../db/schema/tenants.js';
import { logger } from '../../logger.js';
import { recordAiRateLimitHit } from '../../metrics/ai-metrics.js';
import { withRedisClient } from '../../redis.js';
import type { RiskLevel } from './command-parser.js';

const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MINUTE_WINDOW_MS = 60_000;
const TTS_REQUESTS_PER_MINUTE = 20;
const FALLBACK_BUCKET_MAX = 2000;

type LocalBucket = {
  count: number;
  expiresAt: number;
};

type RateLimitState = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

export type ToolRateLimitState = RateLimitState & {
  plan: PlanTier;
};

const localBuckets = new Map<string, LocalBucket>();

let nowProvider = () => Date.now();
let incrementBucketOverride: ((key: string, ttlSeconds: number) => Promise<number>) | null = null;

function cleanupExpiredLocalBuckets(now: number): void {
  if (localBuckets.size < FALLBACK_BUCKET_MAX) return;
  for (const [key, bucket] of localBuckets) {
    if (bucket.expiresAt <= now) {
      localBuckets.delete(key);
    }
  }
}

function incrementLocalBucket(key: string, ttlSeconds: number): number {
  const now = nowProvider();
  cleanupExpiredLocalBuckets(now);

  const existing = localBuckets.get(key);
  if (!existing || existing.expiresAt <= now) {
    localBuckets.set(key, {
      count: 1,
      expiresAt: now + ttlSeconds * 1000,
    });
    return 1;
  }

  const next = existing.count + 1;
  localBuckets.set(key, {
    count: next,
    expiresAt: existing.expiresAt,
  });
  return next;
}

async function incrementBucket(key: string, ttlSeconds: number): Promise<number> {
  if (incrementBucketOverride) {
    return incrementBucketOverride(key, ttlSeconds);
  }

  const redisCount = await withRedisClient(async (redis) => {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return count;
  });

  if (redisCount !== null) {
    return redisCount;
  }

  logger.warn({ action: 'ai.rate_limit.redis_unavailable', key }, 'Usando rate-limit local por indisponibilidade de Redis');
  return incrementLocalBucket(key, ttlSeconds);
}

function resolvePlanTier(plan: string): PlanTier {
  if (plan === PLAN_TIER.STARTER || plan === PLAN_TIER.PRO || plan === PLAN_TIER.ENTERPRISE) {
    return plan;
  }
  return PLAN_TIER.TRIAL;
}

async function getTenantPlanTier(tenantId: number): Promise<PlanTier> {
  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });
  }

  return resolvePlanTier(tenant.plan);
}

export async function checkRateLimit(tenantId: number, plan: PlanTier): Promise<RateLimitState> {
  const now = nowProvider();
  const windowIndex = Math.floor(now / DAY_WINDOW_MS);
  const resetAt = (windowIndex + 1) * DAY_WINDOW_MS;
  const ttlSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
  const key = `ai:ratelimit:${tenantId}:${windowIndex}`;

  const config = PLAN_AI_CONFIG[plan];
  const limit = config.callsPerDay;
  const count = await incrementBucket(key, ttlSeconds);
  const remaining = Math.max(0, limit - count);

  return {
    allowed: count <= limit,
    remaining,
    resetAt,
    limit,
  };
}

export async function checkToolRateLimit(
  tenantId: number,
  riskLevel: RiskLevel,
): Promise<ToolRateLimitState | null> {
  if (riskLevel === 'read_only' || riskLevel === 'assistive') {
    return null;
  }

  const plan = await getTenantPlanTier(tenantId);
  const result = await checkRateLimit(tenantId, plan);

  if (!result.allowed) {
    recordAiRateLimitHit(tenantId, plan);
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Limite diario atingido, retoma a meia-noite.',
    });
  }

  return {
    ...result,
    plan,
  };
}

export async function checkTtsRateLimit(
  tenantId: number,
  userId: number,
): Promise<RateLimitState> {
  const now = nowProvider();
  const windowIndex = Math.floor(now / MINUTE_WINDOW_MS);
  const resetAt = (windowIndex + 1) * MINUTE_WINDOW_MS;
  const ttlSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
  const key = `ai:tts:${tenantId}:${userId}:${windowIndex}`;

  const count = await incrementBucket(key, ttlSeconds);
  const remaining = Math.max(0, TTS_REQUESTS_PER_MINUTE - count);
  const allowed = count <= TTS_REQUESTS_PER_MINUTE;

  if (!allowed) {
    recordAiRateLimitHit(tenantId, 'tts');
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'TTS rate limit: 20 requests por minuto.',
    });
  }

  return {
    allowed,
    remaining,
    resetAt,
    limit: TTS_REQUESTS_PER_MINUTE,
  };
}

export function applyRateLimitHeaders(
  res: Response,
  rateLimit: Pick<RateLimitState, 'remaining' | 'resetAt'> | null | undefined,
): void {
  if (!rateLimit) return;
  res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(rateLimit.resetAt / 1000)));
}

export const __testOnly = {
  resetLocalBuckets() {
    localBuckets.clear();
  },
  setNowProvider(provider: (() => number) | null) {
    nowProvider = provider ?? (() => Date.now());
  },
  setIncrementBucketOverride(
    override: ((key: string, ttlSeconds: number) => Promise<number>) | null,
  ) {
    incrementBucketOverride = override;
  },
};
