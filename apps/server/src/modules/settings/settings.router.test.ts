import { describe, expect, it, vi } from 'vitest';

vi.mock('./service.js', () => ({
  getSettingsOverview: vi.fn(async () => ({})),
  updateLabIdentity: vi.fn(async () => ({ success: true })),
  updateLabBranding: vi.fn(async () => ({ success: true })),
  uploadLogo: vi.fn(async () => ({ logoUrl: null })),
  removeLogo: vi.fn(async () => ({ success: true })),
  updatePrinterSettings: vi.fn(async () => ({ success: true })),
  updateSmtpSettings: vi.fn(async () => ({ hasPassword: false })),
  testSmtpConnection: vi.fn(async () => ({ success: true })),
  listUsers: vi.fn(async () => []),
  updateUserRole: vi.fn(async () => ({ success: true })),
}));

import { settingsRouter } from './router.js';
import * as settingsService from './service.js';

function createCtx(role: 'superadmin' | 'gerente' | 'producao' | 'recepcao' | 'contabil') {
  return {
    req: {} as never,
    res: {} as never,
    db: {} as never,
    tenantId: 1,
    user: { id: 10, tenantId: 1, role },
  };
}

describe('settings router RBAC', () => {
  it('recepcao recebe FORBIDDEN em mutacao sensivel', async () => {
    const caller = settingsRouter.createCaller(createCtx('recepcao'));

    await expect(caller.updateLabIdentity({ name: 'Lab X' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(settingsService.updateLabIdentity).not.toHaveBeenCalled();
  });

  it('gerente consegue executar mutacao sensivel', async () => {
    const caller = settingsRouter.createCaller(createCtx('gerente'));
    await caller.updateLabIdentity({ name: 'Lab Y' });
    expect(settingsService.updateLabIdentity).toHaveBeenCalled();
  });
});
