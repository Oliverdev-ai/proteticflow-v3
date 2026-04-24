import { and, eq, sql } from 'drizzle-orm';
import type { PlanTier, ProactiveAlertType } from '@proteticflow/shared';
import { PLAN_LIMITS } from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { notifications } from '../../db/schema/notifications.js';
import { pushSubscriptions } from '../../db/schema/users.js';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { sendEmail } from '../notifications/email.js';
import { sendPushToUser } from '../notifications/push.js';
import { countChannelDispatchesThisMonth } from '../proactive/alert-log.service.js';
import {
  getQuietHoursReleaseAt,
  isAlertMuted,
  isWithinQuietHours,
  type ProactiveUserPreferences,
} from '../proactive/preferences.service.js';

export type MessagePriority = 'low' | 'normal' | 'urgent';
export type ChannelName = 'push' | 'email' | 'whatsapp' | 'in_app';

export type TenantCtx = {
  tenantId: number;
  plan: PlanTier;
};

export type Recipient = {
  userId: number;
  name: string;
  email: string | null;
  phone: string | null;
  preferences: ProactiveUserPreferences;
};

export type OutboundMessage = {
  title: string;
  body: string;
  alertType: ProactiveAlertType;
  priority: MessagePriority;
  entityType?: string;
  entityId?: number | null;
  payload?: Record<string, unknown> | null;
  route?: string;
};

export type SendResult = {
  channel: ChannelName;
  status: 'sent';
};

export class NoAvailableChannelError extends Error {
  constructor() {
    super('Nenhum canal disponivel para envio');
    this.name = 'NoAvailableChannelError';
  }
}

export class QuietHoursDeferredError extends Error {
  constructor(readonly releaseAt: Date) {
    super('Mensagem adiada por quiet hours');
    this.name = 'QuietHoursDeferredError';
  }
}

export interface MessageChannel {
  readonly name: ChannelName;
  send(ctx: TenantCtx, to: Recipient, msg: OutboundMessage): Promise<SendResult>;
  canSend(ctx: TenantCtx, to: Recipient, msg: OutboundMessage): Promise<boolean>;
}

function isChannelEnabled(preferences: ProactiveUserPreferences, channel: ChannelName): boolean {
  if (channel === 'in_app') return preferences.channels.in_app === true;
  if (channel === 'push') return preferences.channels.push === true;
  if (channel === 'email') return preferences.channels.email === true;
  if (channel === 'whatsapp') return preferences.channels.whatsapp === true;
  return false;
}

function mapAlertToNotificationEvent(alertType: ProactiveAlertType): 'report_ready' | 'deadline_24h' | 'payment_overdue' {
  if (alertType === 'deadline_24h') return 'deadline_24h';
  if (alertType === 'payment_overdue') return 'payment_overdue';
  return 'report_ready';
}

function mapAlertToNotificationType(alertType: ProactiveAlertType): 'info' | 'warning' | 'error' {
  if (alertType === 'briefing_daily') return 'info';
  return 'warning';
}

export class ChannelRouter {
  constructor(private readonly channels: Record<string, MessageChannel>) {}

  private pickChannels(to: Recipient, priority: MessagePriority): ChannelName[] {
    const preferred: ChannelName[] = priority === 'urgent'
      ? ['push', 'in_app', 'email', 'whatsapp']
      : ['in_app', 'push', 'email', 'whatsapp'];

    return preferred.filter((channel) => isChannelEnabled(to.preferences, channel));
  }

  async send(
    ctx: TenantCtx,
    to: Recipient,
    msg: OutboundMessage,
    priority: MessagePriority,
  ): Promise<SendResult[]> {
    if (priority !== 'urgent' && isWithinQuietHours(to.preferences)) {
      throw new QuietHoursDeferredError(getQuietHoursReleaseAt(to.preferences));
    }

    const ordered = this.pickChannels(to, priority);
    for (const channelName of ordered) {
      const channel = this.channels[channelName];
      if (!channel) continue;
      if (await channel.canSend(ctx, to, msg)) {
        return [await channel.send(ctx, to, msg)];
      }
    }

    throw new NoAvailableChannelError();
  }
}

class PushChannel implements MessageChannel {
  readonly name: ChannelName = 'push';

