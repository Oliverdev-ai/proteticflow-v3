import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

vi.mock('../../lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      notification: {
        listPreferences: { invalidate: vi.fn(async () => undefined) },
      },
    }),
    notification: {
      listPreferences: {
        useQuery: () => ({
          data: [{ eventKey: 'deadline_24h', inAppEnabled: true, pushEnabled: false, emailEnabled: true }],
        }),
      },
      vapidPublicKey: {
        useQuery: () => ({ data: { key: null } }),
      },
      testDispatch: {
        useMutation: () => ({ mutate: vi.fn() }),
      },
      upsertPreference: {
        useMutation: () => ({ mutate: vi.fn() }),
      },
      savePushSubscription: {
        useMutation: () => ({ mutateAsync: vi.fn(async () => undefined) }),
      },
    },
  },
}));

import { NotificationsTab } from './notifications-tab';

describe('notifications-tab', () => {
  it('renderiza preferencias por canal', () => {
    const html = renderToString(<NotificationsTab />);

    expect(html).toContain('Matriz de Conectividade');
    expect(html).toContain('Alerta de prazo em 24h');
    expect(html).toContain('Ativar Push (PWA)');
  });
});
