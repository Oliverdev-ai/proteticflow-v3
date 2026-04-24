import { afterEach, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { PLAN_TIER } from '@proteticflow/shared';
import { __testOnly, applyRateLimitHeaders, checkRateLimit, checkTtsRateLimit } from './rate-limit.js';

describe('ai/rate-limit', () => {
  afterEach(() => {
    __testOnly.setNowProvider(null);
    __testOnly.setIncrementBucketOverride(null);
    __testOnly.resetLocalBuckets();
  });

  it('retorna allowed=false quando excede limite diario do plano', async () => {
    const counts = new Map<string, number>();
    __testOnly.setIncrementBucketOverride(async (key) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    });
    __testOnly.setNowProvider(() => Date.UTC(2026, 3, 24, 12, 0, 0));

    for (let idx = 0; idx < 10; idx += 1) {
      const result = await checkRateLimit(7, PLAN_TIER.STARTER);
      expect(result.allowed).toBe(true);
    }

    const blocked = await checkRateLimit(7, PLAN_TIER.STARTER);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('aplica limite de 20 req/min para TTS por tenant+usuario', async () => {
    const counts = new Map<string, number>();
    __testOnly.setIncrementBucketOverride(async (key) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    });
    __testOnly.setNowProvider(() => Date.UTC(2026, 3, 24, 12, 0, 0));

    for (let idx = 0; idx < 20; idx += 1) {
      const result = await checkTtsRateLimit(10, 33);
      expect(result.allowed).toBe(true);
    }

    await expect(checkTtsRateLimit(10, 33)).rejects.toBeInstanceOf(TRPCError);
  });

  it('escreve headers de rate-limit na resposta HTTP', () => {
    const headers = new Map<string, string>();
    const response = {
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
    } as unknown as Parameters<typeof applyRateLimitHeaders>[0];

    applyRateLimitHeaders(response, {
      remaining: 9,
      resetAt: 1713964800000,
    });

    expect(headers.get('X-RateLimit-Remaining')).toBe('9');
    expect(headers.get('X-RateLimit-Reset')).toBe('1713964800');
  });
});
