import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type {
  AIFeatureFlagsInput,
  AiMessage,
  AiSession,
  ListAiPredictionsInput,
  ListAiRecommendationsInput,
  RecordAiFeedbackInput,
  Role,
} from '@proteticflow/shared';
import {
  PLAN_TIER,
  archiveSessionSchema,
  createSessionSchema,
  listSessionsSchema,
} from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { aiCommandRuns, aiMessages, aiSessions } from '../../db/schema/ai.js';
import {
  aiFeedback,
  aiFeatureSnapshots,
  aiModelRuns,
  aiPredictions,
  aiRecommendations,
  aiTenantSettings,
  financialClosings,
  jobs,
  materials,
  tenants,
} from '../../db/schema/index.js';
import { logger } from '../../logger.js';
import { logAudit } from '../audit/service.js';
import {
  FLOW_COMMANDS,
  checkCommandAccess,
  parseIntent,
  resolveEntities,
  type FlowCommandName,
  type ParsedEntities,
  type ResolvedEntities,
  type RiskLevel,
} from './command-parser.js';
import { confirmAndExecute, executeTool, type ConfirmationStep } from './tool-executor.js';
import { fromLlmToolName } from './tools/schema-adapter.js';
import * as predictions from './predictions.js';
import * as risk from './risk.js';
import * as scheduling from './scheduling.js';
import * as smartOrders from './smart-orders.js';
import { parseNaturalDate } from './resolvers.js';

type CreateSessionInput = z.infer<typeof createSessionSchema>;
type ListSessionsInput = z.infer<typeof listSessionsSchema>;
type ArchiveSessionInput = z.infer<typeof archiveSessionSchema>;

type SessionRow = typeof aiSessions.$inferSelect;
type MessageRow = typeof aiMessages.$inferSelect;
type CommandRunRow = typeof aiCommandRuns.$inferSelect;

type AIDomain = 'forecasting' | 'operations' | 'recommendation' | 'risk_commercial';
type AIPredictionType =
  | 'revenue_forecast'
  | 'production_time_estimate'
  | 'stock_depletion_forecast'
  | 'rework_pattern'
  | 'credit_score'
  | 'dynamic_pricing';
type AIRecommendationType =
  | 'smart_order'
  | 'schedule_optimization'
  | 'material_suggestion'
  | 'production_sequence'
  | 'collection_strategy'
  | 'price_adjustment';

type CommandChannel = 'text' | 'voice';
type CommandSource = 'manual' | 'llm' | 'resolve_step' | 'confirm';
type CommandExecutionStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'executing'
  | 'success'
  | 'error'
  | 'cancelled';

type ExecuteCommandInput = {
  sessionId?: number | undefined;
  content: string;
  channel?: CommandChannel;
};

export type ExecuteLlmToolCallInput = {
  sessionId?: number | undefined;
  channel?: CommandChannel;
  rawInput: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  idempotencyKey: string;
  providerUsed: string;
  modelUsed: string;
  cached: boolean;
  costCents: number;
};

type ConfirmCommandInput = {
  commandRunId: number;
};

type ResolveCommandStepInput = {
  commandRunId: number;
  values: Record<string, unknown>;
};

type CancelCommandInput = {
  commandRunId: number;
};

type ListCommandRunsInput = {
  sessionId?: number | undefined;
  limit: number;
  cursor?: number | undefined;
};

type CommandRunModel = {
  id: number;
  tenantId: number;
  userId: number;
  sessionId: number | null;
  channel: CommandChannel;
  rawInput: string;
  normalizedInput: string | null;
  intent: string | null;
  confidence: number | null;
  entities: Record<string, unknown>;
  missingFields: string[];
  riskLevel: RiskLevel | null;
  requiresConfirmation: boolean;
  confirmedAt: string | null;
  confirmedBy: number | null;
  toolName: string | null;
  toolInput: Record<string, unknown> | null;
  toolOutput: Record<string, unknown> | null;
  source: CommandSource;
  idempotencyKey: string | null;
  providerUsed: string | null;
  modelUsed: string | null;
  cached: boolean;
  costCents: number;
  executionStatus: CommandExecutionStatus;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  executedAt: string | null;
};

type CommandExecutionResponse = {
  status:
    | 'executed'
    | 'awaiting_confirmation'
    | 'ambiguous'
    | 'missing_fields'
    | 'blocked'
    | 'no_intent'
    | 'error';
  run: CommandRunModel;
  message: string;
  output?: unknown;
  preview?: {
    title: string;
    summary: string;
    details: Array<{ label: string; value: string }>;
  };
  confirmationStep?: ConfirmationStep;
  ambiguities?: ResolvedEntities;
  missingFields?: string[];
  suggestedIntents?: FlowCommandName[];
  rateLimit?: {
    remaining: number;
    resetAt: number;
  } | null;
};

const PLAN_RANK: Record<string, number> = {
  [PLAN_TIER.TRIAL]: 0,
  [PLAN_TIER.STARTER]: 1,
  [PLAN_TIER.PRO]: 2,
  [PLAN_TIER.ENTERPRISE]: 3,
};

function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function toCommandSource(value: string): CommandSource {
  if (value === 'llm' || value === 'resolve_step' || value === 'confirm') {
    return value;
  }
  return 'manual';
}

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

