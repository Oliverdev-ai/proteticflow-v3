type MetricsNodeEnv = 'development' | 'test' | 'production';

export type MetricsAuthFailure = {
  status: 401 | 503;
  body: {
    error: string;
  };
};

type MetricsAuthInput = {
  nodeEnv: MetricsNodeEnv;
  token: string | undefined;
  authorizationHeader: string | undefined;
};

export function getMetricsAuthFailure(input: MetricsAuthInput): MetricsAuthFailure | null {
  if (input.nodeEnv === 'production' && !input.token) {
    return {
      status: 503,
      body: { error: 'Metrics endpoint not configured' },
    };
  }

  if (!input.token) return null;

  const provided = input.authorizationHeader?.startsWith('Bearer ')
    ? input.authorizationHeader.slice(7)
    : '';

  if (provided !== input.token) {
    return {
      status: 401,
      body: { error: 'Unauthorized' },
    };
  }

  return null;
}
