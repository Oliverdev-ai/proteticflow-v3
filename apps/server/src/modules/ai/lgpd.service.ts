import { and, desc, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../../db/index.js';
import { aiCommandRuns } from '../../db/schema/ai.js';
import { aiMemory, lgpdRequests } from '../../db/schema/ai-memory.js';
import { alertLog } from '../../db/schema/proactive.js';
import { tenantMembers } from '../../db/schema/tenants.js';
import { users } from '../../db/schema/users.js';
import { logger } from '../../logger.js';
import { clearAllMemory } from './memory.service.js';

type LgpdRequestType = 'export' | 'delete';
type LgpdRequestStatus = 'pending' | 'processing' | 'completed' | 'failed';

type LgpdRequestRow = typeof lgpdRequests.$inferSelect;

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

async function createRequest(
  tenantId: number,
  userId: number,
  type: LgpdRequestType,
): Promise<LgpdRequestRow> {
  const [created] = await db
    .insert(lgpdRequests)
    .values({
      tenantId,
      userId,
      type,
      status: 'pending',
    })
    .returning();

  if (!created) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Falha ao criar solicitacao LGPD',
    });
  }

  return created;
}

async function updateRequestStatus(
  tenantId: number,
  requestId: number,
  status: LgpdRequestStatus,
  patch?: Partial<Pick<typeof lgpdRequests.$inferInsert, 'completedAt' | 'payloadUrl'>>,
): Promise<void> {
  await db
    .update(lgpdRequests)
    .set({
      status,
      ...(patch ?? {}),
    })
    .where(and(
      eq(lgpdRequests.id, requestId),
      eq(lgpdRequests.tenantId, tenantId),
    ));
}

