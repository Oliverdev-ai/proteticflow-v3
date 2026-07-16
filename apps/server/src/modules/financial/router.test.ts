import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { osBlocks, tenantMembers, tenants, users } from '../../db/schema/index.js';
import { hashPassword } from '../../core/auth.js';
import { createTenant } from '../tenants/service.js';
import type { TrpcContext } from '../../trpc/context.js';

vi.mock('./service.js', () => ({
  cancelAr: vi.fn(async () => ({ id: 1, status: 'cancelled' })),
  cancelAp: vi.fn(async () => ({ id: 2, status: 'cancelled' })),
}));

import { financialRouter } from './router.js';
import * as financialService from './service.js';

async function createUser(email: string) {
  const [user] = await db.insert(users).values({
    name: 'Financial Router Test',
    email,
    passwordHash: await hashPassword('Test123!'),
    role: 'user',
  }).returning();

  if (!user) throw new Error('Falha ao criar usuario de teste');
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

async function createCtx(role: 'superadmin' | 'gerente' | 'contabil' | 'producao' | 'recepcao'): Promise<TrpcContext> {
  const owner = await createUser(`financial-owner-${role}@test.com`);
  const tenant = await createTenant(owner.id, { name: `Lab Financial ${role}` });
  await db.update(tenants).set({ plan: 'enterprise' }).where(eq(tenants.id, tenant.id));

  if (role === 'superadmin') {
    return {
      req: {} as TrpcContext['req'],
      res: {} as TrpcContext['res'],
      db,
      tenantId: tenant.id,
      user: { id: owner.id, tenantId: tenant.id, role: 'superadmin' },
    };
  }

  const member = await createUser(`financial-${role}@test.com`);
  await db.insert(tenantMembers).values({
    tenantId: tenant.id,
    userId: member.id,
    role,
    isActive: true,
  });

  return {
    req: {} as TrpcContext['req'],
    res: {} as TrpcContext['res'],
    db,
    tenantId: tenant.id,
    user: { id: member.id, tenantId: tenant.id, role },
  };
}

describe('financial router admin guards', () => {
  beforeEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('blocks non-admin financial role from destructive AR/AP mutations', async () => {
    const caller = financialRouter.createCaller(await createCtx('contabil'));

    await expect(caller.cancelAr({ id: 1, cancelReason: 'Erro operacional' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.cancelAp({ id: 2, cancelReason: 'Despesa duplicada' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(financialService.cancelAr).not.toHaveBeenCalled();
    expect(financialService.cancelAp).not.toHaveBeenCalled();
  });

  it('allows admin roles to execute destructive AR/AP mutations', async () => {
    const caller = financialRouter.createCaller(await createCtx('gerente'));

    await expect(caller.cancelAr({ id: 1, cancelReason: 'Erro operacional' }))
      .resolves.toMatchObject({ status: 'cancelled' });
    await expect(caller.cancelAp({ id: 2, cancelReason: 'Despesa duplicada' }))
      .resolves.toMatchObject({ status: 'cancelled' });
    expect(financialService.cancelAr).toHaveBeenCalledOnce();
    expect(financialService.cancelAp).toHaveBeenCalledOnce();
  });
});
