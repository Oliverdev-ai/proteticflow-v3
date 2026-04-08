import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { osBlocks, tenantMembers, tenants, users } from '../../db/schema/index.js';
import { hashPassword } from '../../core/auth.js';
import { createTenant } from '../tenants/service.js';

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

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

async function createUser(email: string) {
  const [user] = await db.insert(users).values({
    name: 'Settings Router Test',
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

async function createCtx(role: 'superadmin' | 'gerente' | 'producao' | 'recepcao' | 'contabil') {
  const owner = await createUser(`${uid('settings-owner')}@test.com`);
  const tenant = await createTenant(owner.id, { name: `Lab Settings ${role}` });

  if (role === 'superadmin') {
    return {
      req: {} as never,
      res: {} as never,
      db: {} as never,
      tenantId: tenant.id,
      user: { id: owner.id, tenantId: tenant.id, role: 'superadmin' as const },
    };
  }

  const memberUser = await createUser(`${uid(`settings-${role}`)}@test.com`);
  await db.insert(tenantMembers).values({
    tenantId: tenant.id,
    userId: memberUser.id,
    role,
    isActive: true,
  });

  return {
    req: {} as never,
    res: {} as never,
    db: {} as never,
    tenantId: tenant.id,
    user: { id: memberUser.id, tenantId: tenant.id, role },
  };
}

describe('settings router RBAC', () => {
  beforeEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('recepcao recebe FORBIDDEN em mutacao sensivel', async () => {
    const caller = settingsRouter.createCaller(await createCtx('recepcao'));

    await expect(caller.updateLabIdentity({ name: 'Lab X' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(settingsService.updateLabIdentity).not.toHaveBeenCalled();
  });

  it('gerente consegue executar mutacao sensivel', async () => {
    const caller = settingsRouter.createCaller(await createCtx('gerente'));
    await caller.updateLabIdentity({ name: 'Lab Y' });
    expect(settingsService.updateLabIdentity).toHaveBeenCalled();
  });
});
