import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

vi.mock('../../hooks/use-settings', () => ({
  useSettings: () => ({
    overview: {
      data: {
        plan: {
          current: 'trial',
          planExpiresAt: null,
          clientCount: 1,
          jobCountThisMonth: 2,
          userCount: 3,
          priceTableCount: 4,
          storageUsedMb: 5,
        },
      },
    },
  }),
}));

import { PlanSummary } from './plan-summary';

describe('plan-summary', () => {
  it('renderiza limites', () => {
    const html = renderToString(<PlanSummary />);
    expect(html).toContain('trial');
    expect(html).toContain('Clientes');
  });
});