function toCommandRunModel(row: CommandRunRow): CommandRunModel {
  const entities = row.entitiesJson && typeof row.entitiesJson === 'object'
    ? row.entitiesJson as Record<string, unknown>
    : {};
  const missingFields = Array.isArray(row.missingFields)
    ? row.missingFields.filter((value): value is string => typeof value === 'string')
    : [];
  const toolInput = row.toolInputJson && typeof row.toolInputJson === 'object'
    ? row.toolInputJson as Record<string, unknown>
    : null;
  const toolOutput = row.toolOutputJson && typeof row.toolOutputJson === 'object'
    ? row.toolOutputJson as Record<string, unknown>
    : null;
  const confidence = row.confidence !== null ? parseNumeric(row.confidence) : null;

  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    sessionId: row.sessionId ?? null,
    channel: row.channel,
    rawInput: row.rawInput,
    normalizedInput: row.normalizedInput ?? null,
    intent: row.intent ?? null,
    confidence,
    entities,
    missingFields,
    riskLevel: row.riskLevel,
    requiresConfirmation: row.requiresConfirmation,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    confirmedBy: row.confirmedBy ?? null,
    toolName: row.toolName ?? null,
    toolInput,
    toolOutput,
    source: toCommandSource(row.source),
    idempotencyKey: row.idempotencyKey ?? null,
    providerUsed: row.providerUsed ?? null,
    modelUsed: row.modelUsed ?? null,
    cached: row.cached,
    costCents: row.costCents ?? 0,
    executionStatus: row.executionStatus,
    errorCode: row.errorCode ?? null,
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt.toISOString(),
    executedAt: row.executedAt ? row.executedAt.toISOString() : null,
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

function confidenceToDb(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toFixed(3);
}

type CreateCommandRunPayload = {
  sessionId?: number | undefined;
  channel: CommandChannel;
  rawInput: string;
  normalizedInput?: string | null;
  intent?: string | null;
  confidence?: number | null;
  entities?: Record<string, unknown>;
  missingFields?: string[];
  riskLevel?: RiskLevel | null;
  requiresConfirmation?: boolean;
  toolName?: string | null;
  toolInput?: Record<string, unknown> | null;
  toolOutput?: Record<string, unknown> | null;
  source?: CommandSource;
  idempotencyKey?: string | null;
  providerUsed?: string | null;
  modelUsed?: string | null;
  cached?: boolean;
  costCents?: number;
  executionStatus: CommandExecutionStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  executedAt?: Date | null;
};

type UpdateCommandRunPayload = Partial<{
  normalizedInput: string | null;
  intent: string | null;
  confidence: number | null;
  entities: Record<string, unknown>;
  missingFields: string[];
  riskLevel: RiskLevel | null;
  requiresConfirmation: boolean;
  confirmedAt: Date | null;
  confirmedBy: number | null;
  toolName: string | null;
  toolInput: Record<string, unknown> | null;
  toolOutput: Record<string, unknown> | null;
  source: CommandSource;
  idempotencyKey: string | null;
  providerUsed: string | null;
  modelUsed: string | null;
  cached: boolean;
  costCents: number;
  executionStatus: CommandExecutionStatus;
  errorCode: string | null;
  errorMessage: string | null;
  executedAt: Date | null;
}>;

async function createCommandRun(
  tenantId: number,
  userId: number,
  payload: CreateCommandRunPayload,
): Promise<CommandRunRow> {
  const insertData: typeof aiCommandRuns.$inferInsert = {
    tenantId,
    userId,
    sessionId: payload.sessionId ?? null,
    channel: payload.channel,
    rawInput: payload.rawInput,
    normalizedInput: payload.normalizedInput ?? null,
    intent: payload.intent ?? null,
    confidence: confidenceToDb(payload.confidence) ?? null,
    entitiesJson: payload.entities ?? {},
    missingFields: payload.missingFields ?? [],
    riskLevel: payload.riskLevel ?? null,
    requiresConfirmation: payload.requiresConfirmation ?? false,
    toolName: payload.toolName ?? null,
    toolInputJson: payload.toolInput ?? null,
    toolOutputJson: payload.toolOutput ?? null,
    source: payload.source ?? 'manual',
    idempotencyKey: payload.idempotencyKey ?? null,
    providerUsed: payload.providerUsed ?? null,
    modelUsed: payload.modelUsed ?? null,
    cached: payload.cached ?? false,
    costCents: payload.costCents ?? 0,
    executionStatus: payload.executionStatus,
    errorCode: payload.errorCode ?? null,
    errorMessage: payload.errorMessage ?? null,
    executedAt: payload.executedAt ?? null,
  };

  const [created] = await db
    .insert(aiCommandRuns)
    .values(insertData)
    .returning();

  if (!created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao registrar comando' });
  }

  return created;
}

async function updateCommandRun(
  tenantId: number,
  commandRunId: number,
  payload: UpdateCommandRunPayload,
): Promise<CommandRunRow> {
  const updateData: Partial<typeof aiCommandRuns.$inferInsert> = {};

  if (payload.normalizedInput !== undefined) updateData.normalizedInput = payload.normalizedInput;
  if (payload.intent !== undefined) updateData.intent = payload.intent;
  if (payload.confidence !== undefined) updateData.confidence = confidenceToDb(payload.confidence);
  if (payload.entities !== undefined) updateData.entitiesJson = payload.entities;
  if (payload.missingFields !== undefined) updateData.missingFields = payload.missingFields;
  if (payload.riskLevel !== undefined) updateData.riskLevel = payload.riskLevel;
  if (payload.requiresConfirmation !== undefined) updateData.requiresConfirmation = payload.requiresConfirmation;
  if (payload.confirmedAt !== undefined) updateData.confirmedAt = payload.confirmedAt;
  if (payload.confirmedBy !== undefined) updateData.confirmedBy = payload.confirmedBy;
  if (payload.toolName !== undefined) updateData.toolName = payload.toolName;
  if (payload.toolInput !== undefined) updateData.toolInputJson = payload.toolInput;
  if (payload.toolOutput !== undefined) updateData.toolOutputJson = payload.toolOutput;
  if (payload.source !== undefined) updateData.source = payload.source;
  if (payload.idempotencyKey !== undefined) updateData.idempotencyKey = payload.idempotencyKey;
  if (payload.providerUsed !== undefined) updateData.providerUsed = payload.providerUsed;
  if (payload.modelUsed !== undefined) updateData.modelUsed = payload.modelUsed;
  if (payload.cached !== undefined) updateData.cached = payload.cached;
  if (payload.costCents !== undefined) updateData.costCents = payload.costCents;
  if (payload.executionStatus !== undefined) updateData.executionStatus = payload.executionStatus;
  if (payload.errorCode !== undefined) updateData.errorCode = payload.errorCode;
  if (payload.errorMessage !== undefined) updateData.errorMessage = payload.errorMessage;
  if (payload.executedAt !== undefined) updateData.executedAt = payload.executedAt;

  const [updated] = await db
    .update(aiCommandRuns)
    .set(updateData)
    .where(and(eq(aiCommandRuns.tenantId, tenantId), eq(aiCommandRuns.id, commandRunId)))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Command run nao encontrado' });
  }

  return updated;
}

async function getCommandRunOrThrow(tenantId: number, commandRunId: number): Promise<CommandRunRow> {
  const [row] = await db
    .select()
    .from(aiCommandRuns)
    .where(and(eq(aiCommandRuns.tenantId, tenantId), eq(aiCommandRuns.id, commandRunId)));

  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Command run nao encontrado' });
  }
  return row;
}

async function getCommandRunByIdempotencyKey(
  tenantId: number,
  idempotencyKey: string,
): Promise<CommandRunRow | null> {
  const [row] = await db
    .select()
    .from(aiCommandRuns)
    .where(and(eq(aiCommandRuns.tenantId, tenantId), eq(aiCommandRuns.idempotencyKey, idempotencyKey)))
    .limit(1);

  return row ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (!('code' in error)) return false;
  return (error as { code?: unknown }).code === '23505';
}

function applyResolvedEntities(entities: ParsedEntities, resolved: ResolvedEntities): ParsedEntities {
  const next: ParsedEntities = { ...entities };
  for (const [key, value] of Object.entries(resolved)) {
    if (value.status !== 'resolved') continue;
    if (key === 'clientName') next.clientId = value.id;
    if (key === 'serviceName') next.serviceId = value.id;
    if (key === 'materialName') next.materialId = value.id;
    if (key === 'supplierName') next.supplierId = value.id;
    if (key === 'userName' || key === 'technicianName') next.assignedTo = value.id;
  }
  return next;
}

function serializeOutput(output: unknown): string {
  if (output === null || output === undefined) return '';
  if (typeof output === 'string') return output;
  try {
    const serialized = JSON.stringify(output, null, 2);
    return serialized.length > 700 ? `${serialized.slice(0, 700)}...` : serialized;
  } catch {
    return '[resultado sem serializacao]';
  }
}

function summarizeCommandMessage(
  status: CommandExecutionResponse['status'],
  command: string | null,
  output?: unknown,
): string {
  if (status === 'executed') {
    const outputText = serializeOutput(output);
    return outputText
      ? `Comando ${command ?? 'desconhecido'} executado com sucesso.\n${outputText}`
      : `Comando ${command ?? 'desconhecido'} executado com sucesso.`;
  }
  if (status === 'awaiting_confirmation') {
    return `Comando ${command ?? 'desconhecido'} pronto para confirmacao.`;
  }
  if (status === 'ambiguous') {
    return 'Encontrei multiplas opcoes. Escolha uma para continuar.';
  }
  if (status === 'missing_fields') {
    return 'Faltam campos obrigatorios para executar este comando.';
  }
  if (status === 'blocked') {
    return 'Voce nao possui permissao para este comando.';
  }
  if (status === 'no_intent') {
    return 'Nao consegui identificar um comando valido na sua mensagem.';
  }
  return 'Nao foi possivel executar o comando solicitado.';
}

