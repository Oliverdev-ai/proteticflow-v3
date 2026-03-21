-- Migration 0002: Tenancy adjustments (Fase 3)
-- Adiciona contadores de uso à tabela tenants e unique constraint em tenant_members

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "client_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "job_count_this_month" integer NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "user_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "price_table_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storage_used_mb" integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "tm_tenant_user_unique" ON "tenant_members" ("tenant_id", "user_id");
DROP INDEX IF EXISTS "tm_tenant_user_idx";
