import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { labSettings, tenantMembers, tenants, users } from '../../db/schema/index.js';
import { hashPassword } from '../../core/auth.js';
import { logger } from '../../logger.js';
import * as settingsService from './service.js';

async function createUser(email: string) {
  const [user] = await db.insert(users).values({
    name: 'Settings User',
    email,
    passwordHash: await hashPassword('Test123!'),
  }).returning();
  if (!user) throw new Error('Failed to create user');
  return user;
}

async function createTenantFor(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.delete(labSettings);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('settings module', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('retorna overview unificado sem expor senha SMTP', async () => {
    const user = await createUser('settings-overview@test.com');
    const tenant = await createTenantFor(user.id, 'Lab Overview');

    await settingsService.updateSmtpSettings(tenant.id, user.id, {
      smtpMode: 'custom_smtp',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUsername: 'smtp-user',
      smtpPassword: 'smtp-secret',
      smtpFromEmail: 'noreply@example.com',
      smtpFromName: 'Lab',
    });

    const overview = await settingsService.getSettingsOverview(tenant.id, false);
    expect(overview.identity.name).toBe('Lab Overview');
    expect(overview.smtp.hasPassword).toBe(true);
    expect((overview.smtp as Record<string, unknown>).smtpPassword).toBeUndefined();
    expect((overview.smtp as Record<string, unknown>).smtpPasswordEncrypted).toBeUndefined();
  });

  it('update identidade altera tenants (fonte canonica)', async () => {
    const user = await createUser('settings-identity@test.com');
    const tenant = await createTenantFor(user.id, 'Lab Original');

    await settingsService.updateLabIdentity(tenant.id, user.id, {
      name: 'Lab Atualizado',
      cnpj: '12.345.678/0001-95',
      email: 'contato@lab.com',
      phone: '(11) 99999-9999',
      address: 'Rua A, 123',
      city: 'Sao Paulo',
      state: 'SP',
      website: 'https://lab-identidade.com',
    });

    const [updatedTenant] = await db.select().from(tenants).where(eq(tenants.id, tenant.id));
    const [updatedSettings] = await db.select().from(labSettings).where(eq(labSettings.tenantId, tenant.id));
    expect(updatedTenant?.name).toBe('Lab Atualizado');
    expect(updatedTenant?.cnpj).toBe('12345678000195');
    expect(updatedSettings?.website).toBe('https://lab-identidade.com');
  });

  it('update branding altera apenas lab_settings', async () => {
    const user = await createUser('settings-branding@test.com');
    const tenant = await createTenantFor(user.id, 'Lab Branding');

    await settingsService.updateLabBranding(tenant.id, user.id, {
      primaryColor: '#112233',
      secondaryColor: '#445566',
      reportHeader: 'Header X',
      reportFooter: 'Footer X',
    });

    const [settings] = await db.select().from(labSettings).where(eq(labSettings.tenantId, tenant.id));
    const [tenantRow] = await db.select().from(tenants).where(eq(tenants.id, tenant.id));

    expect(settings?.primaryColor).toBe('#112233');
    expect(settings?.secondaryColor).toBe('#445566');
    expect(tenantRow?.name).toBe('Lab Branding');
  });

  it('tenant isolation: tenant A nao altera tenant B', async () => {
    const u1 = await createUser('settings-t1@test.com');
    const u2 = await createUser('settings-t2@test.com');
    const t1 = await createTenantFor(u1.id, 'Tenant A');
    const t2 = await createTenantFor(u2.id, 'Tenant B');

    await settingsService.updateLabBranding(t1.id, u1.id, {
      primaryColor: '#111111',
      secondaryColor: '#222222',
    });

    const [t1Settings] = await db.select().from(labSettings).where(eq(labSettings.tenantId, t1.id));
    const [t2Settings] = await db.select().from(labSettings).where(eq(labSettings.tenantId, t2.id));

    expect(t1Settings?.primaryColor).toBe('#111111');
    expect(t2Settings).toBeUndefined();
  });

  it('listUsers e updateUserRole reaproveitam dominio auth/tenant', async () => {
    const owner = await createUser('settings-owner@test.com');
    const tenant = await createTenantFor(owner.id, 'Lab Team');
    const member = await createUser('settings-member@test.com');

    await db.insert(tenantMembers).values({ tenantId: tenant.id, userId: member.id, role: 'recepcao' });

    const list = await settingsService.listUsers(tenant.id);
    const target = list.find((item) => item.userId === member.id);
    expect(target).toBeDefined();

    if (target) {
      await settingsService.updateUserRole(tenant.id, owner.id, { memberId: target.id, role: 'producao' });
    }

    const [updatedMember] = await db.select().from(tenantMembers).where(and(
      eq(tenantMembers.tenantId, tenant.id),
      eq(tenantMembers.userId, member.id),
    ));
    expect(updatedMember?.role).toBe('producao');
  });

  it('nao vaza senha SMTP em logs estruturados', async () => {
    const user = await createUser('settings-logs@test.com');
    const tenant = await createTenantFor(user.id, 'Lab Logs');

    const infoSpy = vi.spyOn(logger, 'info');

    await settingsService.updateSmtpSettings(tenant.id, user.id, {
      smtpMode: 'custom_smtp',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUsername: 'smtp-user',
      smtpPassword: 'senha-super-secreta',
      smtpFromEmail: 'noreply@example.com',
      smtpFromName: 'Lab',
    });

    const callsDump = JSON.stringify(infoSpy.mock.calls);
    expect(callsDump.includes('senha-super-secreta')).toBe(false);

    infoSpy.mockRestore();
  });

  it('gera alerta quando teste SMTP falha', async () => {
    const user = await createUser('settings-alert@test.com');
    const tenant = await createTenantFor(user.id, 'Lab Alert');
    await settingsService.updateSmtpSettings(tenant.id, user.id, {
      smtpMode: 'custom_smtp',
      smtpSecure: false,
    });

    const warnSpy = vi.spyOn(logger, 'warn');

    await expect(settingsService.testSmtpConnection(tenant.id, user.id)).rejects.toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
    const callsDump = JSON.stringify(warnSpy.mock.calls);
    expect(callsDump.includes('settings.alert.smtp_test_failed')).toBe(true);

    warnSpy.mockRestore();
  });
});