export type LgpdExportPayload = {
  generatedAt: string;
  tenantId: number;
  userId: number;
  memory: Array<{
    key: string;
    value: string;
    source: string;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  aiCommandRuns: Array<{
    id: number;
    intent: string | null;
    rawInput: string;
    executionStatus: string;
    createdAt: string;
    executedAt: string | null;
    toolName: string | null;
    toolInput: Record<string, unknown> | null;
    toolOutput: Record<string, unknown> | null;
  }>;
  alerts: Array<{
    id: string;
    alertType: string;
    entityType: string | null;
    entityId: number | null;
    channel: string;
    sentAt: string;
    payload: Record<string, unknown> | null;
  }>;
};

export async function buildLgpdExportPayload(
  tenantId: number,
  userId: number,
): Promise<LgpdExportPayload> {
  const [memoryRows, commandRows, alertRows] = await Promise.all([
    db
      .select({
        key: aiMemory.key,
        value: aiMemory.value,
        source: aiMemory.source,
        expiresAt: aiMemory.expiresAt,
        createdAt: aiMemory.createdAt,
        updatedAt: aiMemory.updatedAt,
      })
      .from(aiMemory)
      .where(and(
        eq(aiMemory.tenantId, tenantId),
        eq(aiMemory.userId, userId),
      ))
      .orderBy(desc(aiMemory.id)),
    db
      .select({
        id: aiCommandRuns.id,
        intent: aiCommandRuns.intent,
        rawInput: aiCommandRuns.rawInput,
        executionStatus: aiCommandRuns.executionStatus,
        createdAt: aiCommandRuns.createdAt,
        executedAt: aiCommandRuns.executedAt,
        toolName: aiCommandRuns.toolName,
        toolInputJson: aiCommandRuns.toolInputJson,
        toolOutputJson: aiCommandRuns.toolOutputJson,
      })
      .from(aiCommandRuns)
      .where(and(
        eq(aiCommandRuns.tenantId, tenantId),
        eq(aiCommandRuns.userId, userId),
      ))
      .orderBy(desc(aiCommandRuns.id)),
    db
      .select({
        id: alertLog.id,
        alertType: alertLog.alertType,
        entityType: alertLog.entityType,
        entityId: alertLog.entityId,
        channel: alertLog.channel,
        sentAt: alertLog.sentAt,
        payload: alertLog.payload,
      })
      .from(alertLog)
      .where(and(
        eq(alertLog.tenantId, tenantId),
        eq(alertLog.userId, userId),
      ))
      .orderBy(desc(alertLog.sentAt)),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    tenantId,
    userId,
    memory: memoryRows.map((row) => ({
      key: row.key,
      value: row.value,
      source: row.source,
      expiresAt: toIso(row.expiresAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    aiCommandRuns: commandRows.map((row) => ({
      id: row.id,
      intent: row.intent,
      rawInput: row.rawInput,
      executionStatus: row.executionStatus,
      createdAt: row.createdAt.toISOString(),
      executedAt: toIso(row.executedAt),
      toolName: row.toolName,
      toolInput: row.toolInputJson && typeof row.toolInputJson === 'object'
        ? row.toolInputJson as Record<string, unknown>
        : null,
      toolOutput: row.toolOutputJson && typeof row.toolOutputJson === 'object'
        ? row.toolOutputJson as Record<string, unknown>
        : null,
    })),
    alerts: alertRows.map((row) => ({
      id: row.id,
      alertType: row.alertType,
      entityType: row.entityType,
      entityId: row.entityId,
      channel: row.channel,
      sentAt: row.sentAt.toISOString(),
      payload: row.payload,
    })),
  };
}

export async function requestLgpdExport(tenantId: number, userId: number): Promise<{
  requestId: number;
  status: 'completed';
  payload: LgpdExportPayload;
}> {
  const request = await createRequest(tenantId, userId, 'export');
  await updateRequestStatus(tenantId, request.id, 'processing');

  try {
    const payload = await buildLgpdExportPayload(tenantId, userId);
    await updateRequestStatus(tenantId, request.id, 'completed', {
      completedAt: new Date(),
    });

    logger.info(
      { action: 'ai.lgpd.export.completed', tenantId, userId, requestId: request.id },
      'Exportacao LGPD concluida',
    );

    return {
      requestId: request.id,
      status: 'completed',
      payload,
    };
  } catch (error) {
    await updateRequestStatus(tenantId, request.id, 'failed');
    logger.error(
      { err: error, action: 'ai.lgpd.export.failed', tenantId, userId, requestId: request.id },
      'Falha na exportacao LGPD',
    );
    throw error;
  }
}

export async function requestLgpdDelete(tenantId: number, userId: number): Promise<{
  requestId: number;
  status: 'completed';
}> {
  const request = await createRequest(tenantId, userId, 'delete');
  await updateRequestStatus(tenantId, request.id, 'processing');

  try {
    await clearAllMemory(tenantId, userId);
    await db
      .delete(aiCommandRuns)
      .where(and(
        eq(aiCommandRuns.tenantId, tenantId),
        eq(aiCommandRuns.userId, userId),
      ));

    await db
      .update(users)
      .set({
        name: `Usuario anonimizado ${userId}`,
        email: `anon+${userId}@proteticflow.local`,
        phone: null,
        phoneE164: null,
        phoneVerified: false,
        whatsappOptIn: false,
        updatedAt: new Date(),
      })
      .where(and(
        eq(users.id, userId),
        eq(tenantMembers.userId, users.id),
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.tenantId, tenantId),
      ))
      .from(tenantMembers);

    await updateRequestStatus(tenantId, request.id, 'completed', {
      completedAt: new Date(),
    });

    logger.info(
      { action: 'ai.lgpd.delete.completed', tenantId, userId, requestId: request.id },
      'Solicitacao de exclusao LGPD concluida',
    );

    return {
      requestId: request.id,
      status: 'completed',
    };
  } catch (error) {
    await updateRequestStatus(tenantId, request.id, 'failed');
    logger.error(
      { err: error, action: 'ai.lgpd.delete.failed', tenantId, userId, requestId: request.id },
      'Falha na solicitacao de exclusao LGPD',
    );
    throw error;
  }
}
