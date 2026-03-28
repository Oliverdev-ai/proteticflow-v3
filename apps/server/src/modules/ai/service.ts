import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { AiMessage, AiSession } from '@proteticflow/shared';
import { archiveSessionSchema, createSessionSchema, listSessionsSchema } from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { aiMessages, aiSessions } from '../../db/schema/ai.js';

type CreateSessionInput = z.infer<typeof createSessionSchema>;
type ListSessionsInput = z.infer<typeof listSessionsSchema>;
type ArchiveSessionInput = z.infer<typeof archiveSessionSchema>;

type SessionRow = typeof aiSessions.$inferSelect;
type MessageRow = typeof aiMessages.$inferSelect;

function toSessionModel(row: SessionRow, messageCount?: number): AiSession {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    title: row.title,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(messageCount !== undefined ? { messageCount } : {}),
  };
}

function toMessageModel(row: MessageRow): AiMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    content: row.content,
    commandDetected: row.commandDetected ?? null,
    tokensUsed: row.tokensUsed ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function deriveSessionTitle(content: string): string {
  return content.trim().slice(0, 60);
}

async function getSessionByIdOrThrow(sessionId: number): Promise<SessionRow> {
  const [session] = await db
    .select()
    .from(aiSessions)
    .where(eq(aiSessions.id, sessionId));

  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Sessao nao encontrada' });
  }

  return session;
}

async function assertSessionOwnership(tenantId: number, sessionId: number, userId: number): Promise<SessionRow> {
  const session = await getSessionByIdOrThrow(sessionId);

  if (session.tenantId !== tenantId || session.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissao para acessar esta sessao' });
  }

  return session;
}

export async function createSession(tenantId: number, userId: number, input: CreateSessionInput): Promise<AiSession> {
  const title = input.title?.trim() ? input.title.trim() : null;

  const [created] = await db
    .insert(aiSessions)
    .values({
      tenantId,
      userId,
      title,
      status: 'active',
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar sessao' });
  }

  return toSessionModel(created, 0);
}

export async function listSessions(tenantId: number, userId: number, input: ListSessionsInput) {
  const conditions = [eq(aiSessions.tenantId, tenantId), eq(aiSessions.userId, userId)];
  if (input.cursor) {
    conditions.push(lt(aiSessions.id, input.cursor));
  }

  const rows = await db
    .select()
    .from(aiSessions)
    .where(and(...conditions))
    .orderBy(desc(aiSessions.id))
    .limit(input.limit + 1);

  const pageRows = rows.slice(0, input.limit);
  const hasMore = rows.length > input.limit;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null;

  const sessionIds = pageRows.map((row) => row.id);
  const countRows = sessionIds.length === 0
    ? []
    : await db
      .select({ sessionId: aiMessages.sessionId, count: sql<number>`count(*)` })
      .from(aiMessages)
      .where(and(eq(aiMessages.tenantId, tenantId), inArray(aiMessages.sessionId, sessionIds)))
      .groupBy(aiMessages.sessionId);

  const countMap = new Map(countRows.map((row) => [row.sessionId, Number(row.count)]));

  return {
    data: pageRows.map((row) => toSessionModel(row, countMap.get(row.id) ?? 0)),
    nextCursor,
  };
}

export async function getSession(tenantId: number, sessionId: number, userId: number) {
  const session = await assertSessionOwnership(tenantId, sessionId, userId);

  const messages = await db
    .select()
    .from(aiMessages)
    .where(and(eq(aiMessages.tenantId, tenantId), eq(aiMessages.sessionId, sessionId)))
    .orderBy(aiMessages.createdAt, aiMessages.id);

  return {
    session: toSessionModel(session),
    messages: messages.map(toMessageModel),
  };
}

export async function archiveSession(tenantId: number, userId: number, input: ArchiveSessionInput) {
  await assertSessionOwnership(tenantId, input.sessionId, userId);

  await db
    .update(aiSessions)
    .set({
      status: 'archived',
      updatedAt: new Date(),
    })
    .where(and(eq(aiSessions.tenantId, tenantId), eq(aiSessions.id, input.sessionId), eq(aiSessions.userId, userId)));

  return { success: true };
}

export async function saveMessage(
  tenantId: number,
  sessionId: number,
  userId: number,
  role: 'user' | 'assistant' | 'system',
  content: string,
  commandDetected?: string | null,
  tokensUsed?: number | null,
): Promise<AiMessage> {
  const session = await assertSessionOwnership(tenantId, sessionId, userId);
  const now = new Date();

  const sessionUpdate: { updatedAt: Date; title?: string } = { updatedAt: now };
  if (role === 'user' && !session.title) {
    const derivedTitle = deriveSessionTitle(content);
    if (derivedTitle.length > 0) {
      sessionUpdate.title = derivedTitle;
    }
  }

  await db
    .update(aiSessions)
    .set(sessionUpdate)
    .where(and(eq(aiSessions.tenantId, tenantId), eq(aiSessions.id, sessionId), eq(aiSessions.userId, userId)));

  const messageData: typeof aiMessages.$inferInsert = {
    tenantId,
    sessionId,
    role,
    content,
    createdAt: now,
  };
  if (commandDetected) {
    messageData.commandDetected = commandDetected;
  }
  if (typeof tokensUsed === 'number') {
    messageData.tokensUsed = tokensUsed;
  }

  const [created] = await db
    .insert(aiMessages)
    .values(messageData)
    .returning();

  if (!created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao salvar mensagem' });
  }

  return toMessageModel(created);
}

export async function getRecentMessages(
  tenantId: number,
  sessionId: number,
  userId: number,
  limit = 10,
): Promise<AiMessage[]> {
  await assertSessionOwnership(tenantId, sessionId, userId);

  const rows = await db
    .select()
    .from(aiMessages)
    .where(and(eq(aiMessages.tenantId, tenantId), eq(aiMessages.sessionId, sessionId)))
    .orderBy(desc(aiMessages.createdAt), desc(aiMessages.id))
    .limit(limit);

  return rows.reverse().map(toMessageModel);
}
