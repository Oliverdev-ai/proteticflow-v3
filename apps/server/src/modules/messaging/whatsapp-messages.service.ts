import {
  and,
  desc,
  eq,
  gte,
  lte,
  sql,
} from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  whatsappMessages,
  whatsappTemplates,
  whatsappProviderEnum,
} from '../../db/schema/whatsapp.js';

const STATUS_RANK = {
  blocked: 5,
  failed: 10,
  queued: 20,
  sent: 30,
  delivered: 40,
  read: 50,
  received: 60,
} as const;

export type WhatsappProvider = typeof whatsappProviderEnum.enumValues[number];
export type WhatsappMessageStatus = keyof typeof STATUS_RANK;

function statusTimestampPatch(status: WhatsappMessageStatus, at: Date) {
  if (status === 'sent') return { sentAt: at };
  if (status === 'delivered') return { deliveredAt: at };
  if (status === 'read') return { readAt: at };
  if (status === 'failed') return { failedAt: at };
  return {};
}

export function getWhatsappStatusRank(status: WhatsappMessageStatus): number {
  return STATUS_RANK[status];
}

export async function createOutboundWhatsappMessageLog(input: {
  tenantId: number;
  clientId?: number | null;
  userId?: number | null;
  provider: WhatsappProvider;
  phoneE164: string;
  body: string;
  templateName?: string | null;
  providerMessageId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<number> {
  const now = new Date();
  const [created] = await db
    .insert(whatsappMessages)
    .values({
      tenantId: input.tenantId,
      clientId: input.clientId ?? null,
      userId: input.userId ?? null,
      direction: 'outbound',
      status: 'queued',
      provider: input.provider,
      providerMessageId: input.providerMessageId ?? null,
      phoneE164: input.phoneE164,
      templateName: input.templateName ?? null,
      body: input.body,
      meta: input.meta ?? {},
      statusRank: getWhatsappStatusRank('queued'),
      updatedAt: now,
    })
    .returning({ id: whatsappMessages.id });

  if (!created) {
    throw new Error('Falha ao criar log outbound de WhatsApp');
  }

  return created.id;
}

export async function markWhatsappMessageSent(input: {
  id: number;
  providerMessageId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date();
  await db
    .update(whatsappMessages)
    .set({
      status: 'sent',
      statusRank: getWhatsappStatusRank('sent'),
      providerMessageId: input.providerMessageId ?? null,
      meta: input.meta ?? {},
      updatedAt: now,
      ...statusTimestampPatch('sent', now),
    })
    .where(eq(whatsappMessages.id, input.id));
}

export async function markWhatsappMessageFailed(input: {
  id: number;
  errorMessage: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date();
  await db
    .update(whatsappMessages)
    .set({
      status: 'failed',
      statusRank: getWhatsappStatusRank('failed'),
      errorMessage: input.errorMessage,
      meta: input.meta ?? {},
      updatedAt: now,
      ...statusTimestampPatch('failed', now),
    })
    .where(eq(whatsappMessages.id, input.id));
}

export async function recordInboundWhatsappMessage(input: {
  tenantId: number;
  provider: WhatsappProvider;
  providerMessageId: string;
  phoneE164: string;
  body: string;
  meta?: Record<string, unknown>;
}): Promise<{ replay: boolean }> {
  const now = new Date();
  const inserted = await db
    .insert(whatsappMessages)
    .values({
      tenantId: input.tenantId,
      direction: 'inbound',
      status: 'received',
      provider: input.provider,
      providerMessageId: input.providerMessageId,
      phoneE164: input.phoneE164,
      body: input.body,
      meta: input.meta ?? {},
      statusRank: getWhatsappStatusRank('received'),
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [whatsappMessages.tenantId, whatsappMessages.providerMessageId],
    })
    .returning({ id: whatsappMessages.id });

  return { replay: inserted.length === 0 };
}

export async function updateWhatsappMessageStatusRankAware(input: {
  tenantId: number;
  providerMessageId: string;
  status: WhatsappMessageStatus;
  eventAt?: Date;
  fallbackPhoneE164?: string;
  provider: WhatsappProvider;
  meta?: Record<string, unknown>;
}): Promise<{ applied: boolean; replay: boolean }> {
  const now = input.eventAt ?? new Date();
  const nextRank = getWhatsappStatusRank(input.status);
  const [current] = await db
    .select({
      id: whatsappMessages.id,
      statusRank: whatsappMessages.statusRank,
    })
    .from(whatsappMessages)
    .where(and(
      eq(whatsappMessages.tenantId, input.tenantId),
      eq(whatsappMessages.providerMessageId, input.providerMessageId),
    ))
    .limit(1);

  if (!current) {
    if (!input.fallbackPhoneE164) {
      return { applied: false, replay: false };
    }

    const [created] = await db
      .insert(whatsappMessages)
      .values({
        tenantId: input.tenantId,
        direction: 'outbound',
        status: input.status,
        statusRank: nextRank,
        provider: input.provider,
        providerMessageId: input.providerMessageId,
        phoneE164: input.fallbackPhoneE164,
        body: '',
        meta: input.meta ?? {},
        updatedAt: now,
        ...statusTimestampPatch(input.status, now),
      })
      .onConflictDoNothing({
        target: [whatsappMessages.tenantId, whatsappMessages.providerMessageId],
      })
      .returning({ id: whatsappMessages.id });

    return { applied: Boolean(created), replay: !created };
  }

  if (nextRank <= current.statusRank) {
    return { applied: false, replay: true };
  }

  await db
    .update(whatsappMessages)
    .set({
      status: input.status,
      statusRank: nextRank,
      meta: input.meta ?? {},
      updatedAt: now,
      ...statusTimestampPatch(input.status, now),
    })
    .where(eq(whatsappMessages.id, current.id));

  return { applied: true, replay: false };
}

export async function listWhatsappConversation(input: {
  tenantId: number;
  phoneE164: string;
  limit: number;
}): Promise<Array<{
  id: number;
  direction: 'inbound' | 'outbound';
  status: WhatsappMessageStatus;
  body: string;
  createdAt: string;
  providerMessageId: string | null;
}>> {
  const rows = await db
    .select({
      id: whatsappMessages.id,
      direction: whatsappMessages.direction,
      status: whatsappMessages.status,
      body: whatsappMessages.body,
      createdAt: whatsappMessages.createdAt,
      providerMessageId: whatsappMessages.providerMessageId,
    })
    .from(whatsappMessages)
    .where(and(
      eq(whatsappMessages.tenantId, input.tenantId),
      eq(whatsappMessages.phoneE164, input.phoneE164),
    ))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(input.limit);

  return rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    status: row.status as WhatsappMessageStatus,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    providerMessageId: row.providerMessageId ?? null,
  }));
}

export async function getWhatsappUsage(input: {
  tenantId: number;
  startAt: Date;
  endAt: Date;
}): Promise<{
  total: number;
  outbound: number;
  inbound: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}> {
  const rows = await db
    .select({
      direction: whatsappMessages.direction,
      status: whatsappMessages.status,
      total: sql<number>`count(*)::int`,
    })
    .from(whatsappMessages)
    .where(and(
      eq(whatsappMessages.tenantId, input.tenantId),
      gte(whatsappMessages.createdAt, input.startAt),
      lte(whatsappMessages.createdAt, input.endAt),
    ))
    .groupBy(whatsappMessages.direction, whatsappMessages.status);

  let total = 0;
  let outbound = 0;
  let inbound = 0;
  let sent = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;

  for (const row of rows) {
    total += row.total;
    if (row.direction === 'outbound') outbound += row.total;
    if (row.direction === 'inbound') inbound += row.total;
    if (row.status === 'sent') sent += row.total;
    if (row.status === 'delivered') delivered += row.total;
    if (row.status === 'read') read += row.total;
    if (row.status === 'failed') failed += row.total;
  }

  return { total, outbound, inbound, sent, delivered, read, failed };
}

export async function listWhatsappTemplatesStatus(input: {
  tenantId: number;
}): Promise<Array<{
  id: number;
  templateName: string;
  language: string;
  status: 'pending' | 'approved' | 'rejected' | 'disabled';
  lastSyncedAt: string | null;
  rejectedReason: string | null;
}>> {
  const rows = await db
    .select({
      id: whatsappTemplates.id,
      templateName: whatsappTemplates.templateName,
      language: whatsappTemplates.language,
      status: whatsappTemplates.status,
      lastSyncedAt: whatsappTemplates.lastSyncedAt,
      rejectedReason: whatsappTemplates.rejectedReason,
    })
    .from(whatsappTemplates)
    .where(eq(whatsappTemplates.tenantId, input.tenantId))
    .orderBy(desc(whatsappTemplates.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    templateName: row.templateName,
    language: row.language,
    status: row.status,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    rejectedReason: row.rejectedReason ?? null,
  }));
}
