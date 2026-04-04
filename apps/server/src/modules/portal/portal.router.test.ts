import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { osBlocks, tenantMembers, tenants, users } from '../../db/schema/index.js';
import { hashPassword } from '../../core/auth.js';
import { createTenant } from '../tenants/service.js';

vi.mock('./service.js', () => ({
  createPortalToken: vi.fn(async () => ({ id: 1, token: 'tok', expiresAt: '', portalUrlPath: '/portal/tok' })),
  listPortalTokensByClient: vi.fn(async () => []),
  revokePortalToken: vi.fn(async () => ({ success: true })),
  sendPortalLink: vi.fn(async () => ({ success: true, emailSent: false })),
  getPortalSnapshotByToken: vi.fn(async () => ({})),
}));

import { portalRouter } from './router.js';

type Role = 'superadmin' | 'gerente' | 'producao' | 'recepcao' | 'contabil';

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

async function createUser(email: string) {
  const [user] = await db.insert(users).values({
    name: 'Portal Router Test',
    email,
    passwordHash: await hashPassword('Test123!'),
    role: 'user',
  }).returning();

  if (!user) {
    throw new Error('Falha ao criar usuario de teste');
  }

  return user;
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.delete(osBlocks);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

async function createCtx(tenantId: number | null, role: Role = 'recepcao') {
  if (tenantId === null) {
    return {
      req: { headers: {} } as never,
      res: {} as never,
      db: {} as never,
      tenantId: null,
      user: null,
    };
  }

  const owner = await createUser(`${uid('portal-owner')}@test.com`);
  const tenant = await createTenant(owner.id, { name: `Portal Tenant ${role}` });

  if (role === 'superadmin') {
    return {
      req: { headers: {} } as never,
      res: {} as never,
      db: {} as never,
      tenantId: tenant.id,
      user: { id: owner.id, tenantId: tenant.id, role: 'superadmin' as const },
    };
  }

  const memberUser = await createUser(`${uid(`portal-${role}`)}@test.com`);
  await db.insert(tenantMembers).values({
    tenantId: tenant.id,
    userId: memberUser.id,
    role,
    isActive: true,
  });

  return {
    req: { headers: {} } as never,
    res: {} as never,
    db: {} as never,
    tenantId: tenant.id,
    user: { id: memberUser.id, tenantId: tenant.id, role },
  };
}

async function callProcedure(
  procedureName: 'createToken' | 'revokeToken' | 'sendPortalLink',
  ctx: Awaited<ReturnType<typeof createCtx>>,
) {
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
  beforeEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('createToken: FORBIDDEN para role producao', async () => {
    await expect(callProcedure('createToken', await createCtx(1, 'producao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('createToken: FORBIDDEN para role recepcao', async () => {
    await expect(callProcedure('createToken', await createCtx(1, 'recepcao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('createToken: FORBIDDEN para role contabil', async () => {
    await expect(callProcedure('createToken', await createCtx(1, 'contabil'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('createToken: permitido para gerente', async () => {
    await expect(callProcedure('createToken', await createCtx(1, 'gerente'))).resolves.toMatchObject({ id: 1 });
  });

  it('createToken: permitido para superadmin', async () => {
    await expect(callProcedure('createToken', await createCtx(1, 'superadmin'))).resolves.toMatchObject({ id: 1 });
  });

  it('revokeToken: FORBIDDEN para role producao', async () => {
    await expect(callProcedure('revokeToken', await createCtx(1, 'producao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('revokeToken: FORBIDDEN para role recepcao', async () => {
    await expect(callProcedure('revokeToken', await createCtx(1, 'recepcao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('revokeToken: permitido para gerente', async () => {
    await expect(callProcedure('revokeToken', await createCtx(1, 'gerente'))).resolves.toMatchObject({ success: true });
  });

  it('sendPortalLink: FORBIDDEN para role producao', async () => {
    await expect(callProcedure('sendPortalLink', await createCtx(1, 'producao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('sendPortalLink: FORBIDDEN para role recepcao', async () => {
    await expect(callProcedure('sendPortalLink', await createCtx(1, 'recepcao'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('sendPortalLink: permitido para gerente', async () => {
    await expect(callProcedure('sendPortalLink', await createCtx(1, 'gerente'))).resolves.toMatchObject({ success: true });
  });

  it('createToken: UNAUTHORIZED sem usuario', async () => {
    await expect(callProcedure('createToken', await createCtx(null))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
