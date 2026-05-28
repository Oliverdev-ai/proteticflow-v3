import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleWhatsappWebhook, WhatsappWebhookError } from './webhook.service.js';

const mocks = vi.hoisted(() => ({
  getTenantWhatsappConfigBySlug: vi.fn(),
  applyInboundOptOutKeyword: vi.fn(),
  recordInboundWhatsappMessage: vi.fn(),
  updateWhatsappMessageStatusRankAware: vi.fn(),
  recordWhatsappReplayBlocked: vi.fn(),
  recordWhatsappWebhookEvent: vi.fn(),
}));

vi.mock('./whatsapp-config.service.js', () => ({
  getTenantWhatsappConfigBySlug: mocks.getTenantWhatsappConfigBySlug,
}));

vi.mock('./opt-in.service.js', () => ({
  applyInboundOptOutKeyword: mocks.applyInboundOptOutKeyword,
  normalizePhoneE164: (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    return /^[1-9]\d{9,14}$/.test(digits) ? digits : null;
  },
  sanitizeWhatsappBody: (raw: string) => raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(),
}));

vi.mock('./whatsapp-messages.service.js', () => ({
  recordInboundWhatsappMessage: mocks.recordInboundWhatsappMessage,
  updateWhatsappMessageStatusRankAware: mocks.updateWhatsappMessageStatusRankAware,
}));

vi.mock('../../metrics/whatsapp.js', () => ({
  recordWhatsappReplayBlocked: mocks.recordWhatsappReplayBlocked,
  recordWhatsappWebhookEvent: mocks.recordWhatsappWebhookEvent,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTenantWhatsappConfigBySlug.mockResolvedValue({
    tenantId: 77,
    tenantSlug: 'lab-teste',
    whatsappEnabled: true,
    whatsappConfig: {
      provider: 'mock',
      webhookSecret: 'webhook-secret-test',
    },
    whatsappVerifiedAt: null,
  });
  mocks.applyInboundOptOutKeyword.mockResolvedValue({ blocked: false, keyword: null });
  mocks.recordInboundWhatsappMessage.mockResolvedValue({ replay: false });
  mocks.updateWhatsappMessageStatusRankAware.mockResolvedValue({ applied: true, replay: false });
});

function sign(payload: Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

describe('handleWhatsappWebhook', () => {
  it('retorna 403 quando HMAC e invalido', async () => {
    const payload = Buffer.from(JSON.stringify({
      event: 'message',
      direction: 'inbound',
      provider_message_id: 'msg-1',
      from: '5511999990000',
      body: 'oi',
    }));

    await expect(handleWhatsappWebhook({
      tenantSlug: 'lab-teste',
      rawBody: payload,
      signature: 'bad-signature',
    })).rejects.toMatchObject({
      statusCode: 403,
    } satisfies Partial<WhatsappWebhookError>);
  });

  it('bloqueia replay de provider_message_id duplicado', async () => {
    mocks.recordInboundWhatsappMessage.mockResolvedValue({ replay: true });
    const payload = Buffer.from(JSON.stringify({
      event: 'message',
      direction: 'inbound',
      provider_message_id: 'dup-001',
      from: '5511999990000',
      body: 'mensagem duplicada',
    }));

    const result = await handleWhatsappWebhook({
      tenantSlug: 'lab-teste',
      rawBody: payload,
      signature: sign(payload, 'webhook-secret-test'),
    });

    expect(result).toEqual({ accepted: true, replay: true });
    expect(mocks.recordWhatsappReplayBlocked).toHaveBeenCalledWith(77);
  });
});
