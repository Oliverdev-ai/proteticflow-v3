import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const aiDomainEnum = pgEnum('ai_domain', [
  'forecasting',
  'operations',
  'recommendation',
  'risk_commercial',
]);

export const aiPredictionTypeEnum = pgEnum('ai_prediction_type', [
  'revenue_forecast',
  'production_time_estimate',
  'stock_depletion_forecast',
  'rework_pattern',
  'credit_score',
  'dynamic_pricing',
]);

export const aiRecommendationTypeEnum = pgEnum('ai_recommendation_type', [
  'smart_order',
  'schedule_optimization',
  'material_suggestion',
  'production_sequence',
  'collection_strategy',
  'price_adjustment',
]);

export const aiRecommendationStatusEnum = pgEnum('ai_recommendation_status', [
  'suggested',
  'accepted',
  'rejected',
  'dismissed',
]);

export const aiFeedbackDecisionEnum = pgEnum('ai_feedback_decision', ['accepted', 'rejected', 'ignored']);
export const aiModelRunStatusEnum = pgEnum('ai_model_run_status', ['queued', 'running', 'completed', 'failed']);

export const aiTenantSettings = pgTable('ai_tenant_settings', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  minPlan: varchar('min_plan', { length: 32 }).notNull().default('starter'),
  forecastingEnabled: boolean('forecasting_enabled').notNull().default(true),
  operationsEnabled: boolean('operations_enabled').notNull().default(true),
  recommendationEnabled: boolean('recommendation_enabled').notNull().default(true),
  riskCommercialEnabled: boolean('risk_commercial_enabled').notNull().default(false),
  autoExecutionEnabled: boolean('auto_execution_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('ai_tenant_settings_tenant_unique').on(table.tenantId),
  index('ai_tenant_settings_min_plan_idx').on(table.minPlan),
]);

export const aiModelRuns = pgTable('ai_model_runs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  domain: aiDomainEnum('domain').notNull(),
  predictionType: aiPredictionTypeEnum('prediction_type'),
  recommendationType: aiRecommendationTypeEnum('recommendation_type'),
  modelName: varchar('model_name', { length: 128 }).notNull(),
  modelVersion: varchar('model_version', { length: 64 }).notNull(),
  status: aiModelRunStatusEnum('status').default('queued').notNull(),
  trigger: varchar('trigger', { length: 64 }).notNull().default('manual'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  metricsJson: jsonb('metrics_json').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_model_runs_tenant_idx').on(table.tenantId),
  index('ai_model_runs_status_idx').on(table.status),
  index('ai_model_runs_domain_idx').on(table.domain),
  index('ai_model_runs_created_at_idx').on(table.createdAt),
]);

export const aiFeatureSnapshots = pgTable('ai_feature_snapshots', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  modelRunId: integer('model_run_id'),
  domain: aiDomainEnum('domain').notNull(),
  entityType: varchar('entity_type', { length: 32 }).notNull(),
  entityId: integer('entity_id').notNull(),
  featuresJson: jsonb('features_json').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_feature_snapshots_tenant_idx').on(table.tenantId),
  index('ai_feature_snapshots_entity_idx').on(table.tenantId, table.entityType, table.entityId),
  index('ai_feature_snapshots_model_run_idx').on(table.modelRunId),
]);

export const aiPredictions = pgTable('ai_predictions', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  modelRunId: integer('model_run_id'),
  featureSnapshotId: integer('feature_snapshot_id'),
  domain: aiDomainEnum('domain').notNull(),
  predictionType: aiPredictionTypeEnum('prediction_type').notNull(),
  entityType: varchar('entity_type', { length: 32 }).notNull(),
  entityId: integer('entity_id').notNull(),
  forecastWindowDays: integer('forecast_window_days'),
  predictedValue: numeric('predicted_value', { precision: 14, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 32 }).notNull().default('score'),
  confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }).notNull().default('0'),
  explanation: text('explanation'),
  explainabilityJson: jsonb('explainability_json').$type<Record<string, unknown>>(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_predictions_tenant_idx').on(table.tenantId),
  index('ai_predictions_type_idx').on(table.predictionType),
  index('ai_predictions_entity_idx').on(table.tenantId, table.entityType, table.entityId),
  index('ai_predictions_generated_at_idx').on(table.generatedAt),
]);

export const aiRecommendations = pgTable('ai_recommendations', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  predictionId: integer('prediction_id'),
  modelRunId: integer('model_run_id'),
  domain: aiDomainEnum('domain').notNull(),
  recommendationType: aiRecommendationTypeEnum('recommendation_type').notNull(),
  status: aiRecommendationStatusEnum('status').default('suggested').notNull(),
  targetEntityType: varchar('target_entity_type', { length: 32 }).notNull(),
  targetEntityId: integer('target_entity_id').notNull(),
  priorityScore: numeric('priority_score', { precision: 7, scale: 4 }).notNull().default('0'),
  confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }).notNull().default('0'),
  payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull(),
  rationale: text('rationale'),
  isAutoExecutable: boolean('is_auto_executable').notNull().default(false),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_recommendations_tenant_idx').on(table.tenantId),
  index('ai_recommendations_status_idx').on(table.status),
  index('ai_recommendations_type_idx').on(table.recommendationType),
  index('ai_recommendations_entity_idx').on(table.tenantId, table.targetEntityType, table.targetEntityId),
  index('ai_recommendations_created_at_idx').on(table.createdAt),
]);

export const aiFeedback = pgTable('ai_feedback', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  recommendationId: integer('recommendation_id').notNull(),
  decision: aiFeedbackDecisionEnum('decision').notNull(),
  confidenceDelta: numeric('confidence_delta', { precision: 5, scale: 4 }),
  notes: text('notes'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_feedback_tenant_idx').on(table.tenantId),
  index('ai_feedback_recommendation_idx').on(table.recommendationId),
  index('ai_feedback_created_at_idx').on(table.createdAt),
]);
