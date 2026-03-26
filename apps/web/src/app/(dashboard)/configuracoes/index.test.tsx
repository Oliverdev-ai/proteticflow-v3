import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

vi.mock('../../../hooks/use-permissions', () => ({
  usePermissions: () => ({ hasAccess: () => true }),
}));

vi.mock('../../../hooks/use-settings', () => ({
  useSettings: () => ({
    overview: { isLoading: false, error: null, data: { users: [], identity: {}, branding: {}, printer: {}, smtp: {}, plan: {} } },
  }),
}));

vi.mock('../../../lib/trpc', () => {
  const q = () => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
  const m = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  const createProxy = (): Record<string, unknown> =>
    new Proxy({} as Record<string, unknown>, {
      get: (_, k) => {
        if (k === 'useQuery') return q;
        if (k === 'useMutation') return m;
        if (k === 'useUtils') return () => createProxy();
        return createProxy();
      },
    });
  return { trpc: createProxy() };
});

import SettingsPage from './index';

describe('configuracoes/index', () => {
  it('renderiza tabs', () => {
    const html = renderToString(<SettingsPage />);
    expect(html).toContain('Configuracoes');
  });
});
