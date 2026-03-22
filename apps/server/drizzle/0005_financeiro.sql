-- Migration 0005: Sistema Financeiro (Fase 8)

-- Livro caixa
CREATE TYPE "public"."cashbook_entry_type" AS ENUM('credit', 'debit');
CREATE TABLE IF NOT EXISTS "cashbook_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "type" "cashbook_entry_type" NOT NULL,
  "amount_cents" integer NOT NULL,
  "description" varchar(512) NOT NULL,
  "category" varchar(128),
  "ar_id" integer,
  "ap_id" integer,
  "job_id" integer,
  "client_id" integer,
  "reference_date" timestamp with time zone NOT NULL,
  "created_by" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "cashbook_tenant_idx" ON "cashbook_entries" ("tenant_id");
CREATE INDEX IF NOT EXISTS "cashbook_date_idx" ON "cashbook_entries" ("tenant_id", "reference_date");
CREATE INDEX IF NOT EXISTS "cashbook_type_idx" ON "cashbook_entries" ("type");

-- AR: novos campos
ALTER TABLE "accounts_receivable" ADD COLUMN IF NOT EXISTS "payment_method" varchar(64);
ALTER TABLE "accounts_receivable" ADD COLUMN IF NOT EXISTS "cancel_reason" text;
ALTER TABLE "accounts_receivable" ADD COLUMN IF NOT EXISTS "cancelled_by" integer;

-- AP: novos campos
ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "supplier_id" integer;
ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "issued_at" timestamp with time zone;
ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "payment_method" varchar(64);
ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "reference" varchar(255);
ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "cancel_reason" text;
ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "cancelled_by" integer;

-- Closings: clientId nullable + novos campos
ALTER TABLE "financial_closings" ALTER COLUMN "client_id" DROP NOT NULL;
ALTER TABLE "financial_closings" ADD COLUMN IF NOT EXISTS "breakdown_json" text;
ALTER TABLE "financial_closings" ADD COLUMN IF NOT EXISTS "closed_by" integer;

-- Indexes para período
CREATE INDEX IF NOT EXISTS "ar_due_date_idx" ON "accounts_receivable" ("due_date");
CREATE INDEX IF NOT EXISTS "ar_job_idx" ON "accounts_receivable" ("job_id");
CREATE INDEX IF NOT EXISTS "closing_period_idx" ON "financial_closings" ("tenant_id", "period");
