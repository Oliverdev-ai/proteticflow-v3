DO $$ BEGIN
 CREATE TYPE "ai_domain" AS ENUM('forecasting', 'operations', 'recommendation', 'risk_commercial');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "ai_prediction_type" AS ENUM(
  'revenue_forecast',
  'production_time_estimate',
  'stock_depletion_forecast',
  'rework_pattern',
  'credit_score',
  'dynamic_pricing'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "ai_recommendation_type" AS ENUM(
  'smart_order',
  'schedule_optimization',
  'material_suggestion',
  'production_sequence',
  'collection_strategy',
  'price_adjustment'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "ai_recommendation_status" AS ENUM('suggested', 'accepted', 'rejected', 'dismissed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "ai_feedback_decision" AS ENUM('accepted', 'rejected', 'ignored');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "ai_model_run_status" AS ENUM('queued', 'running', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ai_tenant_settings" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "min_plan" varchar(32) DEFAULT 'starter' NOT NULL,
 "forecasting_enabled" boolean DEFAULT true NOT NULL,
 "operations_enabled" boolean DEFAULT true NOT NULL,
 "recommendation_enabled" boolean DEFAULT true NOT NULL,
 "risk_commercial_enabled" boolean DEFAULT false NOT NULL,
 "auto_execution_enabled" boolean DEFAULT false NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_model_runs" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "domain" "ai_domain" NOT NULL,
 "prediction_type" "ai_prediction_type",
 "recommendation_type" "ai_recommendation_type",
 "model_name" varchar(128) NOT NULL,
 "model_version" varchar(64) NOT NULL,
 "status" "ai_model_run_status" DEFAULT 'queued' NOT NULL,
 "trigger" varchar(64) DEFAULT 'manual' NOT NULL,
 "started_at" timestamp with time zone,
 "finished_at" timestamp with time zone,
 "error_message" text,
 "metrics_json" jsonb,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_feature_snapshots" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "model_run_id" integer,
 "domain" "ai_domain" NOT NULL,
 "entity_type" varchar(32) NOT NULL,
 "entity_id" integer NOT NULL,
 "features_json" jsonb NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_predictions" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "model_run_id" integer,
 "feature_snapshot_id" integer,
 "domain" "ai_domain" NOT NULL,
 "prediction_type" "ai_prediction_type" NOT NULL,
 "entity_type" varchar(32) NOT NULL,
 "entity_id" integer NOT NULL,
 "forecast_window_days" integer,
 "predicted_value" numeric(14, 4) NOT NULL,
 "unit" varchar(32) DEFAULT 'score' NOT NULL,
 "confidence_score" numeric(5, 4) DEFAULT '0' NOT NULL,
 "explanation" text,
 "explainability_json" jsonb,
 "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_recommendations" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "prediction_id" integer,
 "model_run_id" integer,
 "domain" "ai_domain" NOT NULL,
 "recommendation_type" "ai_recommendation_type" NOT NULL,
 "status" "ai_recommendation_status" DEFAULT 'suggested' NOT NULL,
 "target_entity_type" varchar(32) NOT NULL,
 "target_entity_id" integer NOT NULL,
 "priority_score" numeric(7, 4) DEFAULT '0' NOT NULL,
 "confidence_score" numeric(5, 4) DEFAULT '0' NOT NULL,
 "payload_json" jsonb NOT NULL,
 "rationale" text,
 "is_auto_executable" boolean DEFAULT false NOT NULL,
 "executed_at" timestamp with time zone,
 "expires_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_feedback" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "recommendation_id" integer NOT NULL,
 "decision" "ai_feedback_decision" NOT NULL,
 "confidence_delta" numeric(5, 4),
 "notes" text,
 "created_by" integer,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_tenant_settings_tenant_unique"
 ON "ai_tenant_settings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_tenant_settings_min_plan_idx"
 ON "ai_tenant_settings" ("min_plan");

CREATE INDEX IF NOT EXISTS "ai_model_runs_tenant_idx" ON "ai_model_runs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_model_runs_status_idx" ON "ai_model_runs" ("status");
CREATE INDEX IF NOT EXISTS "ai_model_runs_domain_idx" ON "ai_model_runs" ("domain");
CREATE INDEX IF NOT EXISTS "ai_model_runs_created_at_idx" ON "ai_model_runs" ("created_at");

CREATE INDEX IF NOT EXISTS "ai_feature_snapshots_tenant_idx" ON "ai_feature_snapshots" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_feature_snapshots_entity_idx"
 ON "ai_feature_snapshots" ("tenant_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "ai_feature_snapshots_model_run_idx" ON "ai_feature_snapshots" ("model_run_id");

CREATE INDEX IF NOT EXISTS "ai_predictions_tenant_idx" ON "ai_predictions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_predictions_type_idx" ON "ai_predictions" ("prediction_type");
CREATE INDEX IF NOT EXISTS "ai_predictions_entity_idx"
 ON "ai_predictions" ("tenant_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "ai_predictions_generated_at_idx" ON "ai_predictions" ("generated_at");

CREATE INDEX IF NOT EXISTS "ai_recommendations_tenant_idx" ON "ai_recommendations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_recommendations_status_idx" ON "ai_recommendations" ("status");
CREATE INDEX IF NOT EXISTS "ai_recommendations_type_idx" ON "ai_recommendations" ("recommendation_type");
CREATE INDEX IF NOT EXISTS "ai_recommendations_entity_idx"
 ON "ai_recommendations" ("tenant_id", "target_entity_type", "target_entity_id");
CREATE INDEX IF NOT EXISTS "ai_recommendations_created_at_idx" ON "ai_recommendations" ("created_at");

CREATE INDEX IF NOT EXISTS "ai_feedback_tenant_idx" ON "ai_feedback" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_feedback_recommendation_idx" ON "ai_feedback" ("recommendation_id");
CREATE INDEX IF NOT EXISTS "ai_feedback_created_at_idx" ON "ai_feedback" ("created_at");
