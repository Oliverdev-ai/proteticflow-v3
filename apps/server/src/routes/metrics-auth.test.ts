import { describe, expect, it } from 'vitest';
import { getMetricsAuthFailure } from './metrics-auth.js';

describe('metrics auth', () => {
  it('permite acesso local sem token configurado', () => {
    expect(getMetricsAuthFailure({
      nodeEnv: 'development',
      token: undefined,
      authorizationHeader: undefined,
    })).toBeNull();
  });

  it('desabilita metrics em producao sem token configurado', () => {
    expect(getMetricsAuthFailure({
      nodeEnv: 'production',
      token: undefined,
      authorizationHeader: undefined,
    })).toEqual({
      status: 503,
      body: { error: 'Metrics endpoint not configured' },
    });
  });

  it('rejeita bearer ausente ou incorreto quando token esta configurado', () => {
    expect(getMetricsAuthFailure({
      nodeEnv: 'production',
      token: 'secret-token',
      authorizationHeader: undefined,
    })).toEqual({
      status: 401,
      body: { error: 'Unauthorized' },
    });

    expect(getMetricsAuthFailure({
      nodeEnv: 'test',
      token: 'secret-token',
      authorizationHeader: 'Bearer wrong-token',
    })).toEqual({
      status: 401,
      body: { error: 'Unauthorized' },
    });
  });

  it('permite bearer correto quando token esta configurado', () => {
    expect(getMetricsAuthFailure({
      nodeEnv: 'production',
      token: 'secret-token',
      authorizationHeader: 'Bearer secret-token',
    })).toBeNull();
  });
});