function toolInputFromEntities(intent: FlowCommandName, entities: ParsedEntities): Record<string, unknown> {
  const input: Record<string, unknown> = { ...entities };
  const normalizePeriodKeyword = (value: string): 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom' | null => {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'today' || normalized === 'hoje') return 'today';
    if (normalized === 'week' || normalized === 'semana') return 'week';
    if (normalized === 'month' || normalized === 'mes') return 'month';
    if (normalized === 'quarter' || normalized === 'trimestre') return 'quarter';
    if (normalized === 'year' || normalized === 'ano') return 'year';
    if (normalized === 'custom') return 'custom';
    return null;
  };
  const monthPeriodToDateRange = (period: string): { startDate: string; endDate: string } | null => {
    const match = period.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if (!match?.[1] || !match[2]) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  };

  if (intent === 'clients.search' && typeof entities.clientName === 'string') {
    input.term = entities.clientName;
  }

  if (intent === 'jobs.createDraft') {
    if (typeof entities.deadline !== 'string') {
      input.deadline = parseNaturalDate().toISOString();
    } else {
      input.deadline = parseNaturalDate(entities.deadline).toISOString();
    }

    if (typeof entities.quantity !== 'number') {
      input.quantity = 1;
    }
    if (typeof entities.unitPriceCents !== 'number') {
      input.unitPriceCents = 0;
    }
  }

  if (intent === 'agenda.createEvent') {
    const now = new Date();
    if (typeof input.startAt !== 'string') {
      const startAt = new Date(now);
      startAt.setHours(startAt.getHours() + 1, 0, 0, 0);
      input.startAt = startAt.toISOString();
      const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
      input.endAt = endAt.toISOString();
    }
    if (typeof input.title !== 'string') {
      input.title = 'Evento Flow IA';
    }
    if (typeof input.type !== 'string') {
      input.type = 'outro';
    }
    if (typeof input.allDay !== 'boolean') {
      input.allDay = false;
    }
    if (typeof input.recurrence !== 'string') {
      input.recurrence = 'none';
    }
    if (typeof input.reminderMinutesBefore !== 'number') {
      input.reminderMinutesBefore = 60;
    }
  }

  if (intent === 'deliveries.routeByDay') {
    if (typeof entities.date === 'string') {
      input.date = entities.date;
    }
    if (typeof entities.deliveryPersonId === 'number') {
      input.deliveryPersonId = entities.deliveryPersonId;
    }
    if (typeof entities.deliveryPersonName === 'string') {
      input.deliveryPersonName = entities.deliveryPersonName;
    }
  }

  if (intent === 'stock.checkMaterial') {
    if (typeof entities.materialId === 'number') {
      input.materialId = entities.materialId;
    }
    if (typeof entities.materialName === 'string') {
      input.materialName = entities.materialName;
    }
  }

  if (intent === 'stock.alerts' && typeof entities.thresholdType === 'string') {
    input.thresholdType = entities.thresholdType;
  }

  if (intent === 'employees.productivity') {
    if (typeof entities.employeeId === 'number') {
      input.employeeId = entities.employeeId;
    }
    if (typeof entities.employeeName === 'string') {
      input.employeeName = entities.employeeName;
    }
    if (typeof entities.period === 'string') {
      const periodKeyword = normalizePeriodKeyword(entities.period);
      if (periodKeyword && periodKeyword !== 'year' && periodKeyword !== 'custom') {
        input.period = periodKeyword;
      }
    }
    if (typeof entities.metric === 'string') {
      input.metric = entities.metric;
    }
  }

  if (intent === 'agenda.today') {
    if (typeof entities.userId === 'number') {
      input.userId = entities.userId;
    }
    if (typeof entities.scope === 'string') {
      input.scope = entities.scope;
    }
  }

  if (intent === 'jobs.overdue') {
    if (typeof entities.severity === 'string') {
      input.severity = entities.severity;
    }
    if (typeof entities.assignedTo === 'number') {
      input.assignedTo = entities.assignedTo;
    } else if (typeof entities.employeeId === 'number') {
      input.assignedTo = entities.employeeId;
    }
  }

  if (intent === 'jobs.statusUpdate') {
    if (typeof entities.jobId === 'number') {
      input.jobId = entities.jobId;
    }
    if (typeof entities.newStatus === 'string') {
      input.newStatus = entities.newStatus;
    }
    if (typeof entities.note === 'string') {
      input.note = entities.note;
    } else if (typeof entities.reason === 'string' && entities.newStatus !== 'cancelled') {
      input.note = entities.reason;
    }
    if (typeof entities.cancelReason === 'string') {
      input.cancelReason = entities.cancelReason;
    } else if (entities.newStatus === 'cancelled' && typeof entities.reason === 'string') {
      input.cancelReason = entities.reason;
    }
  }

  if (intent === 'messages.draftToClient') {
    if (typeof entities.clientId === 'number') {
      input.clientId = entities.clientId;
    }
    if (typeof entities.clientName === 'string') {
      input.clientName = entities.clientName;
    }
    if (typeof entities.messageContext === 'string') {
      input.messageContext = entities.messageContext;
    }
    if (typeof entities.channel === 'string') {
      input.channel = entities.channel;
    }
    if (typeof entities.jobId === 'number') {
      input.jobId = entities.jobId;
    }
  }

  if (intent === 'financial.revenueToDate' || intent === 'financial.expensesToDate') {
    if (typeof entities.period === 'string') {
      const periodKeyword = normalizePeriodKeyword(entities.period);
      if (periodKeyword) {
        input.period = periodKeyword;
      } else {
        const monthRange = monthPeriodToDateRange(entities.period);
        if (monthRange) {
          input.period = 'custom';
          input.startDate = monthRange.startDate;
          input.endDate = monthRange.endDate;
        }
      }
    }
    if (typeof entities.startDate === 'string') {
      input.startDate = entities.startDate;
    }
    if (typeof entities.endDate === 'string') {
      input.endDate = entities.endDate;
    }
    if (typeof entities.breakdown === 'string') {
      input.breakdown = entities.breakdown;
    }
  }

  if (intent === 'financial.quarterlyReport') {
    if (typeof entities.quarter === 'string') {
      input.quarter = entities.quarter.toUpperCase();
    }
    if (typeof entities.year === 'number') {
      input.year = entities.year;
    }
    if (typeof entities.exportFormat === 'string') {
      input.exportFormat = entities.exportFormat;
    }
  }

  if (intent === 'purchases.create') {
    const materialId = typeof entities.materialId === 'number' ? entities.materialId : undefined;
    const quantity = typeof entities.quantity === 'number' ? entities.quantity : undefined;
    const unitPriceCents = typeof entities.unitPriceCents === 'number' ? entities.unitPriceCents : undefined;
    if (materialId && quantity && unitPriceCents) {
      input.items = [{ materialId, quantity, unitPriceCents }];
    }
  }

  if (intent === 'purchases.receive' && typeof entities.purchaseId === 'number') {
    input.purchaseId = entities.purchaseId;
  }

  if (intent === 'financial.closeAccount') {
    if (typeof entities.arId === 'number') {
      input.id = entities.arId;
    }
    if (typeof entities.clientId === 'number') {
      input.clientId = entities.clientId;
    }
  }

  if (intent === 'jobs.toggleUrgent' && typeof entities.isUrgent !== 'boolean') {
    input.isUrgent = true;
  }

  if (intent === 'jobs.finalize' && typeof entities.jobId === 'number') {
    input.jobId = entities.jobId;
  }

  return input;
}

function hasAmbiguity(resolvedEntities: ResolvedEntities): boolean {
  return Object.values(resolvedEntities).some((entry) => entry.status === 'ambiguous');
}

function hasNotFound(resolvedEntities: ResolvedEntities): boolean {
  return Object.values(resolvedEntities).some((entry) => entry.status === 'not_found');
}

function mapResolvedEntityKeyToField(key: string): string {
  if (key === 'clientName') return 'clientId';
  if (key === 'serviceName') return 'serviceId';
  if (key === 'materialName') return 'materialId';
  if (key === 'supplierName') return 'supplierId';
  if (key === 'userName' || key === 'technicianName') return 'assignedTo';
  return key;
}

function normalizeFieldType(field: string): 'number' | 'boolean' | 'text' {
  if (field.endsWith('Id') || field === 'quantity' || field === 'unitPriceCents') return 'number';
  if (field.startsWith('is') || field.endsWith('Enabled')) return 'boolean';
  return 'text';
}

function humanizeFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    jobId: 'ID da OS',
    clientId: 'ID do cliente',
    clientName: 'Nome do cliente',
    serviceId: 'ID do servico',
    materialId: 'ID do material',
    supplierId: 'ID do fornecedor',
    assignedTo: 'ID do responsavel',
    purchaseId: 'ID da compra',
    periodId: 'ID do periodo',
    period: 'Periodo (YYYY-MM)',
    newStatus: 'Novo status',
    messageContext: 'Mensagem',
    cancelReason: 'Motivo do cancelamento',
    reason: 'Motivo',
    deadline: 'Prazo',
    id: 'ID',
  };
  return labels[field] ?? field;
}

function buildFillMissingStep(fields: string[]): ConfirmationStep {
  return {
    type: 'fill_missing',
    fields: fields.map((field) => ({
      name: field,
      label: humanizeFieldLabel(field),
      type: normalizeFieldType(field),
      required: true,
    })),
  };
}

function buildAmbiguityStep(resolved: ResolvedEntities): ConfirmationStep | null {
  for (const [key, value] of Object.entries(resolved)) {
    if (value.status !== 'ambiguous') continue;
    return {
      type: 'disambiguate',
      field: mapResolvedEntityKeyToField(key),
      options: value.candidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        ...(candidate.detail ? { detail: candidate.detail } : {}),
      })),
    };
  }
  return null;
}

function normalizeResolvedValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return numeric;
  }
  return trimmed;
}

