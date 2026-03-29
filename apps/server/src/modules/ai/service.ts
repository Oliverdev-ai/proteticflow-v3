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
} from '@proteticflow/shared';
import {
  PLAN_TIER,
  archiveSessionSchema,
  createSessionSchema,
  listSessionsSchema,
} from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { aiMessages, aiSessions } from '../../db/schema/ai.js';
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
import * as predictions from './predictions.js';
import * as risk from './risk.js';
import * as scheduling from './scheduling.js';
import * as smartOrders from './smart-orders.js';

type CreateSessionInput = z.infer<typeof createSessionSchema>;
type ListSessionsInput = z.infer<typeof listSessionsSchema>;
type ArchiveSessionInput = z.infer<typeof archiveSessionSchema>;

type SessionRow = typeof aiSessions.$inferSelect;
type MessageRow = typeof aiMessages.$inferSelect;

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
