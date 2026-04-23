ALTER TABLE "ai_command_runs"
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "idempotency_key" text,
  ADD COLUMN IF NOT EXISTS "provider_used" text,
  ADD COLUMN IF NOT EXISTS "model_used" text,
  ADD COLUMN IF NOT EXISTS "cached" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cost_cents" integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_command_runs_idempotency_uniq"
  ON "ai_command_runs" ("tenant_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
