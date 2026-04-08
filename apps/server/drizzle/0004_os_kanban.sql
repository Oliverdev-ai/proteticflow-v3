-- Migration 0004: OS + Kanban (Fases 6+7)
-- Novas tabelas e campos para Ordens de Serviço e Kanban

-- Job stages (etapas de produção configuráveis por tenant)
CREATE TABLE IF NOT EXISTS "job_stages" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "name" varchar(128) NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" integer
);
CREATE INDEX IF NOT EXISTS "job_stages_tenant_idx" ON "job_stages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "job_stages_order_idx" ON "job_stages" ("tenant_id", "sort_order");

-- Job photos (fotos por etapa — S3/MinIO)
CREATE TABLE IF NOT EXISTS "job_photos" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "job_id" integer NOT NULL,
  "stage_id" integer,
  "url" text NOT NULL,
  "thumbnail_url" text,
  "description" varchar(512),
  "uploaded_by" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "job_photos_tenant_idx" ON "job_photos" ("tenant_id");
CREATE INDEX IF NOT EXISTS "job_photos_job_idx" ON "job_photos" ("job_id");

-- Order counters (PAD-04: IDs sequenciais sem race condition)
CREATE TABLE IF NOT EXISTS "order_counters" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL UNIQUE,
  "last_order_number" integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "order_counters_tenant_idx" ON "order_counters" ("tenant_id");

-- Novos campos na tabela jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "prothesis_type" varchar(128);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "material" varchar(128);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "color" varchar(64);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "instructions" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "current_stage_id" integer;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "cancel_reason" text;

-- Índice para deadline (filtro de atrasados)
CREATE INDEX IF NOT EXISTS "jobs_deadline_idx" ON "jobs" ("deadline");

-- Remover coluna service_name (redundante com job_items.service_name_snapshot)
-- Nota: se service_name tiver NOT NULL, pode precisar de ajuste. Usando DROP COLUMN IF EXISTS.
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "service_name";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "progress";
