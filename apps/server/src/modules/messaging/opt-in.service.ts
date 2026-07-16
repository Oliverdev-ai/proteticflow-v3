import { BR_VALID_DDD } from '@proteticflow/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { whatsappOptIns } from '../../db/schema/whatsapp.js';

const INTERNATIONAL_E164_RE = /^[1-9]\d{7,14}$/;
const BR_LOCAL_RE = /^[1-9]\d{9,10}$/;
const BR_WITH_COUNTRY_CODE_RE = /^55[1-9]\d{9,10}$/;
const OPT_OUT_KEYWORDS = new Set([
  'PARAR',
  'SAIR',
  'CANCELAR',
  'DESCADASTRAR',
  'STOP',
  'UNSUBSCRIBE',
]);

export type WhatsappOptInStatus = 'pending' | 'opted_in' | 'opted_out';

function hasValidBrazilianDdd(digits: string, hasCountryCode: boolean): boolean {
  const ddd = hasCountryCode ? digits.slice(2, 4) : digits.slice(0, 2);
  return BR_VALID_DDD.has(ddd);
}

function normalizeExplicitInternationalPhone(digits: string): string | null {
  if (digits.startsWith('55')) {
    return BR_WITH_COUNTRY_CODE_RE.test(digits) && hasValidBrazilianDdd(digits, true)
      ? digits
      : null;
  }
  return INTERNATIONAL_E164_RE.test(digits) ? digits : null;
}

export function normalizePhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (raw.trim().startsWith('+')) {
    return normalizeExplicitInternationalPhone(digits);
  }

  if (BR_WITH_COUNTRY_CODE_RE.test(digits)) {
    return hasValidBrazilianDdd(digits, true) ? digits : null;
  }

  if (BR_LOCAL_RE.test(digits)) {
    return hasValidBrazilianDdd(digits, false) ? `55${digits}` : null;
  }

  return null;
}

export function sanitizeWhatsappBody(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKeywordCandidate(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim();
}

export function matchOptOutKeyword(rawBody: string): string | null {
  const normalized = normalizeKeywordCandidate(rawBody);
  if (!normalized) return null;
  if (OPT_OUT_KEYWORDS.has(normalized)) return normalized;
  return null;
}

export async function getOptInStatusByPhone(
  tenantId: number,
  phoneE164: string,
): Promise<WhatsappOptInStatus | null> {
  const [row] = await db
    .select({ status: whatsappOptIns.status })
    .from(whatsappOptIns)
    .where(and(
      eq(whatsappOptIns.tenantId, tenantId),
      eq(whatsappOptIns.phoneE164, phoneE164),
    ))
    .limit(1);
  return row?.status ?? null;
}

export async function canSendWhatsappByOptIn(
  tenantId: number,
  phoneE164: string,
): Promise<boolean> {
  const status = await getOptInStatusByPhone(tenantId, phoneE164);
  return status === 'opted_in';
}

export async function upsertWhatsappOptIn(input: {
  tenantId: number;
  clientId?: number | null;
  phoneE164: string;
  status: WhatsappOptInStatus;
  source: string;
  keyword?: string | null;
  updatedBy?: number | null;
  evidence?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(whatsappOptIns)
    .values({
      tenantId: input.tenantId,
      clientId: input.clientId ?? null,
      phoneE164: input.phoneE164,
      status: input.status,
      source: input.source,
      keyword: input.keyword ?? null,
      updatedBy: input.updatedBy ?? null,
      evidence: input.evidence ?? {},
      optedInAt: input.status === 'opted_in' ? now : null,
      optedOutAt: input.status === 'opted_out' ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [whatsappOptIns.tenantId, whatsappOptIns.phoneE164],
      set: {
        clientId: input.clientId ?? null,
        status: input.status,
        source: input.source,
        keyword: input.keyword ?? null,
        updatedBy: input.updatedBy ?? null,
        evidence: input.evidence ?? {},
        optedInAt: input.status === 'opted_in' ? now : whatsappOptIns.optedInAt,
        optedOutAt: input.status === 'opted_out' ? now : whatsappOptIns.optedOutAt,
        updatedAt: now,
      },
    });
}

export async function requestWhatsappOptIn(input: {
  tenantId: number;
  clientId?: number | null;
  phoneE164: string;
  updatedBy?: number | null;
  evidence?: Record<string, unknown>;
}): Promise<void> {
  const payload: Parameters<typeof upsertWhatsappOptIn>[0] = {
    tenantId: input.tenantId,
    clientId: input.clientId ?? null,
    phoneE164: input.phoneE164,
    status: 'pending',
    source: 'opt_in_request',
    updatedBy: input.updatedBy ?? null,
    ...(input.evidence ? { evidence: input.evidence } : {}),
  };
  await upsertWhatsappOptIn(payload);
}

export async function confirmWhatsappOptIn(input: {
  tenantId: number;
  clientId?: number | null;
  phoneE164: string;
  updatedBy?: number | null;
  evidence?: Record<string, unknown>;
}): Promise<void> {
  const payload: Parameters<typeof upsertWhatsappOptIn>[0] = {
    tenantId: input.tenantId,
    clientId: input.clientId ?? null,
    phoneE164: input.phoneE164,
    status: 'opted_in',
    source: 'opt_in_confirmed',
    updatedBy: input.updatedBy ?? null,
    ...(input.evidence ? { evidence: input.evidence } : {}),
  };
  await upsertWhatsappOptIn(payload);
}

export async function applyInboundOptOutKeyword(input: {
  tenantId: number;
  phoneE164: string;
  rawBody: string;
  evidence?: Record<string, unknown>;
}): Promise<{ blocked: boolean; keyword: string | null }> {
  const keyword = matchOptOutKeyword(input.rawBody);
  if (!keyword) {
    return { blocked: false, keyword: null };
  }

  await upsertWhatsappOptIn({
    tenantId: input.tenantId,
    phoneE164: input.phoneE164,
    status: 'opted_out',
    source: 'opt_out_keyword',
    keyword,
    ...(input.evidence ? { evidence: input.evidence } : {}),
  });

  return { blocked: true, keyword };
}
