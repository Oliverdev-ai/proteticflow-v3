import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

vi.mock('../../hooks/use-settings', () => ({
  useSettings: () => ({
    overview: { data: { users: [] } },
  }),
}));

import { TeamUsersTable } from './team-users-table';

describe('team-users-table', () => {
  it('renderiza empty state', () => {
    const html = renderToString(<TeamUsersTable />);
    expect(html).toContain('Nenhum usuario');
  });
});
