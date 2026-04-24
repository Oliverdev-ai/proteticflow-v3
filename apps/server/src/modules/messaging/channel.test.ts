import { describe, expect, it } from 'vitest';
import type { MessageChannel, OutboundMessage, Recipient, TenantCtx } from './channel.js';
import { ChannelRouter, QuietHoursDeferredError } from './channel.js';

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

const baseMessage: OutboundMessage = {
  title: 'Teste',
  body: 'Mensagem de teste',
  alertType: 'deadline_24h',
  priority: 'normal',
};

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
