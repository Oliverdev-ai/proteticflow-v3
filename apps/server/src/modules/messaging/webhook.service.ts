import crypto from 'node:crypto';
import { logger } from '../../logger.js';
import { getTenantWhatsappConfigBySlug } from './whatsapp-config.service.js';
import {
  applyInboundOptOutKeyword,
  normalizePhoneE164,
  sanitizeWhatsappBody,
} from './opt-in.service.js';
import {
  recordInboundWhatsappMessage,
  updateWhatsappMessageStatusRankAware,
  type WhatsappMessageStatus,
  type WhatsappProvider,
} from './whatsapp-messages.service.js';
import {
  recordWhatsappReplayBlocked,
  recordWhatsappWebhookEvent,
} from '../../metrics/whatsapp.js';

type JsonRecord = Record<string, unknown>;

export class WhatsappWebhookError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'WhatsappWebhookError';
  }
}

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return null;
}

function pickString(source: JsonRecord | null, keys: string[]): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function toWhatsappStatus(raw: string): WhatsappMessageStatus | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'queued') return 'queued';
  if (normalized === 'sent' || normalized === 'accepted') return 'sent';
  if (normalized === 'delivered') return 'delivered';
  if (normalized === 'read') return 'read';
  if (normalized === 'failed' || normalized === 'error' || normalized === 'undelivered') return 'failed';
  if (normalized === 'blocked' || normalized === 'opted_out') return 'blocked';
  if (normalized === 'received' || normalized === 'inbound') return 'received';
  return null;
}

function toComparableBuffer(raw: string): Buffer {
  return Buffer.from(raw, 'utf8');
}

