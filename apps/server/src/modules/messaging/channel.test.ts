import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../env.js';
import type { MessageChannel, OutboundMessage, Recipient, TenantCtx } from './channel.js';
import { ChannelRouter, QuietHoursDeferredError, WhatsAppChannel } from './channel.js';

const { sendBlipWhatsAppMock } = vi.hoisted(() => ({
  sendBlipWhatsAppMock: vi.fn(),
}));

vi.mock('./providers/blip.provider.js', () => ({
  sendBlipWhatsApp: sendBlipWhatsAppMock,
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
    name: 'Usuário',
    email: 'user@test.com',
    phone: '5511999999999',
    preferences: {
      userId: 1,
      tenantId: 1,
      briefingEnabled: true,
      briefingTime: '08:00',
      quietHoursStart: '20:00',
      quietHoursEnd: '07:00',
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

const ORIGINAL_ENV = {
  WHATSAPP_PROVIDER: env.WHATSAPP_PROVIDER,
  BLIP_API_TOKEN: env.BLIP_API_TOKEN,
  BLIP_FROM_NUMBER: env.BLIP_FROM_NUMBER,
};

afterEach(() => {
  vi.clearAllMocks();
  env.WHATSAPP_PROVIDER = ORIGINAL_ENV.WHATSAPP_PROVIDER;
  env.BLIP_API_TOKEN = ORIGINAL_ENV.BLIP_API_TOKEN;
  env.BLIP_FROM_NUMBER = ORIGINAL_ENV.BLIP_FROM_NUMBER;
});

describe('ChannelRouter', () => {
  it('faz fallback quando canal prioritário não está disponível', async () => {
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

  it('respeita quiet hours para alertas não urgentes', async () => {
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

  it('bypassa quiet hours quando prioridade é urgent', async () => {
    const sentLog: string[] = [];
    const router = new ChannelRouter({
      in_app: new StubChannel('in_app', true, sentLog),
    });

    const recipient = createRecipient({
      preferences: {
        ...createRecipient().preferences,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
      },
    });

    const result = await router.send(tenantCtx, recipient, {
      ...baseMessage,
      priority: 'urgent',
      alertType: 'stock_low',
    }, 'urgent');

    expect(result[0]?.channel).toBe('in_app');
    expect(sentLog).toEqual(['in_app']);
  });
});

describe('WhatsAppChannel', () => {
  it('canSend retorna false com provider=blip sem token', async () => {
    env.WHATSAPP_PROVIDER = 'blip';
    env.BLIP_API_TOKEN = undefined;
    env.BLIP_FROM_NUMBER = '5511999990000';

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

  it('canSend retorna true com provider=blip e token configurado', async () => {
    env.WHATSAPP_PROVIDER = 'blip';
    env.BLIP_API_TOKEN = 'blip-token-test';
    env.BLIP_FROM_NUMBER = '5511999990000';

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

    await expect(channel.canSend(tenantCtxEnterprise, recipient, baseMessage)).resolves.toBe(true);
  });

  it('send com provider=blip chama sendBlipWhatsApp com E.164 normalizado', async () => {
    env.WHATSAPP_PROVIDER = 'blip';
    env.BLIP_API_TOKEN = 'blip-token-test';
    env.BLIP_FROM_NUMBER = '5511999990000';
    sendBlipWhatsAppMock.mockResolvedValue({ id: 'blip-msg-1' });

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

    const result = await channel.send(tenantCtxEnterprise, recipient, baseMessage);
    expect(sendBlipWhatsAppMock).toHaveBeenCalledWith('5511999990000', 'Mensagem de teste');
    expect(result).toEqual({ channel: 'whatsapp', status: 'sent' });
  });
});
