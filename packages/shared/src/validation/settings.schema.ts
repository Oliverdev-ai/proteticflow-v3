import { z } from 'zod';
import { ROLES } from '../constants/roles';

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
const normalizeDigits = (value: string) => value.replace(/\D/g, '');

const cnpjSchema = z.string().transform(normalizeDigits).refine(
  (value) => value.length === 14,
  { message: 'CNPJ invalido' },
);

const smtpModeSchema = z.enum(['resend_fallback', 'custom_smtp']);

export const getSettingsOverviewSchema = z.object({
  includeUsers: z.boolean().default(false),
});

export const updateLabIdentitySchema = z.object({
  name: z.string().min(2).max(255),
  cnpj: cnpjSchema.optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().optional(),
  address: z.string().max(2000).optional(),
  city: z.string().max(128).optional(),
  state: z.string().length(2).optional(),
  website: z.string().url().optional().or(z.literal('')),
});

export const updateLabBrandingSchema = z.object({
  reportHeader: z.string().max(2000).optional(),
  reportFooter: z.string().max(2000).optional(),
  primaryColor: z.string().regex(hexColorRegex, 'Cor primaria invalida (#RRGGBB)'),
  secondaryColor: z.string().regex(hexColorRegex, 'Cor secundaria invalida (#RRGGBB)'),
});

export const updatePrinterSettingsSchema = z.object({
  printerHost: z.string().min(1).max(255),
  printerPort: z.number().int().min(1).max(65535),
});

export const updateSmtpSettingsSchema = z.object({
  smtpMode: smtpModeSchema,
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().default(false),
  smtpUsername: z.string().max(255).optional(),
  smtpPassword: z.string().max(512).optional(),
  smtpFromName: z.string().max(255).optional(),
  smtpFromEmail: z.string().email().optional(),
});

export const testSmtpConnectionSchema = z.object({
  toEmail: z.string().email().optional(),
});

export const uploadLogoSchema = z.object({
  fileBase64: z.string().min(1),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  filename: z.string().min(1).max(255),
  sizeBytes: z.number().int().min(1).max(2 * 1024 * 1024),
});

export const removeLogoSchema = z.object({});

export const updateUserRoleFromSettingsSchema = z.object({
  memberId: z.number().int().positive(),
  role: z.enum([ROLES.SUPERADMIN, ROLES.GERENTE, ROLES.PRODUCAO, ROLES.RECEPCAO, ROLES.CONTABIL]),
});

export const settingsUserItemSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum([ROLES.SUPERADMIN, ROLES.GERENTE, ROLES.PRODUCAO, ROLES.RECEPCAO, ROLES.CONTABIL]),
  isActive: z.boolean(),
  joinedAt: z.string(),
  lastSignedIn: z.string().nullable(),
});

export const settingsOverviewSchema = z.object({
  tenantId: z.number().int().positive(),
  identity: z.object({
    name: z.string(),
    cnpj: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    website: z.string().nullable(),
    logoUrl: z.string().nullable(),
  }),
  branding: z.object({
    reportHeader: z.string().nullable(),
    reportFooter: z.string().nullable(),
    primaryColor: z.string().regex(hexColorRegex),
    secondaryColor: z.string().regex(hexColorRegex),
  }),
  printer: z.object({
    printerHost: z.string().nullable(),
    printerPort: z.number().int().nullable(),
  }),
  smtp: z.object({
    smtpMode: smtpModeSchema,
    smtpHost: z.string().nullable(),
    smtpPort: z.number().int().nullable(),
    smtpSecure: z.boolean(),
    smtpUsername: z.string().nullable(),
    smtpFromName: z.string().nullable(),
    smtpFromEmail: z.string().nullable(),
    hasPassword: z.boolean(),
    lastSmtpTestAt: z.string().nullable(),
    lastSmtpTestStatus: z.enum(['ok', 'failed']).nullable(),
  }),
  plan: z.object({
    current: z.enum(['trial', 'starter', 'pro', 'enterprise']),
    planExpiresAt: z.string().nullable(),
    clientCount: z.number().int().nonnegative(),
    jobCountThisMonth: z.number().int().nonnegative(),
    userCount: z.number().int().nonnegative(),
    priceTableCount: z.number().int().nonnegative(),
    storageUsedMb: z.number().int().nonnegative(),
  }),
  users: z.array(settingsUserItemSchema).optional(),
});

export type GetSettingsOverviewInput = z.infer<typeof getSettingsOverviewSchema>;
export type UpdateLabIdentityInput = z.infer<typeof updateLabIdentitySchema>;
export type UpdateLabBrandingInput = z.infer<typeof updateLabBrandingSchema>;
export type UpdatePrinterSettingsInput = z.infer<typeof updatePrinterSettingsSchema>;
export type UpdateSmtpSettingsInput = z.infer<typeof updateSmtpSettingsSchema>;
export type TestSmtpConnectionInput = z.infer<typeof testSmtpConnectionSchema>;
export type UploadLogoInput = z.infer<typeof uploadLogoSchema>;
export type UpdateUserRoleFromSettingsInput = z.infer<typeof updateUserRoleFromSettingsSchema>;
export type SettingsOverviewOutput = z.infer<typeof settingsOverviewSchema>;
