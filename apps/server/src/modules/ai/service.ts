import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { db } from '../../db/index.js';
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
import type {
  AIFeatureFlagsInput,
  ListAiPredictionsInput,
  ListAiRecommendationsInput,
  RecordAiFeedbackInput,
} from '@proteticflow/shared';
import { PLAN_TIER } from '@proteticflow/shared';
import * as predictions from './predictions.js';
import * as scheduling from './scheduling.js';
import * as smartOrders from './smart-orders.js';
import * as risk from './risk.js';

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

export async function ensureTenantAISettings(tenantId: number) {
  const [existing] = await db.select().from(aiTenantSettings).where(eq(aiTenantSettings.tenantId, tenantId));
  if (existing) return existing;

  const [created] = await db.insert(aiTenantSettings).values({ tenantId }).returning();
  return created;
}

export async function updateTenantAISettings(tenantId: number, input: AIFeatureFlagsInput) {
  const settings = await ensureTenantAISettings(tenantId);
  const [updated] = await db.update(aiTenantSettings).set({
    forecastingEnabled: input.forecasting,
    operationsEnabled: input.operations,
    recommendationEnabled: input.recommendation,
    riskCommercialEnabled: input.riskCommercial,
    autoExecutionEnabled: input.autoExecutionEnabled,
    updatedAt: new Date(),
  }).where(eq(aiTenantSettings.id, settings.id)).returning();
  return updated;
}

export async function getAICapabilities(tenantId: number) {
  const [tenant] = await db.select({ plan: tenants.plan }).from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });

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
) {
  const [run] = await db.insert(aiModelRuns).values({
    tenantId,
    domain: input.domain,
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    trigger: input.trigger,
    predictionType: input.predictionType,
    recommendationType: input.recommendationType,
    status: 'running',
    startedAt: new Date(),
  }).returning();
  return run;
}

export async function finishModelRun(
  runId: number,
  input: { status: 'completed' | 'failed'; metrics?: Record<string, unknown>; errorMessage?: string },
) {
  const [updated] = await db.update(aiModelRuns).set({
    status: input.status,
    metricsJson: input.metrics,
    errorMessage: input.errorMessage,
    finishedAt: new Date(),
  }).where(eq(aiModelRuns.id, runId)).returning();
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
) {
  const [snapshot] = await db.insert(aiFeatureSnapshots).values({
    tenantId,
    modelRunId: input.modelRunId,
    domain: input.domain,
    entityType: input.entityType,
    entityId: input.entityId,
    featuresJson: input.features,
  }).returning();
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
) {
  const [prediction] = await db.insert(aiPredictions).values({
    tenantId,
    modelRunId: input.modelRunId,
    featureSnapshotId: input.featureSnapshotId,
    domain: input.domain,
    predictionType: input.predictionType,
    entityType: input.entityType,
    entityId: input.entityId,
    predictedValue: String(input.predictedValue),
    confidenceScore: String(clampScore(input.confidenceScore)),
    explanation: input.explanation,
    explainabilityJson: input.explainability,
    unit: input.unit ?? 'score',
    forecastWindowDays: input.forecastWindowDays,
  }).returning();
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
) {
  const [recommendation] = await db.insert(aiRecommendations).values({
    tenantId,
    predictionId: input.predictionId,
    modelRunId: input.modelRunId,
    domain: input.domain,
    recommendationType: input.recommendationType,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    payloadJson: input.payload,
    rationale: input.rationale,
    confidenceScore: String(clampScore(input.confidenceScore)),
    priorityScore: String(Math.max(0, input.priorityScore)),
    isAutoExecutable: input.isAutoExecutable ?? false,
    expiresAt: input.expiresAt,
  }).returning();
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
  const [recommendation] = await db.select().from(aiRecommendations)
    .where(and(eq(aiRecommendations.id, input.recommendationId), eq(aiRecommendations.tenantId, tenantId)));

  if (!recommendation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Recomendacao nao encontrada' });
  }

  const [feedback] = await db.insert(aiFeedback).values({
    tenantId,
    recommendationId: input.recommendationId,
    decision: input.decision,
    notes: input.notes,
    confidenceDelta: input.confidenceDelta === undefined ? null : String(input.confidenceDelta),
    createdBy: userId,
  }).returning();

  const nextStatus = input.decision === 'accepted'
    ? 'accepted'
    : input.decision === 'rejected'
      ? 'rejected'
      : 'dismissed';

  const currentConfidence = parseNumeric(recommendation.confidenceScore);
  const nextConfidence = clampScore(currentConfidence + (input.confidenceDelta ?? 0));

  await db.update(aiRecommendations).set({
    status: nextStatus,
    confidenceScore: String(nextConfidence),
    updatedAt: new Date(),
  }).where(eq(aiRecommendations.id, recommendation.id));

  return feedback;
}

export async function listModelRuns(tenantId: number, limit = 30) {
  return db.select().from(aiModelRuns)
    .where(eq(aiModelRuns.tenantId, tenantId))
    .orderBy(desc(aiModelRuns.createdAt))
    .limit(limit);
}

export async function getFeatureSnapshot(tenantId: number, id: number) {
  const [snapshot] = await db.select().from(aiFeatureSnapshots)
    .where(and(eq(aiFeatureSnapshots.id, id), eq(aiFeatureSnapshots.tenantId, tenantId)));
  if (!snapshot) throw new TRPCError({ code: 'NOT_FOUND', message: 'Snapshot de features nao encontrado' });
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