function computeMissingFields(intent: FlowCommandName, entities: ParsedEntities): string[] {
  const commandConfig = FLOW_COMMANDS[intent] as { requiredFields?: readonly string[] };
  const requiredFields = [...(commandConfig.requiredFields ?? [])];
  return requiredFields.filter((field) => {
    const value = entities[field];
    if (typeof value === 'boolean') return false;
    if (typeof value === 'number') return !Number.isFinite(value);
    if (typeof value === 'string') return value.trim().length === 0;
    return true;
  });
}

export async function executeCommand(
  tenantId: number,
  userId: number,
  userRole: Role,
  input: ExecuteCommandInput,
): Promise<CommandExecutionResponse> {
  if (input.sessionId) {
    await assertSessionOwnership(tenantId, input.sessionId, userId);
    await saveMessage(tenantId, input.sessionId, userId, 'user', input.content);
  }

  const parsed = await parseIntent(input.content, tenantId);
  const channel = input.channel ?? 'text';

  if (!parsed.intent) {
    const run = await createCommandRun(tenantId, userId, {
      sessionId: input.sessionId,
      channel,
      rawInput: input.content,
      normalizedInput: parsed.normalizedInput,
      intent: null,
      confidence: parsed.confidence,
      entities: parsed.entities as Record<string, unknown>,
      executionStatus: 'error',
      errorCode: 'INTENT_NOT_RECOGNIZED',
      errorMessage: 'Nao foi possivel identificar um comando',
      executedAt: new Date(),
    });

    const response: CommandExecutionResponse = {
      status: 'no_intent',
      run: toCommandRunModel(run),
      message: summarizeCommandMessage('no_intent', null),
      suggestedIntents: parsed.suggestedIntents,
    };

    if (input.sessionId) {
      await saveMessage(tenantId, input.sessionId, userId, 'assistant', response.message);
    }
    return response;
  }

  const intent = parsed.intent;
  const riskLevel = FLOW_COMMANDS[intent].risk;

  if (!checkCommandAccess(intent, userRole)) {
    const run = await createCommandRun(tenantId, userId, {
      sessionId: input.sessionId,
      channel,
      rawInput: input.content,
      normalizedInput: parsed.normalizedInput,
      intent,
      confidence: parsed.confidence,
      entities: parsed.entities as Record<string, unknown>,
      missingFields: parsed.missingFields,
      riskLevel,
      executionStatus: 'error',
      errorCode: 'FORBIDDEN',
      errorMessage: 'Sem permissao para executar este comando',
      executedAt: new Date(),
    });

    const response: CommandExecutionResponse = {
      status: 'blocked',
      run: toCommandRunModel(run),
      message: summarizeCommandMessage('blocked', intent),
    };

    if (input.sessionId) {
      await saveMessage(tenantId, input.sessionId, userId, 'assistant', response.message);
    }

    return response;
  }

  const resolvedEntities = await resolveEntities(parsed.entities, tenantId);
  const mergedEntities = applyResolvedEntities(parsed.entities, resolvedEntities);
  const missingFields = [...parsed.missingFields];

  if (hasNotFound(resolvedEntities) && !missingFields.includes('entity_resolution')) {
    missingFields.push('entity_resolution');
  }

  if (hasAmbiguity(resolvedEntities)) {
    const ambiguityStep = buildAmbiguityStep(resolvedEntities);
    const run = await createCommandRun(tenantId, userId, {
      sessionId: input.sessionId,
      channel,
      rawInput: input.content,
      normalizedInput: parsed.normalizedInput,
      intent,
      confidence: parsed.confidence,
      entities: mergedEntities as Record<string, unknown>,
      missingFields,
      riskLevel,
      executionStatus: 'pending',
      toolName: intent,
      toolOutput: {
        resolvedEntities,
        ...(ambiguityStep ? { step: ambiguityStep } : {}),
      },
    });

    const response: CommandExecutionResponse = {
      status: 'ambiguous',
      run: toCommandRunModel(run),
      ambiguities: resolvedEntities,
      missingFields,
      ...(ambiguityStep ? { confirmationStep: ambiguityStep } : {}),
      message: summarizeCommandMessage('ambiguous', intent),
    };

    if (input.sessionId) {
      await saveMessage(tenantId, input.sessionId, userId, 'assistant', response.message);
    }

    return response;
  }

  if (missingFields.length > 0) {
    const fillStep = buildFillMissingStep(missingFields);
    const run = await createCommandRun(tenantId, userId, {
      sessionId: input.sessionId,
      channel,
      rawInput: input.content,
      normalizedInput: parsed.normalizedInput,
      intent,
      confidence: parsed.confidence,
      entities: mergedEntities as Record<string, unknown>,
      missingFields,
      riskLevel,
      executionStatus: 'pending',
      toolName: intent,
      toolOutput: {
        step: fillStep,
      },
    });

    const response: CommandExecutionResponse = {
      status: 'missing_fields',
      run: toCommandRunModel(run),
      missingFields,
      confirmationStep: fillStep,
      message: summarizeCommandMessage('missing_fields', intent),
    };

    if (input.sessionId) {
      await saveMessage(tenantId, input.sessionId, userId, 'assistant', response.message);
    }

    return response;
  }

  const toolInput = toolInputFromEntities(intent, mergedEntities);

  const initialRun = await createCommandRun(tenantId, userId, {
    sessionId: input.sessionId,
    channel,
    rawInput: input.content,
    normalizedInput: parsed.normalizedInput,
    intent,
    confidence: parsed.confidence,
    entities: mergedEntities as Record<string, unknown>,
    missingFields,
    riskLevel,
    requiresConfirmation: riskLevel === 'transactional' || riskLevel === 'critical',
    toolName: intent,
    toolInput,
    executionStatus: 'executing',
  });

  try {
    const result = await executeTool(
      { tenantId, userId, role: userRole, sessionId: input.sessionId },
      intent,
      toolInput,
      { source: 'manual' },
    );

    if (result.status === 'awaiting_confirmation') {
      const updated = await updateCommandRun(tenantId, initialRun.id, {
        executionStatus: 'awaiting_confirmation',
        requiresConfirmation: true,
        toolInput: result.validatedInput as Record<string, unknown>,
        toolOutput: {
          preview: result.preview,
          step: result.step,
        },
      });

      const response: CommandExecutionResponse = {
        status: 'awaiting_confirmation',
        run: toCommandRunModel(updated),
        message: summarizeCommandMessage('awaiting_confirmation', intent),
        preview: result.preview,
        confirmationStep: result.step,
        rateLimit: result.rateLimit,
      };

      if (input.sessionId) {
        await saveMessage(tenantId, input.sessionId, userId, 'assistant', response.message);
      }
      return response;
    }

    const updated = await updateCommandRun(tenantId, initialRun.id, {
      executionStatus: 'success',
      toolInput: result.validatedInput as Record<string, unknown>,
      toolOutput: { output: result.output },
      executedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    });

    void logAudit({
      tenantId,
      userId,
      action: 'ai.command.execute',
      entityType: 'ai_command_runs',
      entityId: updated.id,
      newValue: {
        intent,
        riskLevel: result.riskLevel,
      },
    });

    const response: CommandExecutionResponse = {
      status: 'executed',
      run: toCommandRunModel(updated),
      output: result.output,
      message: summarizeCommandMessage('executed', intent, result.output),
      rateLimit: result.rateLimit,
    };

    if (input.sessionId) {
      await saveMessage(tenantId, input.sessionId, userId, 'assistant', response.message);
    }

    return response;
  } catch (error) {
    const message = error instanceof TRPCError ? error.message : 'Erro inesperado no comando';
    const code = error instanceof TRPCError ? error.code : 'INTERNAL_SERVER_ERROR';

    const updated = await updateCommandRun(tenantId, initialRun.id, {
      executionStatus: 'error',
      executedAt: new Date(),
      errorCode: code,
      errorMessage: message,
    });

    const response: CommandExecutionResponse = {
      status: 'error',
      run: toCommandRunModel(updated),
      message: summarizeCommandMessage('error', intent),
    };

    if (input.sessionId) {
      await saveMessage(tenantId, input.sessionId, userId, 'assistant', `${response.message}\n${message}`);
    }

    return response;
  }
}

function getStoredOutput(toolOutputJson: Record<string, unknown> | null): unknown {
  if (!toolOutputJson) return undefined;
  if ('output' in toolOutputJson) {
    return toolOutputJson.output;
  }
  return undefined;
}

