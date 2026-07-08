-- Migration 0038: remove ai_memory legacy columns after Fase 7 backfill.

ALTER TABLE "ai_memory" DROP COLUMN IF EXISTS "key";
--> statement-breakpoint
ALTER TABLE "ai_memory" DROP COLUMN IF EXISTS "value";
--> statement-breakpoint
ALTER TABLE "ai_memory" DROP COLUMN IF EXISTS "legacy_id";
