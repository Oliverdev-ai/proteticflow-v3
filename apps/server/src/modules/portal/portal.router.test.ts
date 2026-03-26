import { describe, expect, it, vi } from 'vitest';

vi.mock('./service.js', () => ({
  createPortalToken: vi.fn(async () => ({ id: 1, token: 'tok', expiresAt: '', portalUrlPath: '/portal/tok' })),
  listPortalTokensByClient: vi.fn(async () => []),
  revokePortalToken: vi.fn(async () => ({ success: true })),
  sendPortalLink: vi.fn(async () => ({ success: true, emailSent: false })),
  getPortalSnapshotByToken: vi.fn(async () => ({})),
}));

import { portalRouter } from './router.js';

type Role = 'superadmin' | 'gerente' | 'producao' | 'recepcao' | 'contabil';

function createCtx(tenantId: number | null, role: Role = 'recepcao') {
  return {
    req: { headers: {} } as never,
    res: {} as never,
    db: {} as never,
    tenantId,
    user: tenantId !== null ? { id: 10, tenantId, role } : null,
  };
}

async function callProcedure(procedureName: 'createToken' | 'revokeToken' | 'sendPortalLink', ctx: ReturnType<typeof createCtx>) {
  const inputs: Record<string, unknown> = {
    createToken: { clientId: 1, expiresInDays: 7 },
    revokeToken: { tokenId: 1 },
    sendPortalLink: { tokenId: 1, email: 'a@b.com', token: 'a'.repeat(64) },
  };
  const caller = portalRouter.createCaller(ctx as never) as Record<string, ((input: unknown) => Promise<unknown>) | undefined>;
  const fn = caller[procedureName];
  if (!fn) throw new Error(`Procedure ${procedureName} not found`);
  return fn(inputs[procedureName]);
}

describe('portal router — RBAC', () => {
  it('createToken: FORBIDDEN para role producao', async () => {
    await expect(callProcedure('createToken', createCtx(1, 'producao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('createToken: FORBIDDEN para role recepcao', async () => {
    await expect(callProcedure('createToken', createCtx(1, 'recepcao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('createToken: FORBIDDEN para role contabil', async () => {
    await expect(callProcedure('createToken', createCtx(1, 'contabil'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('createToken: permitido para gerente', async () => {
    await expect(callProcedure('createToken', createCtx(1, 'gerente'))).resolves.toMatchObject({ id: 1 });
  });

  it('createToken: permitido para superadmin', async () => {
    await expect(callProcedure('createToken', createCtx(1, 'superadmin'))).resolves.toMatchObject({ id: 1 });
  });

  it('revokeToken: FORBIDDEN para role producao', async () => {
    await expect(callProcedure('revokeToken', createCtx(1, 'producao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('revokeToken: FORBIDDEN para role recepcao', async () => {
    await expect(callProcedure('revokeToken', createCtx(1, 'recepcao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('revokeToken: permitido para gerente', async () => {
    await expect(callProcedure('revokeToken', createCtx(1, 'gerente'))).resolves.toMatchObject({ success: true });
  });

  it('sendPortalLink: FORBIDDEN para role producao', async () => {
    await expect(callProcedure('sendPortalLink', createCtx(1, 'producao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('sendPortalLink: FORBIDDEN para role recepcao', async () => {
    await expect(callProcedure('sendPortalLink', createCtx(1, 'recepcao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('sendPortalLink: permitido para gerente', async () => {
    await expect(callProcedure('sendPortalLink', createCtx(1, 'gerente'))).resolves.toMatchObject({ success: true });
  });

  it('createToken: UNAUTHORIZED sem usuario', async () => {
    await expect(callProcedure('createToken', createCtx(null))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