  async canSend(ctx: TenantCtx, to: Recipient, msg: OutboundMessage): Promise<boolean> {
    if (!isChannelEnabled(to.preferences, this.name)) return false;
    if (isAlertMuted(to.preferences, msg.alertType)) return false;

    const [subscription] = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.tenantId, ctx.tenantId),
        eq(pushSubscriptions.userId, to.userId),
      ))
      .limit(1);

    return Boolean(subscription);
  }

  async send(ctx: TenantCtx, to: Recipient, msg: OutboundMessage): Promise<SendResult> {
    const result = await sendPushToUser(ctx.tenantId, to.userId, {
      title: msg.title,
      body: msg.body,
      url: msg.route ?? '/',
    });

    if ((result.sent ?? 0) <= 0) {
      throw new Error('Push sem assinaturas ativas');
    }

    return { channel: this.name, status: 'sent' };
  }
}

class EmailChannel implements MessageChannel {
  readonly name: ChannelName = 'email';

  async canSend(_ctx: TenantCtx, to: Recipient, msg: OutboundMessage): Promise<boolean> {
    if (!isChannelEnabled(to.preferences, this.name)) return false;
    if (isAlertMuted(to.preferences, msg.alertType)) return false;
    return Boolean(to.email);
  }

  async send(_ctx: TenantCtx, to: Recipient, msg: OutboundMessage): Promise<SendResult> {
    if (!to.email) throw new Error('Destinatario sem email');
    const sent = await sendEmail({
      to: to.email,
      subject: msg.title,
      text: msg.body,
    });
    if (!sent.sent) {
      throw new Error('Email indisponivel');
    }
    return { channel: this.name, status: 'sent' };
  }
}

class InAppChannel implements MessageChannel {
  readonly name: ChannelName = 'in_app';

  async canSend(_ctx: TenantCtx, to: Recipient, msg: OutboundMessage): Promise<boolean> {
    if (!isChannelEnabled(to.preferences, this.name)) return false;
    if (isAlertMuted(to.preferences, msg.alertType)) return false;
    return true;
  }

  async send(ctx: TenantCtx, to: Recipient, msg: OutboundMessage): Promise<SendResult> {
    await db.insert(notifications).values({
      tenantId: ctx.tenantId,
      userId: to.userId,
      title: msg.title,
      message: msg.body,
      type: mapAlertToNotificationType(msg.alertType),
      eventKey: mapAlertToNotificationEvent(msg.alertType),
      relatedJobId: msg.entityType === 'job' ? (msg.entityId ?? null) : null,
    });
    return { channel: this.name, status: 'sent' };
  }
}

class WhatsAppChannel implements MessageChannel {
  readonly name: ChannelName = 'whatsapp';

  async canSend(ctx: TenantCtx, to: Recipient, msg: OutboundMessage): Promise<boolean> {
    if (!isChannelEnabled(to.preferences, this.name)) return false;
    if (isAlertMuted(to.preferences, msg.alertType)) return false;
    if (!to.phone) return false;
    if (env.WHATSAPP_PROVIDER !== 'mock') return false;

    const limit = PLAN_LIMITS[ctx.plan].whatsappPerMonth;
    if (limit === 0) return false;
    if (limit !== null) {
      const used = await countChannelDispatchesThisMonth(ctx.tenantId, this.name);
      if (used >= limit) return false;
    }

    return true;
  }

  async send(ctx: TenantCtx, to: Recipient, msg: OutboundMessage): Promise<SendResult> {
    logger.info(
      {
        action: 'messaging.whatsapp.mock_send',
        tenantId: ctx.tenantId,
        userId: to.userId,
        alertType: msg.alertType,
      },
      'WhatsApp mock: mensagem registrada apenas em log',
    );
    return { channel: this.name, status: 'sent' };
  }
}

export function createChannelRouter(): ChannelRouter {
  const channels: Record<ChannelName, MessageChannel> = {
    push: new PushChannel(),
    email: new EmailChannel(),
    in_app: new InAppChannel(),
    whatsapp: new WhatsAppChannel(),
  };
  return new ChannelRouter(channels);
}

export async function canSendUrgentFallback(
  ctx: TenantCtx,
  to: Recipient,
): Promise<boolean> {
  const [notificationCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(
      eq(notifications.tenantId, ctx.tenantId),
      eq(notifications.userId, to.userId),
    ));
  return (notificationCount?.value ?? 0) >= 0;
}
