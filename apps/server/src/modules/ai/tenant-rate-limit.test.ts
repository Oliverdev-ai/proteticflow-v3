import { afterEach, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { __testOnly, assertTenantRateLimit } from './tenant-rate-limit.js';

describe('ai tenant rate limit', () => {
  afterEach(() => {
    __testOnly.reset();
    delete process.env.AI_RATE_LIMIT_LLM_PER_MIN;
    delete process.env.AI_RATE_LIMIT_STT_PER_MIN;
  });

  it('aplica limite por tenant no escopo llm', () => {
    process.env.AI_RATE_LIMIT_LLM_PER_MIN = '1';

    assertTenantRateLimit(11, 'llm');

    expect(() => assertTenantRateLimit(11, 'llm')).toThrowError(TRPCError);
  });

  it('mantem contadores isolados por tenant e escopo', () => {
    process.env.AI_RATE_LIMIT_LLM_PER_MIN = '1';
    process.env.AI_RATE_LIMIT_STT_PER_MIN = '1';

    assertTenantRateLimit(21, 'llm');
    assertTenantRateLimit(22, 'llm');
    assertTenantRateLimit(21, 'stt');
    assertTenantRateLimit(22, 'stt');

    expect(() => assertTenantRateLimit(21, 'llm')).toThrowError(TRPCError);
    expect(() => assertTenantRateLimit(22, 'stt')).toThrowError(TRPCError);
  });
});