function buildReplayResponse(run: CommandRunRow): CommandExecutionResponse {
  const model = toCommandRunModel(run);
  const command = run.intent;
  const output = getStoredOutput(model.toolOutput);

  if (run.executionStatus === 'awaiting_confirmation') {
    const confirmationStep = model.toolOutput && 'step' in model.toolOutput
      ? model.toolOutput.step as ConfirmationStep
      : undefined;
    const preview = model.toolOutput && 'preview' in model.toolOutput
      ? model.toolOutput.preview as CommandExecutionResponse['preview']
      : undefined;

    return {
      status: 'awaiting_confirmation',
      run: model,
      message: summarizeCommandMessage('awaiting_confirmation', command),
      ...(preview ? { preview } : {}),
      ...(confirmationStep ? { confirmationStep } : {}),
    };
  }

  if (run.executionStatus === 'success') {
    return {
      status: 'executed',
      run: model,
      output,
      message: summarizeCommandMessage('executed', command, output),
    };
  }

  return {
    status: 'error',
    run: model,
    message: summarizeCommandMessage('error', command),
  };
}

export async function executeLlmToolCall(
  tenantId: number,
  userId: number,
  userRole: Role,
  input: ExecuteLlmToolCallInput,
): Promise<CommandExecutionResponse> {
  const channel = input.channel ?? 'text';
  const intent = fromLlmToolName(input.toolName)
    ?? (input.toolName in FLOW_COMMANDS ? input.toolName as FlowCommandName : null);

  if (!intent) {
    const run = await createCommandRun(tenantId, userId, {
      sessionId: input.sessionId,
      channel,
      rawInput: input.rawInput,
      intent: null,
      toolName: input.toolName,
      toolInput: input.toolInput,
      source: 'llm',
      idempotencyKey: input.idempotencyKey,
      providerUsed: input.providerUsed,
      modelUsed: input.modelUsed,
      cached: input.cached,
      costCents: input.costCents,
      executionStatus: 'error',
      errorCode: 'NOT_IMPLEMENTED',
      errorMessage: `Comando ${input.toolName} nao implementado`,
      executedAt: new Date(),
    });

    return {
      status: 'error',
      run: toCommandRunModel(run),
      message: summarizeCommandMessage('error', null),
    };
  }

  if (!checkCommandAccess(intent, userRole)) {
    const run = await createCommandRun(tenantId, userId, {
      sessionId: input.sessionId,
      channel,
      rawInput: input.rawInput,
      intent,
      riskLevel: FLOW_COMMANDS[intent].risk,
      toolName: intent,
      toolInput: input.toolInput,
      source: 'llm',
      idempotencyKey: input.idempotencyKey,
      providerUsed: input.providerUsed,
      modelUsed: input.modelUsed,
      cached: input.cached,
      costCents: input.costCents,
      executionStatus: 'error',
      errorCode: 'FORBIDDEN',
      errorMessage: 'Sem permissao para executar este comando',
      executedAt: new Date(),
    });

    return {
      status: 'blocked',
      run: toCommandRunModel(run),
      message: summarizeCommandMessage('blocked', intent),
    };
  }

  const replay = await getCommandRunByIdempotencyKey(tenantId, input.idempotencyKey);
  if (replay) {
    return buildReplayResponse(replay);
  }

  let commandRun: CommandRunRow;
  try {
    commandRun = await createCommandRun(tenantId, userId, {
      sessionId: input.sessionId,
      channel,
      rawInput: input.rawInput,
      intent,
      riskLevel: FLOW_COMMANDS[intent].risk,
      requiresConfirmation:
        FLOW_COMMANDS[intent].risk === 'transactional' || FLOW_COMMANDS[intent].risk === 'critical',
      toolName: intent,
      toolInput: input.toolInput,
      source: 'llm',
      idempotencyKey: input.idempotencyKey,
      providerUsed: input.providerUsed,
      modelUsed: input.modelUsed,
      cached: input.cached,
      costCents: input.costCents,
      executionStatus: 'executing',
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await getCommandRunByIdempotencyKey(tenantId, input.idempotencyKey);
      if (existing) {
        return buildReplayResponse(existing);
      }
    }
    throw error;
  }

  try {
    const result = await executeTool(
      { tenantId, userId, role: userRole, sessionId: input.sessionId },
      intent,
      input.toolInput,
      {
        source: 'llm',
        idempotencyKey: input.idempotencyKey,
        providerUsed: input.providerUsed,
        modelUsed: input.modelUsed,
        costCents: input.costCents,
        cached: input.cached,
      },
    );

    if (result.status === 'awaiting_confirmation') {
      const updated = await updateCommandRun(tenantId, commandRun.id, {
        executionStatus: 'awaiting_confirmation',
        requiresConfirmation: true,
        toolInput: result.validatedInput as Record<string, unknown>,
        toolOutput: {
          preview: result.preview,
          step: result.step,
        },
      });

      return {
        status: 'awaiting_confirmation',
        run: toCommandRunModel(updated),
        message: summarizeCommandMessage('awaiting_confirmation', intent),
        preview: result.preview,
        confirmationStep: result.step,
        rateLimit: result.rateLimit,
      };
    }

    const updated = await updateCommandRun(tenantId, commandRun.id, {
      executionStatus: 'success',
      toolInput: result.validatedInput as Record<string, unknown>,
      toolOutput: { output: result.output },
      executedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    });

    void logAudit({
      tenantId,
      userId,
      action: 'ai.command.execute',
      entityType: 'ai_command_runs',
      entityId: updated.id,
      newValue: {
        intent,
        riskLevel: result.riskLevel,
        source: 'llm',
      },
    });

    return {
      status: 'executed',
      run: toCommandRunModel(updated),
      output: result.output,
      message: summarizeCommandMessage('executed', intent, result.output),
      rateLimit: result.rateLimit,
    };
  } catch (error) {
    const message = error instanceof TRPCError ? error.message : 'Erro inesperado no comando';
    const code = error instanceof TRPCError ? error.code : 'INTERNAL_SERVER_ERROR';

    const updated = await updateCommandRun(tenantId, commandRun.id, {
      executionStatus: 'error',
      executedAt: new Date(),
      errorCode: code,
      errorMessage: message,
    });

    return {
      status: 'error',
      run: toCommandRunModel(updated),
      message: summarizeCommandMessage('error', intent),
    };
  }
}

export async function resolveCommandStep(
  tenantId: number,
  userId: number,
  userRole: Role,
  input: ResolveCommandStepInput,
): Promise<CommandExecutionResponse> {
  const run = await getCommandRunOrThrow(tenantId, input.commandRunId);
  if (run.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissao para atualizar este comando' });
  }
  if (!run.intent) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Comando sem intent nao pode ser atualizado' });
  }
  if (!['pending', 'awaiting_confirmation'].includes(run.executionStatus)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Este comando nao aceita atualizacao de etapas' });
  }

  const intent = run.intent as FlowCommandName;
  if (!checkCommandAccess(intent, userRole)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissao para atualizar este comando' });
  }

  const currentEntities = run.entitiesJson && typeof run.entitiesJson === 'object'
    ? run.entitiesJson as ParsedEntities
    : {} as ParsedEntities;

  const normalizedValues = Object.fromEntries(
    Object.entries(input.values).map(([key, value]) => [key, normalizeResolvedValue(value)]),
  ) as ParsedEntities;

  const candidateEntities: ParsedEntities = {
    ...currentEntities,
    ...normalizedValues,
  };

  const resolvedEntities = await resolveEntities(candidateEntities, tenantId);
  const mergedEntities = applyResolvedEntities(candidateEntities, resolvedEntities);
  const missingFields = computeMissingFields(intent, mergedEntities);
  if (hasNotFound(resolvedEntities) && !missingFields.includes('entity_resolution')) {
    missingFields.push('entity_resolution');
  }

  if (hasAmbiguity(resolvedEntities)) {
    const ambiguityStep = buildAmbiguityStep(resolvedEntities);
    const updated = await updateCommandRun(tenantId, run.id, {
      executionStatus: 'pending',
      entities: mergedEntities as Record<string, unknown>,
      missingFields,
      toolOutput: {
        resolvedEntities,
        ...(ambiguityStep ? { step: ambiguityStep } : {}),
      },
    });

    return {
      status: 'ambiguous',
      run: toCommandRunModel(updated),
      ambiguities: resolvedEntities,
      missingFields,
      ...(ambiguityStep ? { confirmationStep: ambiguityStep } : {}),
      message: summarizeCommandMessage('ambiguous', intent),
    };
  }

  if (missingFields.length > 0) {
    const fillStep = buildFillMissingStep(missingFields);
    const updated = await updateCommandRun(tenantId, run.id, {
      executionStatus: 'pending',
      entities: mergedEntities as Record<string, unknown>,
      missingFields,
      toolOutput: {
        step: fillStep,
      },
    });

    return {
      status: 'missing_fields',
      run: toCommandRunModel(updated),
      missingFields,
      confirmationStep: fillStep,
      message: summarizeCommandMessage('missing_fields', intent),
    };
  }

  const toolInput = toolInputFromEntities(intent, mergedEntities);
  await updateCommandRun(tenantId, run.id, {
    executionStatus: 'executing',
    entities: mergedEntities as Record<string, unknown>,
    missingFields,
    toolInput,
    errorCode: null,
    errorMessage: null,
  });

  try {
    const result = await executeTool(
      { tenantId, userId, role: userRole, sessionId: run.sessionId ?? undefined },
      intent,
      toolInput,
      { source: 'resolve_step' },
    );

    if (result.status === 'awaiting_confirmation') {
      const updated = await updateCommandRun(tenantId, run.id, {
        executionStatus: 'awaiting_confirmation',
        requiresConfirmation: true,
        toolInput: result.validatedInput as Record<string, unknown>,
        toolOutput: {
          preview: result.preview,
          step: result.step,
        },
      });

      return {
        status: 'awaiting_confirmation',
        run: toCommandRunModel(updated),
        message: summarizeCommandMessage('awaiting_confirmation', intent),
        preview: result.preview,
        confirmationStep: result.step,
        rateLimit: result.rateLimit,
      };
    }

    const updated = await updateCommandRun(tenantId, run.id, {
      executionStatus: 'success',
      toolInput: result.validatedInput as Record<string, unknown>,
      toolOutput: { output: result.output },
      executedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    });

    void logAudit({
      tenantId,
      userId,
      action: 'ai.command.execute',
      entityType: 'ai_command_runs',
      entityId: updated.id,
      newValue: { intent, riskLevel: result.riskLevel, source: 'resolve_step' },
    });

    const response: CommandExecutionResponse = {
      status: 'executed',
      run: toCommandRunModel(updated),
      output: result.output,
      message: summarizeCommandMessage('executed', intent, result.output),
      rateLimit: result.rateLimit,
    };

    if (run.sessionId) {
      await saveMessage(tenantId, run.sessionId, userId, 'assistant', response.message);
    }

    return response;
  } catch (error) {
    const message = error instanceof TRPCError ? error.message : 'Falha ao processar etapa do comando';
    const code = error instanceof TRPCError ? error.code : 'INTERNAL_SERVER_ERROR';
    const updated = await updateCommandRun(tenantId, run.id, {
      executionStatus: 'error',
      errorCode: code,
      errorMessage: message,
      executedAt: new Date(),
    });

    return {
      status: 'error',
      run: toCommandRunModel(updated),
      message: summarizeCommandMessage('error', intent),
    };
  }
}

