import { z } from 'zod';

export const createSessionSchema = z.object({
  title: z.string().max(255).optional(),
});

export const sendMessageSchema = z.object({
  sessionId: z.number().int().positive(),
  content: z.string().min(1).max(4000),
});

export const listSessionsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.number().int().positive().optional(),
});

export const archiveSessionSchema = z.object({
  sessionId: z.number().int().positive(),
});

export const aiDomainSchema = z.enum(['forecasting', 'operations', 'recommendation', 'risk_commercial']);
export const aiPredictionTypeSchema = z.enum([
  'revenue_forecast',
  'production_time_estimate',
  'stock_depletion_forecast',
  'rework_pattern',
  'credit_score',
  'dynamic_pricing',
]);
export const aiRecommendationTypeSchema = z.enum([
  'smart_order',
  'schedule_optimization',
  'material_suggestion',
  'production_sequence',
  'collection_strategy',
  'price_adjustment',
]);
export const aiRecommendationStatusSchema = z.enum(['suggested', 'accepted', 'rejected', 'dismissed']);
export const aiFeedbackDecisionSchema = z.enum(['accepted', 'rejected', 'ignored']);
export const aiModelRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);
export const aiPlanTierSchema = z.enum(['trial', 'starter', 'pro', 'enterprise']);

export const aiFeatureFlagsSchema = z.object({
  forecasting: z.boolean().default(true),
  operations: z.boolean().default(true),
  recommendation: z.boolean().default(true),
  riskCommercial: z.boolean().default(false),
  autoExecutionEnabled: z.boolean().default(false),
  minPlan: aiPlanTierSchema.optional(),
});

export const runForecastsSchema = z.object({
  force: z.boolean().default(false),
});

export const listAiPredictionsSchema = z.object({
  predictionType: aiPredictionTypeSchema.optional(),
  domain: aiDomainSchema.optional(),
  modelVersion: z.string().max(64).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const listAiRecommendationsSchema = z.object({
  recommendationType: aiRecommendationTypeSchema.optional(),
  domain: aiDomainSchema.optional(),
  status: aiRecommendationStatusSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const recordAiFeedbackSchema = z.object({
  recommendationId: z.number().int().positive(),
  decision: aiFeedbackDecisionSchema,
  notes: z.string().max(2000).optional(),
  confidenceDelta: z.number().min(-1).max(1).optional(),
});

export const getAiSnapshotSchema = z.object({
  id: z.number().int().positive(),
});

export type AIFeatureFlagsInput = z.infer<typeof aiFeatureFlagsSchema>;
export type RunForecastsInput = z.infer<typeof runForecastsSchema>;
export type ListAiPredictionsInput = z.infer<typeof listAiPredictionsSchema>;
export type ListAiRecommendationsInput = z.infer<typeof listAiRecommendationsSchema>;
export type RecordAiFeedbackInput = z.infer<typeof recordAiFeedbackSchema>;
