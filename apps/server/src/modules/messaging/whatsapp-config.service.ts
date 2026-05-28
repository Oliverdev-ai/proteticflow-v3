import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { tenants } from '../../db/schema/tenants.js';
import type { WhatsappTenantConfig } from '../../db/schema/whatsapp.js';

export type TenantWhatsappConfigRow = {
  tenantId: number;
  tenantSlug: string;
  whatsappEnabled: boolean;
  whatsappConfig: WhatsappTenantConfig;
  whatsappVerifiedAt: Date | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeTenantWhatsappConfig(raw: unknown): WhatsappTenantConfig {
  const fallback: WhatsappTenantConfig = { provider: 'mock' };
  if (!isObject(raw)) return fallback;

  const provider = toStringValue(raw['provider']);
  if (provider !== 'mock' && provider !== 'blip' && provider !== 'meta') {
    return fallback;
  }

  const normalized: WhatsappTenantConfig = { provider };
  const webhookSecret = toStringValue(raw['webhookSecret']);
  if (webhookSecret) {
    normalized.webhookSecret = webhookSecret;
  }

  const blip = raw['blip'];
  if (provider === 'blip' && isObject(blip)) {
    const apiToken = toStringValue(blip['apiToken']);
    const fromNumber = toStringValue(blip['fromNumber']);
    const baseUrl = toStringValue(blip['baseUrl']);
    if (apiToken && fromNumber) {
      normalized.blip = {
        apiToken,
        fromNumber,
        ...(baseUrl ? { baseUrl } : {}),
      };
    }
  }

  const meta = raw['meta'];
  if (provider === 'meta' && isObject(meta)) {
    const accessToken = toStringValue(meta['accessToken']);
    const phoneNumberId = toStringValue(meta['phoneNumberId']);
    const businessAccountId = toStringValue(meta['businessAccountId']);
    if (accessToken && phoneNumberId) {
      normalized.meta = {
        accessToken,
        phoneNumberId,
        ...(businessAccountId ? { businessAccountId } : {}),
      };
    }
  }

  return normalized;
}

async function fetchTenantConfigByWhere(where: ReturnType<typeof eq>) {
  const [row] = await db
    .select({
      tenantId: tenants.id,
      tenantSlug: tenants.slug,
      whatsappEnabled: tenants.whatsappEnabled,
      whatsappConfig: tenants.whatsappConfig,
      whatsappVerifiedAt: tenants.whatsappVerifiedAt,
    })
    .from(tenants)
    .where(where)
    .limit(1);

  if (!row) return null;
  return {
    tenantId: row.tenantId,
    tenantSlug: row.tenantSlug,
    whatsappEnabled: row.whatsappEnabled,
    whatsappConfig: normalizeTenantWhatsappConfig(row.whatsappConfig),
    whatsappVerifiedAt: row.whatsappVerifiedAt ?? null,
  } satisfies TenantWhatsappConfigRow;
}

export async function getTenantWhatsappConfigById(tenantId: number): Promise<TenantWhatsappConfigRow | null> {
  return fetchTenantConfigByWhere(eq(tenants.id, tenantId));
}

export async function getTenantWhatsappConfigBySlug(slug: string): Promise<TenantWhatsappConfigRow | null> {
  return fetchTenantConfigByWhere(eq(tenants.slug, slug));
}
