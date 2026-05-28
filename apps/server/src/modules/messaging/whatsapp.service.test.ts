import { describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { requestWhatsappOptInAndNotify, sendWhatsappTemplateMessage } from './whatsapp.service.js';

const mocks = vi.hoisted(() => ({
  getTenantWhatsappConfigById: vi.fn(),
  canSendWhatsappByOptIn: vi.fn(),
  requestWhatsappOptIn: vi.fn(),
  createOutboundWhatsappMessageLog: vi.fn(),
  markWhatsappMessageSent: vi.fn(),
  markWhatsappMessageFailed: vi.fn(),
  sendBlipWhatsApp: vi.fn(),
  recordWhatsappOptInBlocked: vi.fn(),
  recordWhatsappSend: vi.fn(),
  observeWhatsappSendLatency: vi.fn(),
}));

vi.mock('./whatsapp-config.service.js', () => ({
  getTenantWhatsappConfigById: mocks.getTenantWhatsappConfigById,
}));

vi.mock('./opt-in.service.js', () => ({
  canSendWhatsappByOptIn: mocks.canSendWhatsappByOptIn,
  requestWhatsappOptIn: mocks.requestWhatsappOptIn,
  normalizePhoneE164: (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    return /^[1-9]\d{9,14}$/.test(digits) ? digits : null;
  },
  sanitizeWhatsappBody: (raw: string) => raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(),
}));

vi.mock('./whatsapp-messages.service.js', () => ({
  createOutboundWhatsappMessageLog: mocks.createOutboundWhatsappMessageLog,
  markWhatsappMessageSent: mocks.markWhatsappMessageSent,
  markWhatsappMessageFailed: mocks.markWhatsappMessageFailed,
  getWhatsappUsage: vi.fn(),
  listWhatsappConversation: vi.fn(),
  listWhatsappTemplatesStatus: vi.fn(),
}));

vi.mock('./providers/blip.provider.js', () => ({
  sendBlipWhatsApp: mocks.sendBlipWhatsApp,
}));

vi.mock('../../metrics/whatsapp.js', () => ({
  recordWhatsappOptInBlocked: mocks.recordWhatsappOptInBlocked,
  recordWhatsappSend: mocks.recordWhatsappSend,
  observeWhatsappSendLatency: mocks.observeWhatsappSendLatency,
}));

describe('sendWhatsappTemplateMessage', () => {
  it('bloqueia envio quando telefone nao tem opt-in valido', async () => {
    mocks.getTenantWhatsappConfigById.mockResolvedValue({
      tenantId: 1,
      tenantSlug: 'tenant-1',
      whatsappEnabled: true,
      whatsappConfig: { provider: 'mock' },
      whatsappVerifiedAt: null,
    });
    mocks.canSendWhatsappByOptIn.mockResolvedValue(false);

    await expect(sendWhatsappTemplateMessage({
      tenantId: 1,
      userId: 9,
      phone: '5511999990000',
      templateName: 'cobranca',
      variables: { vencimento: '2026-06-01' },
    })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<TRPCError>);

    expect(mocks.createOutboundWhatsappMessageLog).not.toHaveBeenCalled();
    expect(mocks.recordWhatsappOptInBlocked).toHaveBeenCalledWith(1, 'send_template_without_opt_in');
  });
});

describe('requestWhatsappOptInAndNotify', () => {
  it('bloqueia solicitacao quando WhatsApp do tenant esta desabilitado', async () => {
    mocks.getTenantWhatsappConfigById.mockResolvedValue({
      tenantId: 1,
      tenantSlug: 'tenant-1',
      whatsappEnabled: false,
      whatsappConfig: { provider: 'mock' },
      whatsappVerifiedAt: null,
    });

    await expect(requestWhatsappOptInAndNotify({
      tenantId: 1,
      userId: 9,
      phone: '5511999990000',
    })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<TRPCError>);

    expect(mocks.requestWhatsappOptIn).not.toHaveBeenCalled();
    expect(mocks.createOutboundWhatsappMessageLog).not.toHaveBeenCalled();
  });
});