export async function confirmCommand(
  tenantId: number,
  userId: number,
  userRole: Role,
  input: ConfirmCommandInput,
): Promise<CommandExecutionResponse> {
  const run = await getCommandRunOrThrow(tenantId, input.commandRunId);
  if (run.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissao para confirmar este comando' });
  }
  if (run.executionStatus !== 'awaiting_confirmation') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Comando nao esta aguardando confirmacao' });
  }
  if (!run.intent) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Comando sem intent nao pode ser confirmado' });
  }

  const currentStep = run.toolOutputJson
    && typeof run.toolOutputJson === 'object'
    && 'step' in run.toolOutputJson
    ? (run.toolOutputJson as Record<string, unknown>).step as { type?: string } | undefined
    : undefined;

  if (currentStep?.type === 'disambiguate' || currentStep?.type === 'fill_missing') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Resolva as etapas pendentes antes de confirmar este comando',
    });
  }

  const intent = run.intent as FlowCommandName;
  const toolInput = run.toolInputJson && typeof run.toolInputJson === 'object'
    ? run.toolInputJson
    : {};

  try {
    const result = await confirmAndExecute(
      { tenantId, userId, role: userRole, sessionId: run.sessionId ?? undefined },
      intent,
      toolInput,
      { source: 'confirm' },
    );

    const now = new Date();
    if (result.status !== 'success') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Confirmacao nao retornou sucesso' });
    }

    const updated = await updateCommandRun(tenantId, run.id, {
      executionStatus: 'success',
      confirmedAt: now,
      confirmedBy: userId,
      toolOutput: { output: result.output },
      executedAt: now,
      errorCode: null,
      errorMessage: null,
    });

    void logAudit({
      tenantId,
      userId,
      action: 'ai.command.confirm',
      entityType: 'ai_command_runs',
      entityId: updated.id,
      oldValue: { executionStatus: run.executionStatus },
      newValue: { executionStatus: updated.executionStatus, intent },
    });

    const response: CommandExecutionResponse = {
      status: 'executed',
      run: toCommandRunModel(updated),
      output: result.output,
      message: summarizeCommandMessage('executed', intent, result.output),
      rateLimit: result.rateLimit,
    };

    if (run.sessionId) {
      await saveMessage(tenantId, run.sessionId, userId, 'assistant', response.message);
    }

    return response;
  } catch (error) {
    const message = error instanceof TRPCError ? error.message : 'Falha ao confirmar comando';
    const code = error instanceof TRPCError ? error.code : 'INTERNAL_SERVER_ERROR';

    const updated = await updateCommandRun(tenantId, run.id, {
      executionStatus: 'error',
      errorCode: code,
      errorMessage: message,
      executedAt: new Date(),
    });

    return {
      status: 'error',
      run: toCommandRunModel(updated),
      message: summarizeCommandMessage('error', run.intent ?? null),
    };
  }
}

export async function cancelCommand(
  tenantId: number,
  userId: number,
  input: CancelCommandInput,
): Promise<{ success: true; run: CommandRunModel }> {
  const run = await getCommandRunOrThrow(tenantId, input.commandRunId);
  if (run.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissao para cancelar este comando' });
  }
  if (!['pending', 'awaiting_confirmation', 'executing'].includes(run.executionStatus)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Comando nao pode ser cancelado neste estado' });
  }

  const updated = await updateCommandRun(tenantId, run.id, {
    executionStatus: 'cancelled',
    errorCode: 'CANCELLED_BY_USER',
    errorMessage: 'Comando cancelado pelo usuario',
    executedAt: new Date(),
  });

  void logAudit({
    tenantId,
    userId,
    action: 'ai.command.cancel',
    entityType: 'ai_command_runs',
    entityId: updated.id,
    oldValue: { executionStatus: run.executionStatus },
    newValue: { executionStatus: 'cancelled' },
  });

  return { success: true, run: toCommandRunModel(updated) };
}

export async function listCommandRuns(
  tenantId: number,
  userId: number,
  input: ListCommandRunsInput,
): Promise<{ data: CommandRunModel[]; nextCursor: number | null }> {
  const conditions = [eq(aiCommandRuns.tenantId, tenantId), eq(aiCommandRuns.userId, userId)];
  if (input.sessionId !== undefined) {
    conditions.push(eq(aiCommandRuns.sessionId, input.sessionId));
  }
  if (input.cursor) {
    conditions.push(lt(aiCommandRuns.id, input.cursor));
  }

  const rows = await db
    .select()
    .from(aiCommandRuns)
    .where(and(...conditions))
    .orderBy(desc(aiCommandRuns.id))
    .limit(input.limit + 1);

  const pageRows = rows.slice(0, input.limit);
  const hasMore = rows.length > input.limit;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null;

  return {
    data: pageRows.map(toCommandRunModel),
    nextCursor,
  };
}

export async function ensureTenantAISettings(tenantId: number): Promise<typeof aiTenantSettings.$inferSelect> {
  const [existing] = await db
    .select()
    .from(aiTenantSettings)
    .where(eq(aiTenantSettings.tenantId, tenantId));
  if (existing) return existing;

  const [created] = await db
    .insert(aiTenantSettings)
    .values({ tenantId })
    .returning();

  if (!created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao inicializar configuracoes de IA' });
  }
  return created;
}

