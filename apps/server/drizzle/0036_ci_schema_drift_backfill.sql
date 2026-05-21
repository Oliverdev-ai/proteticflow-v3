-- Migration 0036: backfill de drift da cadeia db:migrate
-- Objetos abaixo existiam em bancos ajustados por db:push, mas faltavam em migrations.

ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'rework_in_progress';
--> statement-breakpoint
ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'suspended';
--> statement-breakpoint
ALTER TYPE "notif_type" ADD VALUE IF NOT EXISTS 'error';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
--> statement-breakpoint
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "two_factor_secret" varchar(128),
  ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" varchar(255) NOT NULL,
  "user_agent" varchar(512),
  "ip_address" varchar(45),
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rt_user_idx" ON "refresh_tokens" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rt_token_hash_idx" ON "refresh_tokens" ("token_hash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" varchar(255) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions"
  ADD COLUMN IF NOT EXISTS "tenant_id" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ps_tenant_user_idx" ON "push_subscriptions" ("tenant_id", "user_id");
--> statement-breakpoint
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "deleted_by" integer;
--> statement-breakpoint
ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "resume_status" varchar(64);
--> statement-breakpoint
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "event_type" "event_type" NOT NULL DEFAULT 'outro';
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'type'
  ) THEN
    EXECUTE 'UPDATE "events"
      SET "event_type" = COALESCE("type", ''outro''::"event_type")
      WHERE "event_type" IS NULL';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "accounts_receivable"
  ADD COLUMN IF NOT EXISTS "amount_cents" integer;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts_receivable'
      AND column_name = 'amount'
  ) THEN
    ALTER TABLE "accounts_receivable" ALTER COLUMN "amount" DROP NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts_receivable'
      AND column_name = 'amount'
  ) THEN
    UPDATE "accounts_receivable"
    SET "amount_cents" = COALESCE(round("amount" * 100)::integer, 0)
    WHERE "amount_cents" IS NULL;
  ELSE
    UPDATE "accounts_receivable"
    SET "amount_cents" = 0
    WHERE "amount_cents" IS NULL;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "accounts_receivable"
  ALTER COLUMN "amount_cents" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounts_payable"
  ADD COLUMN IF NOT EXISTS "amount_cents" integer;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts_payable'
      AND column_name = 'amount'
  ) THEN
    ALTER TABLE "accounts_payable" ALTER COLUMN "amount" DROP NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts_payable'
      AND column_name = 'amount'
  ) THEN
    UPDATE "accounts_payable"
    SET "amount_cents" = COALESCE(round("amount" * 100)::integer, 0)
    WHERE "amount_cents" IS NULL;
  ELSE
    UPDATE "accounts_payable"
    SET "amount_cents" = 0
    WHERE "amount_cents" IS NULL;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "accounts_payable"
  ALTER COLUMN "amount_cents" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "financial_closings"
  ADD COLUMN IF NOT EXISTS "total_amount_cents" integer,
  ADD COLUMN IF NOT EXISTS "paid_amount_cents" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pending_amount_cents" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_closings'
      AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE "financial_closings" ALTER COLUMN "total_amount" DROP NOT NULL;
    ALTER TABLE "financial_closings" ALTER COLUMN "paid_amount" DROP NOT NULL;
    ALTER TABLE "financial_closings" ALTER COLUMN "pending_amount" DROP NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_closings'
      AND column_name = 'total_amount'
  ) THEN
    UPDATE "financial_closings"
    SET
      "total_amount_cents" = COALESCE("total_amount_cents", round("total_amount" * 100)::integer, 0),
      "paid_amount_cents" = COALESCE("paid_amount_cents", round("paid_amount" * 100)::integer, 0),
      "pending_amount_cents" = COALESCE("pending_amount_cents", round("pending_amount" * 100)::integer, 0)
    WHERE "total_amount_cents" IS NULL;
  ELSE
    UPDATE "financial_closings"
    SET "total_amount_cents" = 0
    WHERE "total_amount_cents" IS NULL;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "financial_closings"
  ALTER COLUMN "total_amount_cents" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "unit_cost_cents" integer;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_movements'
      AND column_name = 'unit_cost'
  ) THEN
    UPDATE "stock_movements"
    SET "unit_cost_cents" = round("unit_cost" * 100)::integer
    WHERE "unit_cost_cents" IS NULL
      AND "unit_cost" IS NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "event_key" "notif_event" NOT NULL DEFAULT 'deadline_24h';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "event_key" "notif_event" NOT NULL,
  "in_app_enabled" boolean NOT NULL DEFAULT true,
  "push_enabled" boolean NOT NULL DEFAULT true,
  "email_enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notif_pref_tenant_user_event_unique"
  ON "notification_preferences" ("tenant_id", "user_id", "event_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_pref_tenant_user_idx"
  ON "notification_preferences" ("tenant_id", "user_id");
