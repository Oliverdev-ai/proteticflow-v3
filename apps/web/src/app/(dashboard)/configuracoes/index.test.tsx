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

import SettingsPage from './index';

describe('configuracoes/index', () => {
  it('renderiza tabs', () => {
    const html = renderToString(<SettingsPage />);
    expect(html).toContain('Configuracoes');
  });
});
