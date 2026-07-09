import { describe, expect, it } from 'vitest';
import { buildAuthLimiterOptions, buildGlobalLimiterOptions } from './rate-limit.js';

describe('rate-limit middleware', () => {
  it('usa req.ip do Express sem keyGenerator baseado em x-forwarded-for cru', () => {
    const globalOptions = buildGlobalLimiterOptions();
    const authOptions = buildAuthLimiterOptions();

    expect('keyGenerator' in globalOptions).toBe(false);
    expect('keyGenerator' in authOptions).toBe(false);
    expect(globalOptions.windowMs).toBe(60 * 1000);
    expect(authOptions.windowMs).toBe(15 * 60 * 1000);
    expect(authOptions.limit).toBe(10);
  });
});
