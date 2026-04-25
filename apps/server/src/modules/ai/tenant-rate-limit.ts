import { TRPCError } from '@trpc/server';
import { logger } from '../../logger.js';

export type AiRateLimitScope = 'llm' | 'stt' | 'tts';

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60_000;
const DEFAULT_LIMITS: Record<AiRateLimitScope, number> = {
  llm: 30,
  stt: 20,
  tts: 20,
};

const scopeEnvMap: Record<AiRateLimitScope, string> = {
  llm: 'AI_RATE_LIMIT_LLM_PER_MIN',
  stt: 'AI_RATE_LIMIT_STT_PER_MIN',
  tts: 'AI_RATE_LIMIT_TTS_PER_MIN',
};

const buckets = new Map<string, Bucket>();

function getLimit(scope: AiRateLimitScope): number {
  const raw = process.env[scopeEnvMap[scope]];
  const parsed = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMITS[scope];
  }
  return Math.floor(parsed);
}

function cleanupExpiredBuckets(now: number): void {
  if (buckets.size < 200) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function assertTenantRateLimit(tenantId: number, scope: AiRateLimitScope): void {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const key = `${scope}:${tenantId}`;
  const limit = getLimit(scope);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (current.count >= limit) {
    const retryAfterMs = Math.max(current.resetAt - now, 0);
    logger.warn(
      {
        action: 'ai.rate_limit.hit',
        tenantId,
        scope,
        limit,
        retryAfterMs,
      },
      'Tenant excedeu limite de requisicoes IA',
    );
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Limite de uso de IA atingido para este tenant. Tente novamente em ${Math.ceil(retryAfterMs / 1000)}s.`,
    });
  }

  current.count += 1;
  buckets.set(key, current);
}

export const __testOnly = {
  reset() {
    buckets.clear();
  },
};