export async function updateTenantAISettings(tenantId: number, input: AIFeatureFlagsInput) {
  const settings = await ensureTenantAISettings(tenantId);
  const [updated] = await db
    .update(aiTenantSettings)
    .set({
      forecastingEnabled: input.forecasting,
      operationsEnabled: input.operations,
      recommendationEnabled: input.recommendation,
      riskCommercialEnabled: input.riskCommercial,
      autoExecutionEnabled: input.autoExecutionEnabled,
      minPlan: input.minPlan ?? settings.minPlan,
      updatedAt: new Date(),
    })
    .where(eq(aiTenantSettings.id, settings.id))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar configuracoes de IA' });
  }
  return updated;
}

export async function getAICapabilities(tenantId: number) {
  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  if (!tenant) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });
  }

  const settings = await ensureTenantAISettings(tenantId);
  const tenantRank = PLAN_RANK[tenant.plan] ?? 0;
  const minimumRank = PLAN_RANK[settings.minPlan] ?? 1;
  const licensed = tenantRank >= minimumRank;

  const flags = {
    forecasting: licensed && settings.forecastingEnabled,
    operations: licensed && settings.operationsEnabled,
    recommendation: licensed && settings.recommendationEnabled,
    riskCommercial: licensed && settings.riskCommercialEnabled,
    autoExecutionEnabled: licensed && settings.autoExecutionEnabled,
  };

  return { licensed, plan: tenant.plan, minPlan: settings.minPlan, flags };
}

export async function startModelRun(
  tenantId: number,
  input: {
    domain: AIDomain;
    modelName: string;
    modelVersion: string;
    trigger: string;
    predictionType?: AIPredictionType;
    recommendationType?: AIRecommendationType;
  },
) : Promise<typeof aiModelRuns.$inferSelect> {
  const runValues: typeof aiModelRuns.$inferInsert = {
    tenantId,
    domain: input.domain,
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    trigger: input.trigger,
    status: 'running',
    startedAt: new Date(),
  };
  if (input.predictionType !== undefined) {
    runValues.predictionType = input.predictionType;
  }
  if (input.recommendationType !== undefined) {
    runValues.recommendationType = input.recommendationType;
  }

  const [run] = await db
    .insert(aiModelRuns)
    .values(runValues)
    .returning();

  if (!run) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao iniciar model run' });
  }
  return run;
}

export async function finishModelRun(
  runId: number,
  input: { status: 'completed' | 'failed'; metrics?: Record<string, unknown>; errorMessage?: string },
) {
  const updateData: {
    status: 'completed' | 'failed';
    finishedAt: Date;
    metricsJson?: Record<string, unknown>;
    errorMessage?: string;
  } = {
    status: input.status,
    finishedAt: new Date(),
  };
  if (input.metrics !== undefined) {
    updateData.metricsJson = input.metrics;
  }
  if (input.errorMessage !== undefined) {
    updateData.errorMessage = input.errorMessage;
  }

  const [updated] = await db
    .update(aiModelRuns)
    .set(updateData)
    .where(eq(aiModelRuns.id, runId))
    .returning();
  return updated;
}

export async function saveFeatureSnapshot(
  tenantId: number,
  input: {
    modelRunId?: number;
    domain: AIDomain;
    entityType: string;
    entityId: number;
    features: Record<string, unknown>;
  },
) : Promise<typeof aiFeatureSnapshots.$inferSelect> {
  const snapshotValues: typeof aiFeatureSnapshots.$inferInsert = {
    tenantId,
    domain: input.domain,
    entityType: input.entityType,
    entityId: input.entityId,
    featuresJson: input.features,
  };
  if (input.modelRunId !== undefined) {
    snapshotValues.modelRunId = input.modelRunId;
  }

  const [snapshot] = await db
    .insert(aiFeatureSnapshots)
    .values(snapshotValues)
    .returning();

  if (!snapshot) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao salvar snapshot de features' });
  }
  return snapshot;
}

export async function createPrediction(
  tenantId: number,
  input: {
    modelRunId?: number;
    featureSnapshotId?: number;
    domain: AIDomain;
    predictionType: AIPredictionType;
    entityType: string;
    entityId: number;
    predictedValue: number;
    confidenceScore: number;
    explanation: string;
    explainability?: Record<string, unknown>;
    unit?: string;
    forecastWindowDays?: number;
  },
) : Promise<typeof aiPredictions.$inferSelect> {
  const predictionValues: typeof aiPredictions.$inferInsert = {
    tenantId,
    domain: input.domain,
    predictionType: input.predictionType,
    entityType: input.entityType,
    entityId: input.entityId,
    predictedValue: String(input.predictedValue),
    confidenceScore: String(clampScore(input.confidenceScore)),
    explanation: input.explanation,
    unit: input.unit ?? 'score',
  };
  if (input.modelRunId !== undefined) {
    predictionValues.modelRunId = input.modelRunId;
  }
  if (input.featureSnapshotId !== undefined) {
    predictionValues.featureSnapshotId = input.featureSnapshotId;
  }
  if (input.explainability !== undefined) {
    predictionValues.explainabilityJson = input.explainability;
  }
  if (input.forecastWindowDays !== undefined) {
    predictionValues.forecastWindowDays = input.forecastWindowDays;
  }

  const [prediction] = await db
    .insert(aiPredictions)
    .values(predictionValues)
    .returning();

  if (!prediction) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar predicao' });
  }
  return prediction;
}

export async function createRecommendation(
  tenantId: number,
  input: {
    predictionId?: number;
    modelRunId?: number;
    domain: AIDomain;
    recommendationType: AIRecommendationType;
    targetEntityType: string;
    targetEntityId: number;
    payload: Record<string, unknown>;
    rationale: string;
    confidenceScore: number;
    priorityScore: number;
    isAutoExecutable?: boolean;
    expiresAt?: Date;
  },
) : Promise<typeof aiRecommendations.$inferSelect> {
  const recommendationValues: typeof aiRecommendations.$inferInsert = {
    tenantId,
    domain: input.domain,
    recommendationType: input.recommendationType,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    payloadJson: input.payload,
    rationale: input.rationale,
    confidenceScore: String(clampScore(input.confidenceScore)),
    priorityScore: String(Math.max(0, input.priorityScore)),
    isAutoExecutable: input.isAutoExecutable ?? false,
  };
  if (input.predictionId !== undefined) {
    recommendationValues.predictionId = input.predictionId;
  }
  if (input.modelRunId !== undefined) {
    recommendationValues.modelRunId = input.modelRunId;
  }
  if (input.expiresAt !== undefined) {
    recommendationValues.expiresAt = input.expiresAt;
  }

  const [recommendation] = await db
    .insert(aiRecommendations)
    .values(recommendationValues)
    .returning();

  if (!recommendation) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar recomendacao' });
  }
  return recommendation;
}

