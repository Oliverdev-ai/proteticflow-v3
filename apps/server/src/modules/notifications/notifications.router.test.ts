import { describe, expect, it, vi } from 'vitest';

vi.mock('./service.js', () => ({
  listUserNotifications: vi.fn(async () => []),
  countUnread: vi.fn(async () => 0),
  markRead: vi.fn(async () => ({ updated: 1 })),
  markAllRead: vi.fn(async () => ({ updated: 1 })),
  listPreferences: vi.fn(async () => []),
  upsertPreference: vi.fn(async () => ({})),
  savePushSubscription: vi.fn(async () => ({})),
  deletePushSubscription: vi.fn(async () => ({ success: true })),
  dispatchByPreference: vi.fn(async () => undefined),
}));

vi.mock('./push.js', () => ({
  getPublicVapidKey: vi.fn(() => 'vapid-public-key'),
}));

import { notificationRouter } from './router.js';
import * as notificationService from './service.js';

function createCtx(tenantId: number | null, role: 'superadmin' | 'gerente' | 'producao' | 'recepcao' | 'contabil' = 'recepcao') {
  return {
    req: { headers: {} } as never,
    res: {} as never,
    db: {} as never,
    tenantId,
    user: { id: 10, tenantId: tenantId ?? 0, role },
  };
}

describe('notification router', () => {
  it('tenantProcedure bloqueia sem tenant ativo', async () => {
    const caller = notificationRouter.createCaller(createCtx(null));

    await expect(caller.unreadCount()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(notificationService.countUnread).not.toHaveBeenCalled();
  });

  it('usa tenantId e userId do contexto nas procedures', async () => {
    const caller = notificationRouter.createCaller(createCtx(44));

    await caller.list({ unreadOnly: false, limit: 10 });
    expect(notificationService.listUserNotifications).toHaveBeenCalledWith(44, 10, { unreadOnly: false, limit: 10 });

    await caller.markRead({ ids: [1, 2] });
    expect(notificationService.markRead).toHaveBeenCalledWith(44, 10, [1, 2]);

    await caller.listPreferences();
    expect(notificationService.listPreferences).toHaveBeenCalledWith(44, 10);
  });

  it('bloqueia testDispatch para role sem permissao com FORBIDDEN', async () => {
    const caller = notificationRouter.createCaller(createCtx(44, 'recepcao'));

    await expect(caller.testDispatch({ message: 'teste' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(notificationService.dispatchByPreference).not.toHaveBeenCalled();
  });
});
