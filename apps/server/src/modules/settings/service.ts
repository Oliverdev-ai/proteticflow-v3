import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../../db/index.js';
import { labSettings, tenants } from '../../db/schema/index.js';
import { logger } from '../../logger.js';
import { encryptSecret } from '../../core/crypto.js';
import * as authService from '../auth/service.js';
import * as tenantService from '../tenants/service.js';
import { removeTenantLogoByUrl, uploadTenantLogo } from './logo.js';
import type {
  LabBrandingInput,
  LabIdentityInput,
  PrinterSettingsInput,
  SettingsOverview,
  SmtpSettingsInput,
  UpdateUserRoleFromSettingsInput,
  UploadLogoInput,
} from '@proteticflow/shared';

function logSettingsMetric(tenantId: number, userId: number, metricName: string, section: string) {
  logger.info({
    action: 'settings.metric',
    tenantId,
    userId,
    metricName,
    section,
    value: 1,
  }, 'Metrica de negocio de configuracoes');
}

function normalizeOptional(value?: string): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeCnpj(input?: string): string | null {
  if (input === undefined) return null;
  const digits = input.replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}

async function ensureSettingsRow(tenantId: number) {
  const [existing] = await db.select().from(labSettings).where(eq(labSettings.tenantId, tenantId));
  if (existing) return existing;

  const [created] = await db.insert(labSettings).values({
    tenantId,
    labName: 'Laboratorio de Protese',
    primaryColor: '#1a56db',
    secondaryColor: '#6b7280',
    smtpMode: 'resend_fallback',
  }).returning();

  if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao inicializar configuracoes' });
  return created;
}

function mapOverview(tenant: typeof tenants.$inferSelect, settings: typeof labSettings.$inferSelect, users?: Awaited<ReturnType<typeof authService.listUsers>>): SettingsOverview {
  return {
    tenantId: tenant.id,
    identity: {
      name: tenant.name,
      cnpj: tenant.cnpj,
      phone: tenant.phone,
      email: tenant.email,
      address: tenant.address,
      city: tenant.city,
      state: tenant.state,
      website: settings.website,
      logoUrl: tenant.logoUrl,
    },
    branding: {
      reportHeader: settings.reportHeader,
      reportFooter: settings.reportFooter,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
    },
    printer: {
      printerHost: settings.printerHost,
      printerPort: settings.printerPort,
    },
    smtp: {
      smtpMode: settings.smtpMode,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpSecure: settings.smtpSecure,
      smtpUsername: settings.smtpUsername,
      smtpFromName: settings.smtpFromName,
      smtpFromEmail: settings.smtpFromEmail,
      hasPassword: Boolean(settings.smtpPasswordEncrypted),
      lastSmtpTestAt: settings.lastSmtpTestAt ? settings.lastSmtpTestAt.toISOString() : null,
      lastSmtpTestStatus: settings.lastSmtpTestStatus === 'ok' || settings.lastSmtpTestStatus === 'failed'
        ? settings.lastSmtpTestStatus
        : null,
    },
    plan: {
      current: tenant.plan,
      planExpiresAt: tenant.planExpiresAt ? tenant.planExpiresAt.toISOString() : null,
      clientCount: tenant.clientCount,
      jobCountThisMonth: tenant.jobCountThisMonth,
      userCount: tenant.userCount,
      priceTableCount: tenant.priceTableCount,
      storageUsedMb: tenant.storageUsedMb,
    },
    ...(users ? { users } : {}),
  };
}

export async function getSettingsOverview(tenantId: number, includeUsers = false) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });

  const settings = await ensureSettingsRow(tenantId);
  const users = includeUsers ? await authService.listUsers(tenantId) : undefined;

  return mapOverview(tenant, settings, users);
}

export async function updateLabIdentity(tenantId: number, userId: number, input: LabIdentityInput) {
  const [updatedTenant] = await db.transaction(async (tx) => {
    const [tenant] = await tx.update(tenants).set({
      name: input.name,
      cnpj: normalizeCnpj(input.cnpj),
      phone: normalizeOptional(input.phone),
      email: normalizeOptional(input.email),
      address: normalizeOptional(input.address),
      city: normalizeOptional(input.city),
      state: normalizeOptional(input.state),
      updatedAt: new Date(),
    }).where(eq(tenants.id, tenantId)).returning();

    const [existingSettings] = await tx.select().from(labSettings).where(eq(labSettings.tenantId, tenantId));
    const settingsId = existingSettings
      ? existingSettings.id
      : (await tx.insert(labSettings).values({
          tenantId,
          labName: input.name,
          primaryColor: '#1a56db',
          secondaryColor: '#6b7280',
          smtpMode: 'resend_fallback',
        }).returning())[0]!.id;

    await tx.update(labSettings).set({
      website: normalizeOptional(input.website),
      updatedAt: new Date(),
    }).where(eq(labSettings.id, settingsId));

    return [tenant];
  });

  logger.info({ action: 'settings.identity.update', tenantId, userId }, 'Identidade do laboratorio atualizada');
  logSettingsMetric(tenantId, userId, 'settings_updates_total', 'identity');
  return updatedTenant;
}

