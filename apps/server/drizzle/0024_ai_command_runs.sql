DO $$ BEGIN
 CREATE TYPE "public"."ai_command_channel" AS ENUM('text', 'voice');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."ai_command_risk_level" AS ENUM('read_only', 'assistive', 'transactional', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."ai_command_execution_status" AS ENUM(
  'pending',
  'awaiting_confirmation',
  'executing',
  'success',
  'error',
  'cancelled'
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ai_command_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "session_id" integer REFERENCES "ai_sessions"("id"),

  "channel" "ai_command_channel" NOT NULL DEFAULT 'text',
  "raw_input" text NOT NULL,
  "normalized_input" text,

  "intent" varchar(64),
  "confidence" numeric(4, 3),
  "entities_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "missing_fields" jsonb NOT NULL DEFAULT '[]'::jsonb,

  "risk_level" "ai_command_risk_level",
  "requires_confirmation" boolean NOT NULL DEFAULT false,
  "confirmed_at" timestamp with time zone,
  "confirmed_by" integer REFERENCES "users"("id"),

  "tool_name" varchar(64),
  "tool_input_json" jsonb,
  "tool_output_json" jsonb,
  "execution_status" "ai_command_execution_status" NOT NULL DEFAULT 'pending',
  "error_code" varchar(32),
  "error_message" text,

  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "executed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "ai_command_runs_tenant_idx" ON "ai_command_runs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_command_runs_session_idx" ON "ai_command_runs" ("session_id");
CREATE INDEX IF NOT EXISTS "ai_command_runs_intent_idx" ON "ai_command_runs" ("intent");
CREATE INDEX IF NOT EXISTS "ai_command_runs_status_idx" ON "ai_command_runs" ("execution_status");
