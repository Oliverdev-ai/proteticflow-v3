import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageChannel, OutboundMessage, Recipient, TenantCtx } from './channel.js';
import { ChannelRouter, QuietHoursDeferredError, WhatsAppChannel } from './channel.js';

const mocks = vi.hoisted(() => ({
  sendBlipWhatsApp: vi.fn(),
  canSendWhatsappByOptIn: vi.fn(),
  createOutboundWhatsappMessageLog: vi.fn(),
  markWhatsappMessageSent: vi.fn(),
  markWhatsappMessageFailed: vi.fn(),
}));

vi.mock('./providers/blip.provider.js', () => ({
  sendBlipWhatsApp: mocks.sendBlipWhatsApp,
}));

vi.mock('./opt-in.service.js', () => ({
  canSendWhatsappByOptIn: mocks.canSendWhatsappByOptIn,
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
}));

vi.mock('../../metrics/whatsapp.js', () => ({
  recordWhatsappOptInBlocked: vi.fn(),
  recordWhatsappSend: vi.fn(),
  observeWhatsappSendLatency: vi.fn(),
}));

class StubChannel implements MessageChannel {
  constructor(
    readonly name: 'push' | 'email' | 'whatsapp' | 'in_app',
    private readonly canSendResult: boolean,
    private readonly sentLog: string[],
  ) {}

  async canSend(
    _ctx: TenantCtx,
    _to: Recipient,
    _msg: OutboundMessage,
  ): Promise<boolean> {
    return this.canSendResult;
  }

  async send(
    _ctx: TenantCtx,
    _to: Recipient,
    _msg: OutboundMessage,
  ): Promise<{ channel: 'push' | 'email' | 'whatsapp' | 'in_app'; status: 'sent' }> {
    this.sentLog.push(this.name);
    return { channel: this.name, status: 'sent' };
  }
}

function createRecipient(overrides?: Partial<Recipient>): Recipient {
  return {
    userId: 1,
    name: 'Usuario',
    email: 'user@test.com',
    phone: '5511999999999',
    whatsappOptIn: true,
    whatsappEnabled: true,
    whatsappConfig: {
      provider: 'blip',
      blip: {
        apiToken: 'blip-token-test',
        fromNumber: '5511999990000',
      },
    },
    preferences: {
      userId: 1,
      tenantId: 1,
      briefingEnabled: true,
      briefingTime: '08:00',
      quietHoursStart: '20:00',
      quietHoursEnd: '07:00',
      quietModeEnabled: false,
      quietModeStart: '22:00',
      quietModeEnd: '07:00',
      channels: {
        push: true,
        email: true,
        whatsapp: false,
        in_app: true,
      },
      alertTypesMuted: [],
      updatedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

const tenantCtx: TenantCtx = {
  tenantId: 1,
  plan: 'pro',
};

const tenantCtxEnterprise: TenantCtx = {
  tenantId: 1,
  plan: 'enterprise',
};

const baseMessage: OutboundMessage = {
  title: 'Teste',
  body: 'Mensagem de teste',
  alertType: 'deadline_24h',
  priority: 'normal',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canSendWhatsappByOptIn.mockResolvedValue(true);
  mocks.createOutboundWhatsappMessageLog.mockResolvedValue(101);
  mocks.markWhatsappMessageSent.mockResolvedValue(undefined);
  mocks.markWhatsappMessageFailed.mockResolvedValue(undefined);
  mocks.sendBlipWhatsApp.mockResolvedValue({ id: 'blip-msg-1' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ChannelRouter', () => {
  it('faz fallback quando canal prioritario nao esta disponivel', async () => {
    const sentLog: string[] = [];
    const router = new ChannelRouter({
      in_app: new StubChannel('in_app', false, sentLog),
      push: new StubChannel('push', true, sentLog),
      email: new StubChannel('email', true, sentLog),
    });

    const recipient = createRecipient({
      preferences: {
        ...createRecipient().preferences,
        quietHoursStart: '23:00',
        quietHoursEnd: '23:01',
        channels: {
          push: true,
          email: true,
          whatsapp: false,
          in_app: true,
        },
      },
    });

    const result = await router.send(tenantCtx, recipient, baseMessage, 'normal');
    expect(result[0]?.channel).toBe('push');
    expect(sentLog).toEqual(['push']);
  });

  it('respeita quiet hours para alertas nao urgentes', async () => {
    const router = new ChannelRouter({
      in_app: new StubChannel('in_app', true, []),
    });

    const recipient = createRecipient({
      preferences: {
        ...createRecipient().preferences,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
      },
    });

    await expect(router.send(tenantCtx, recipient, baseMessage, 'normal'))
      .rejects
      .toBeInstanceOf(QuietHoursDeferredError);
  });
});

describe('WhatsAppChannel', () => {
  it('canSend retorna false quando tenant nao habilitou WhatsApp', async () => {
    const channel = new WhatsAppChannel();
    const recipient = createRecipient({
      whatsappEnabled: false,
      preferences: {
        ...createRecipient().preferences,
        channels: {
          push: false,
          email: false,
          whatsapp: true,
          in_app: false,
        },
      },
    });

    await expect(channel.canSend(tenantCtxEnterprise, recipient, baseMessage)).resolves.toBe(false);
  });

  it('canSend retorna false quando opt-in registry nao permite envio', async () => {
    mocks.canSendWhatsappByOptIn.mockResolvedValue(false);

    const channel = new WhatsAppChannel();
    const recipient = createRecipient({
      preferences: {
        ...createRecipient().preferences,
        channels: {
          push: false,
          email: false,
          whatsapp: true,
          in_app: false,
        },
      },
    });

    await expect(channel.canSend(tenantCtxEnterprise, recipient, baseMessage)).resolves.toBe(false);
  });

  it('send com provider=blip sanitiza body e registra pre e pos envio', async () => {
    const channel = new WhatsAppChannel();
    const recipient = createRecipient({
      phone: '+55 (11) 9 9999-0000',
      preferences: {
        ...createRecipient().preferences,
        channels: {
          push: false,
          email: false,
          whatsapp: true,
          in_app: false,
        },
      },
    });

    const result = await channel.send(tenantCtxEnterprise, recipient, {
      ...baseMessage,
      body: 'Linha 1\r\nLinha 2',
    });

    expect(mocks.createOutboundWhatsappMessageLog).toHaveBeenCalledTimes(1);
    expect(mocks.sendBlipWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiToken: 'blip-token-test' }),
      '5511999990000',
      'Linha 1 Linha 2',
    );
    expect(mocks.markWhatsappMessageSent).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ channel: 'whatsapp', status: 'sent' });
  });

  it('send falha quando phone nao esta em E.164', async () => {
    const channel = new WhatsAppChannel();
    const recipient = createRecipient({
      phone: '123',
      preferences: {
        ...createRecipient().preferences,
        channels: {
          push: false,
          email: false,
          whatsapp: true,
          in_app: false,
        },
      },
    });

    await expect(channel.send(tenantCtxEnterprise, recipient, baseMessage))
      .rejects
      .toThrow('Destinatario sem phone_e164 valido');
    expect(mocks.createOutboundWhatsappMessageLog).not.toHaveBeenCalled();
  });
});