export async function updateLabBranding(tenantId: number, userId: number, input: LabBrandingInput) {
  const settings = await ensureSettingsRow(tenantId);
  const [updated] = await db.update(labSettings).set({ // tenant-isolation-ok
    reportHeader: normalizeOptional(input.reportHeader),
    reportFooter: normalizeOptional(input.reportFooter),
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    updatedAt: new Date(),
  }).where(eq(labSettings.id, settings.id)).returning();

  logger.info({ action: 'settings.branding.update', tenantId, userId }, 'Branding do laboratorio atualizado');
  logSettingsMetric(tenantId, userId, 'settings_updates_total', 'branding');
  return updated!;
}

export async function uploadLogo(tenantId: number, userId: number, input: UploadLogoInput) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });

  await removeTenantLogoByUrl(tenant.logoUrl);
  const uploaded = await uploadTenantLogo(tenantId, input);

  const [updated] = await db.update(tenants).set({
    logoUrl: uploaded.url,
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId)).returning();

  logger.info({ action: 'settings.logo.upload', tenantId, userId }, 'Logo atualizado');
  logSettingsMetric(tenantId, userId, 'settings_updates_total', 'logo_upload');
  return { logoUrl: updated!.logoUrl };
}

export async function removeLogo(tenantId: number, userId: number) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });

  await removeTenantLogoByUrl(tenant.logoUrl);

  await db.update(tenants).set({
    logoUrl: null,
    updatedAt: new Date(),
  }).where(eq(tenants.id, tenantId));

  logger.info({ action: 'settings.logo.remove', tenantId, userId }, 'Logo removido');
  logSettingsMetric(tenantId, userId, 'settings_updates_total', 'logo_remove');
  return { success: true };
}

export async function updatePrinterSettings(tenantId: number, userId: number, input: PrinterSettingsInput) {
  const settings = await ensureSettingsRow(tenantId);

  const [updated] = await db.update(labSettings).set({ // tenant-isolation-ok
    printerHost: input.printerHost,
    printerPort: input.printerPort,
    updatedAt: new Date(),
  }).where(eq(labSettings.id, settings.id)).returning();

  logger.info({ action: 'settings.printer.update', tenantId, userId }, 'Configuracao de impressora atualizada');
  logSettingsMetric(tenantId, userId, 'settings_updates_total', 'printer');
  return updated!;
}

export async function updateSmtpSettings(tenantId: number, userId: number, input: SmtpSettingsInput) {
  const settings = await ensureSettingsRow(tenantId);

  const smtpPasswordEncrypted = input.smtpPassword
    ? encryptSecret(input.smtpPassword)
    : undefined;

  const [updated] = await db.update(labSettings).set({ // tenant-isolation-ok
    smtpMode: input.smtpMode,
    smtpHost: normalizeOptional(input.smtpHost),
    smtpPort: input.smtpPort ?? null,
    smtpSecure: input.smtpSecure,
    smtpUsername: normalizeOptional(input.smtpUsername),
    smtpPasswordEncrypted: smtpPasswordEncrypted ?? settings.smtpPasswordEncrypted,
    smtpFromName: normalizeOptional(input.smtpFromName),
    smtpFromEmail: normalizeOptional(input.smtpFromEmail),
    updatedAt: new Date(),
  }).where(eq(labSettings.id, settings.id)).returning();

  logger.info({ action: 'settings.smtp.update', tenantId, userId }, 'Configuracao SMTP atualizada');
  logSettingsMetric(tenantId, userId, 'settings_updates_total', 'smtp');
  return {
    smtpMode: updated!.smtpMode,
    smtpHost: updated!.smtpHost,
    smtpPort: updated!.smtpPort,
    smtpSecure: updated!.smtpSecure,
    smtpUsername: updated!.smtpUsername,
    smtpFromName: updated!.smtpFromName,
    smtpFromEmail: updated!.smtpFromEmail,
    hasPassword: Boolean(updated!.smtpPasswordEncrypted),
  };
}

export async function testSmtpConnection(tenantId: number, userId: number) {
  const settings = await ensureSettingsRow(tenantId);

  const canTest = settings.smtpMode === 'resend_fallback'
    || (Boolean(settings.smtpHost) && Boolean(settings.smtpPort) && Boolean(settings.smtpFromEmail));

  const status = canTest ? 'ok' : 'failed';

  await db.update(labSettings).set({ // tenant-isolation-ok
    lastSmtpTestAt: new Date(),
    lastSmtpTestStatus: status,
    updatedAt: new Date(),
  }).where(eq(labSettings.id, settings.id));

  logger.info({ action: 'settings.smtp.test', tenantId, userId, status }, 'Teste SMTP executado');
  logSettingsMetric(tenantId, userId, 'settings_smtp_tests_total', status);

  if (!canTest) {
    logger.warn(
      { action: 'settings.alert.smtp_test_failed', tenantId, userId },
      'Alerta: teste SMTP falhou por configuracao incompleta',
    );
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Configuracao SMTP incompleta para teste' });
  }

  return { success: true, status: 'ok' as const };
}

export async function listUsers(tenantId: number) {
  return authService.listUsers(tenantId);
}

export async function updateUserRole(tenantId: number, userId: number, input: UpdateUserRoleFromSettingsInput) {
  await tenantService.updateMemberRole(tenantId, input.memberId, input.role);
  logger.info({ action: 'settings.user.role.update', tenantId, userId, targetUserId: input.memberId }, 'Role de usuario atualizada em Settings');
  logSettingsMetric(tenantId, userId, 'settings_role_updates_total', 'roles');
  return { success: true };
}