export async function listPredictions(tenantId: number, filters: ListAiPredictionsInput) {
  const conditions = [eq(aiPredictions.tenantId, tenantId)];

  if (filters.predictionType) conditions.push(eq(aiPredictions.predictionType, filters.predictionType));
  if (filters.domain) conditions.push(eq(aiPredictions.domain, filters.domain));
  if (filters.modelVersion) conditions.push(eq(aiModelRuns.modelVersion, filters.modelVersion));
  if (filters.dateFrom) conditions.push(gte(aiPredictions.generatedAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(aiPredictions.generatedAt, new Date(filters.dateTo)));

  return db.select({
    prediction: aiPredictions,
    run: aiModelRuns,
  }).from(aiPredictions)
    .leftJoin(aiModelRuns, eq(aiModelRuns.id, aiPredictions.modelRunId))
    .where(and(...conditions))
    .orderBy(desc(aiPredictions.generatedAt))
    .limit(filters.limit);
}

export async function listRecommendations(tenantId: number, filters: ListAiRecommendationsInput) {
  const conditions = [eq(aiRecommendations.tenantId, tenantId)];
  if (filters.recommendationType) conditions.push(eq(aiRecommendations.recommendationType, filters.recommendationType));
  if (filters.domain) conditions.push(eq(aiRecommendations.domain, filters.domain));
  if (filters.status) conditions.push(eq(aiRecommendations.status, filters.status));
  if (filters.dateFrom) conditions.push(gte(aiRecommendations.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(aiRecommendations.createdAt, new Date(filters.dateTo)));

  return db.select({
    recommendation: aiRecommendations,
    prediction: aiPredictions,
  }).from(aiRecommendations)
    .leftJoin(aiPredictions, eq(aiPredictions.id, aiRecommendations.predictionId))
    .where(and(...conditions))
    .orderBy(desc(aiRecommendations.createdAt))
    .limit(filters.limit);
}

export async function recordFeedback(tenantId: number, userId: number, input: RecordAiFeedbackInput) {
  const [recommendation] = await db
    .select()
    .from(aiRecommendations)
    .where(and(eq(aiRecommendations.id, input.recommendationId), eq(aiRecommendations.tenantId, tenantId)));

  if (!recommendation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Recomendacao nao encontrada' });
  }

  const feedbackValues: typeof aiFeedback.$inferInsert = {
    tenantId,
    recommendationId: input.recommendationId,
    decision: input.decision,
    createdBy: userId,
  };
  if (input.notes !== undefined) {
    feedbackValues.notes = input.notes;
  }
  if (input.confidenceDelta !== undefined) {
    feedbackValues.confidenceDelta = String(input.confidenceDelta);
  }

  const [feedback] = await db
    .insert(aiFeedback)
    .values(feedbackValues)
    .returning();

  const nextStatus = input.decision === 'accepted'
    ? 'accepted'
    : input.decision === 'rejected'
      ? 'rejected'
      : 'dismissed';

  const currentConfidence = parseNumeric(recommendation.confidenceScore);
  const nextConfidence = clampScore(currentConfidence + (input.confidenceDelta ?? 0));

  await db
    .update(aiRecommendations)
    .set({
      status: nextStatus,
      confidenceScore: String(nextConfidence),
      updatedAt: new Date(),
    })
    .where(eq(aiRecommendations.id, recommendation.id));

  return feedback;
}

export async function listModelRuns(tenantId: number, limit = 30) {
  return db
    .select()
    .from(aiModelRuns)
    .where(eq(aiModelRuns.tenantId, tenantId))
    .orderBy(desc(aiModelRuns.createdAt))
    .limit(limit);
}

export async function getFeatureSnapshot(tenantId: number, id: number) {
  const [snapshot] = await db
    .select()
    .from(aiFeatureSnapshots)
    .where(and(eq(aiFeatureSnapshots.id, id), eq(aiFeatureSnapshots.tenantId, tenantId)));

  if (!snapshot) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Snapshot de features nao encontrado' });
  }
  return snapshot;
}

export async function runDailyRefresh(tenantId: number, trigger = 'manual') {
  const capabilities = await getAICapabilities(tenantId);
  if (!capabilities.licensed) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Plano sem acesso ao modulo de IA' });
  }

  const summary = {
    predictionsCreated: 0,
    recommendationsCreated: 0,
    modelRuns: 0,
  };

  if (capabilities.flags.forecasting) {
    const forecast = await predictions.refreshForecasting(tenantId, trigger);
    summary.predictionsCreated += forecast.predictionsCreated;
    summary.recommendationsCreated += forecast.recommendationsCreated;
    summary.modelRuns += forecast.modelRuns;
  }

  if (capabilities.flags.operations) {
    const operational = await scheduling.refreshOperationalRecommendations(tenantId, trigger);
    summary.predictionsCreated += operational.predictionsCreated;
    summary.recommendationsCreated += operational.recommendationsCreated;
    summary.modelRuns += operational.modelRuns;
  }

  if (capabilities.flags.recommendation) {
    const assisted = await smartOrders.refreshSmartOrders(tenantId, trigger);
    summary.predictionsCreated += assisted.predictionsCreated;
    summary.recommendationsCreated += assisted.recommendationsCreated;
    summary.modelRuns += assisted.modelRuns;
  }

  if (capabilities.flags.riskCommercial) {
    const riskSummary = await risk.refreshRiskSignals(tenantId, trigger);
    summary.predictionsCreated += riskSummary.predictionsCreated;
    summary.recommendationsCreated += riskSummary.recommendationsCreated;
    summary.modelRuns += riskSummary.modelRuns;
  }

  logger.info({ action: 'ai.daily_refresh', tenantId, summary }, 'Rotina de IA executada');
  return summary;
}

export async function runRevenueForecastRefresh(tenantId: number, trigger: string) {
  const capabilities = await getAICapabilities(tenantId);
  if (!capabilities.licensed || !capabilities.flags.forecasting) {
    return { predictionsCreated: 0, recommendationsCreated: 0, modelRuns: 0 };
  }
  return predictions.refreshForecasting(tenantId, trigger);
}

export async function runStockDepletionForecast(tenantId: number, trigger: string) {
  const capabilities = await getAICapabilities(tenantId);
  if (!capabilities.licensed || !capabilities.flags.forecasting) {
    return { predictionsCreated: 0, recommendationsCreated: 0, modelRuns: 0 };
  }
  return predictions.refreshForecasting(tenantId, trigger);
}

export async function runReworkPatternDetection(tenantId: number, trigger: string) {
  const capabilities = await getAICapabilities(tenantId);
  if (!capabilities.licensed || !capabilities.flags.operations) {
    return { predictionsCreated: 0, recommendationsCreated: 0, modelRuns: 0 };
  }
  return scheduling.refreshOperationalRecommendations(tenantId, trigger);
}

export async function runScheduleOptimizationRefresh(tenantId: number, trigger: string) {
  const capabilities = await getAICapabilities(tenantId);
  if (!capabilities.licensed || !capabilities.flags.operations) {
    return { predictionsCreated: 0, recommendationsCreated: 0, modelRuns: 0 };
  }
  return scheduling.refreshOperationalRecommendations(tenantId, trigger);
}

export async function runClientCreditScoreRefresh(tenantId: number, trigger: string) {
  const capabilities = await getAICapabilities(tenantId);
  if (!capabilities.licensed || !capabilities.flags.riskCommercial) {
    return { predictionsCreated: 0, recommendationsCreated: 0, modelRuns: 0 };
  }
  return risk.refreshRiskSignals(tenantId, trigger);
}

export async function buildRevenueBaseline(tenantId: number) {
  const periodRows = await db.select({
    period: financialClosings.period,
    totalAmountCents: financialClosings.totalAmountCents,
  }).from(financialClosings)
    .where(eq(financialClosings.tenantId, tenantId))
    .orderBy(desc(financialClosings.period))
    .limit(3);

  if (periodRows.length === 0) {
    const [fallback] = await db.select({
      averageCents: sql<number>`COALESCE(AVG(${jobs.totalCents}), 0)`,
      countJobs: sql<number>`COUNT(*)`,
    }).from(jobs).where(eq(jobs.tenantId, tenantId));

    return {
      baselineRevenueCents: Number(fallback?.averageCents ?? 0) * 30,
      samples: Number(fallback?.countJobs ?? 0),
    };
  }

  const total = periodRows.reduce((acc, row) => acc + row.totalAmountCents, 0);
  return {
    baselineRevenueCents: Math.round(total / periodRows.length),
    samples: periodRows.length,
  };
}

export async function buildLeadTimeFeatures(tenantId: number) {
  const [data] = await db.select({
    avgLeadHours: sql<number>`
      COALESCE(
        AVG(EXTRACT(EPOCH FROM (${jobs.completedAt} - ${jobs.createdAt})) / 3600),
        0
      )
    `,
    overdueCount: sql<number>`COUNT(*) FILTER (WHERE ${jobs.deadline} < NOW() AND ${jobs.status} <> 'delivered')`,
    activeCount: sql<number>`COUNT(*) FILTER (WHERE ${jobs.status} IN ('pending', 'in_progress', 'quality_check', 'ready'))`,
  }).from(jobs)
    .where(eq(jobs.tenantId, tenantId));

  return {
    avgLeadHours: Number(data?.avgLeadHours ?? 0),
    overdueCount: Number(data?.overdueCount ?? 0),
    activeCount: Number(data?.activeCount ?? 0),
  };
}

export async function buildStockPressureFeatures(tenantId: number) {
  const [data] = await db.select({
    total: sql<number>`COUNT(*)`,
    belowMin: sql<number>`COUNT(*) FILTER (WHERE ${materials.currentStock} < ${materials.minStock} AND ${materials.isActive} = true)`,
  }).from(materials)
    .where(eq(materials.tenantId, tenantId));

  return {
    totalMaterials: Number(data?.total ?? 0),
    belowMin: Number(data?.belowMin ?? 0),
  };
}
