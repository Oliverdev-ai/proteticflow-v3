import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';

vi.mock('../../lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      notification: {
        unreadCount: { invalidate: vi.fn(async () => undefined) },
        list: { invalidate: vi.fn(async () => undefined) },
      },
    }),
    notification: {
      unreadCount: {
        useQuery: () => ({ data: 3 }),
      },
      list: {
        useQuery: () => ({
          data: [
            { id: 1, title: 'I', message: 'info', type: 'info', isRead: false },
            { id: 2, title: 'W', message: 'warn', type: 'warning', isRead: false },
            { id: 3, title: 'E', message: 'error', type: 'error', isRead: true },
          ],
          isLoading: false,
        }),
      },
      markRead: {
        useMutation: () => ({ isPending: false, mutate: vi.fn() }),
      },
      markAllRead: {
        useMutation: () => ({ isPending: false, mutate: vi.fn() }),
      },
    },
  },
}));

import { NotificationPopover } from './notification-popover';

describe('notification-popover', () => {
  it('renderiza marcador de tipo info/warning/error', () => {
    const html = renderToString(<NotificationPopover defaultOpen />);

    expect(html).toContain('Info');
    expect(html).toContain('Warning');
    expect(html).toContain('Error');
  });
});