export function verifyWhatsappWebhookHmac(
  payload: Buffer,
  providedSignature: string,
  secret: string,
): boolean {
  if (!providedSignature) return false;
  const normalized = providedSignature.startsWith('sha256=')
    ? providedSignature.slice('sha256='.length)
    : providedSignature;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuffer = toComparableBuffer(expected);
  const providedBuffer = toComparableBuffer(normalized);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function extractWebhookEvent(payload: JsonRecord) {
  const data = asRecord(payload['data']) ?? payload;
  const message = asRecord(data['message']);
  const status = asRecord(data['status']);

  const providerMessageId = pickString(data, ['provider_message_id', 'providerMessageId', 'message_id', 'messageId'])
    ?? pickString(message, ['id', 'messageId'])
    ?? pickString(status, ['messageId', 'id']);

  const direction = pickString(data, ['direction'])
    ?? pickString(message, ['direction'])
    ?? pickString(status, ['direction']);

  const statusRaw = pickString(data, ['status'])
    ?? pickString(status, ['status'])
    ?? pickString(message, ['status']);

  const bodyRaw = pickString(data, ['body', 'text'])
    ?? pickString(message, ['body', 'text']);

  const phoneFrom = pickString(data, ['from', 'from_phone', 'fromPhone'])
    ?? pickString(message, ['from', 'phone']);
  const phoneTo = pickString(data, ['to', 'to_phone', 'toPhone'])
    ?? pickString(message, ['to', 'phone']);

  const eventType = pickString(data, ['event', 'eventType', 'type'])
    ?? (statusRaw ? 'status_update' : 'message');

  return {
    providerMessageId,
    direction: direction?.toLowerCase() ?? null,
    statusRaw,
    bodyRaw,
    phoneFrom,
    phoneTo,
    eventType,
  };
}

export async function handleWhatsappWebhook(input: {
  tenantSlug: string;
  rawBody: Buffer;
  signature: string;
}): Promise<{ accepted: true; replay: boolean }> {
  const tenant = await getTenantWhatsappConfigBySlug(input.tenantSlug);
  if (!tenant) {
    throw new WhatsappWebhookError('Tenant do webhook nao encontrado', 404);
  }
  if (!tenant.whatsappEnabled) {
    throw new WhatsappWebhookError('WhatsApp desabilitado para o tenant', 403);
  }

  const secret = tenant.whatsappConfig.webhookSecret;
  if (!secret) {
    throw new WhatsappWebhookError('Webhook WhatsApp sem segredo configurado', 503);
  }

  const signatureOk = verifyWhatsappWebhookHmac(input.rawBody, input.signature, secret);
  if (!signatureOk) {
    recordWhatsappWebhookEvent(tenant.tenantId, 'invalid_signature', 'failed');
    throw new WhatsappWebhookError('Assinatura HMAC invalida', 403);
  }

  let parsedPayload: JsonRecord;
  try {
    const parsed = JSON.parse(input.rawBody.toString('utf8')) as unknown;
    parsedPayload = asRecord(parsed) ?? {};
  } catch {
    recordWhatsappWebhookEvent(tenant.tenantId, 'invalid_payload', 'failed');
    throw new WhatsappWebhookError('Payload JSON invalido', 400);
  }

  const provider = tenant.whatsappConfig.provider as WhatsappProvider;
  const event = extractWebhookEvent(parsedPayload);

  if (!event.providerMessageId) {
    recordWhatsappWebhookEvent(tenant.tenantId, event.eventType, 'ignored');
    return { accepted: true, replay: false };
  }

  const isInbound = event.direction === 'inbound' || (!event.statusRaw && Boolean(event.bodyRaw));
  if (isInbound) {
    const inboundPhone = normalizePhoneE164(event.phoneFrom ?? event.phoneTo ?? '');
    if (!inboundPhone) {
      recordWhatsappWebhookEvent(tenant.tenantId, event.eventType, 'ignored');
      return { accepted: true, replay: false };
    }

    const sanitizedBody = sanitizeWhatsappBody(event.bodyRaw ?? '');
    const saved = await recordInboundWhatsappMessage({
      tenantId: tenant.tenantId,
      provider,
      providerMessageId: event.providerMessageId,
      phoneE164: inboundPhone,
      body: sanitizedBody,
      meta: parsedPayload,
    });

    if (saved.replay) {
      recordWhatsappReplayBlocked(tenant.tenantId);
      recordWhatsappWebhookEvent(tenant.tenantId, event.eventType, 'replay');
      return { accepted: true, replay: true };
    }

    if (sanitizedBody) {
      const optOut = await applyInboundOptOutKeyword({
        tenantId: tenant.tenantId,
        phoneE164: inboundPhone,
        rawBody: sanitizedBody,
        evidence: {
          source: 'webhook_inbound',
          providerMessageId: event.providerMessageId,
        },
      });
      if (optOut.blocked) {
        logger.info(
          {
            action: 'whatsapp.opt_out.keyword',
            tenantId: tenant.tenantId,
            keyword: optOut.keyword,
            phoneE164: inboundPhone,
          },
          'Opt-out WhatsApp aplicado por keyword',
        );
      }
    }

    recordWhatsappWebhookEvent(tenant.tenantId, event.eventType, 'processed');
    return { accepted: true, replay: false };
  }

  const status = event.statusRaw ? toWhatsappStatus(event.statusRaw) : null;
  if (!status) {
    recordWhatsappWebhookEvent(tenant.tenantId, event.eventType, 'ignored');
    return { accepted: true, replay: false };
  }

  const fallbackPhone = normalizePhoneE164(event.phoneTo ?? event.phoneFrom ?? '');
  const updated = await updateWhatsappMessageStatusRankAware({
    tenantId: tenant.tenantId,
    provider,
    providerMessageId: event.providerMessageId,
    status,
    meta: parsedPayload,
    ...(fallbackPhone ? { fallbackPhoneE164: fallbackPhone } : {}),
  });

  if (updated.replay) {
    recordWhatsappReplayBlocked(tenant.tenantId);
    recordWhatsappWebhookEvent(tenant.tenantId, event.eventType, 'replay');
    return { accepted: true, replay: true };
  }

  if (!updated.applied) {
    logger.warn(
      {
        action: 'whatsapp.webhook.status_update_without_phone',
        tenantId: tenant.tenantId,
        providerMessageId: event.providerMessageId,
      },
      'Status update recebido sem phone e sem mensagem base para reconciliar',
    );
    recordWhatsappWebhookEvent(tenant.tenantId, event.eventType, 'ignored');
    return { accepted: true, replay: false };
  }

  recordWhatsappWebhookEvent(tenant.tenantId, event.eventType, 'processed');
  return { accepted: true, replay: false };
}
