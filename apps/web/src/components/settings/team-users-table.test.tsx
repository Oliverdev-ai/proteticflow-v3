import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

vi.mock('../../hooks/use-settings', () => ({
  useSettings: () => ({
    overview: { data: { users: [] }, refetch: vi.fn() },
    updateRole: vi.fn(),
  }),
}));

vi.mock('../../lib/trpc', () => ({
  trpc: {
    useUtils: () => ({}),
    tenant: {
      invite: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

import { TeamUsersTable } from './team-users-table';

describe('team-users-table', () => {
  it('renderiza empty state', () => {
    const html = renderToString(<TeamUsersTable />);
    expect(html).toContain('Nenhum usuario');
  });
});
