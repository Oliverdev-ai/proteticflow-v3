-- Migration 0028: adiciona coluna onboarding_completed na tabela tenants
-- S5-05: Onboarding Wizard

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- Backfill: tenants existentes já passaram pelo onboarding (lab já configurado)
UPDATE "tenants" SET "onboarding_completed" = true WHERE true;
