-- Migration 0037: Flow IA memory GA hardening
-- Upgrades the earlier key/value memory table to scoped, expiring, vector-searchable tenant memory.

CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

ALTER TABLE "ai_tenant_settings"
  ADD COLUMN IF NOT EXISTS "memory_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "memory_injection_paused" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

DROP INDEX IF EXISTS "ai_memory_tenant_user_key_uniq";
--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_memory'
      AND column_name = 'id'
      AND data_type = 'integer'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_memory'
      AND column_name = 'legacy_id'
  ) THEN
    ALTER TABLE "ai_memory" RENAME COLUMN "id" TO "legacy_id";
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "ai_memory"
  ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS "scope" text,
  ADD COLUMN IF NOT EXISTS "category" text,
  ADD COLUMN IF NOT EXISTS "entity_type" text,
  ADD COLUMN IF NOT EXISTS "entity_id" integer,
  ADD COLUMN IF NOT EXISTS "key_text" text,
  ADD COLUMN IF NOT EXISTS "value_json" jsonb,
  ADD COLUMN IF NOT EXISTS "embedding" vector(768),
  ADD COLUMN IF NOT EXISTS "confidence" double precision,
  ADD COLUMN IF NOT EXISTS "last_accessed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "access_count" integer;
--> statement-breakpoint

DO $$ DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'ai_memory'
    AND kcu.column_name = 'user_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "ai_memory" DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "ai_memory" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE "ai_memory"
  ADD CONSTRAINT "ai_memory_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint

UPDATE "ai_memory"
SET
  "id" = COALESCE("id", gen_random_uuid()),
  "scope" = COALESCE("scope", 'user'),
  "category" = COALESCE("category", 'general'),
  "key_text" = COALESCE("key_text", "key"),
  "value_json" = COALESCE("value_json", jsonb_build_object('value', "value")),
  "source" = CASE
    WHEN "source" = 'assistant' THEN 'flow_ia'
    WHEN "source" = 'user_explicit' THEN 'manual'
    WHEN "source" IN ('flow_ia', 'manual', 'inferred') THEN "source"
    ELSE 'flow_ia'
  END,
  "confidence" = COALESCE("confidence", 1),
  "access_count" = COALESCE("access_count", 0),
  "expires_at" = COALESCE("expires_at", NOW() + INTERVAL '180 days');
--> statement-breakpoint

ALTER TABLE "ai_memory"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "scope" SET NOT NULL,
  ALTER COLUMN "category" SET NOT NULL,
  ALTER COLUMN "key_text" SET NOT NULL,
  ALTER COLUMN "value_json" SET NOT NULL,
  ALTER COLUMN "source" SET DEFAULT 'flow_ia',
  ALTER COLUMN "source" SET NOT NULL,
  ALTER COLUMN "confidence" SET DEFAULT 1,
  ALTER COLUMN "confidence" SET NOT NULL,
  ALTER COLUMN "access_count" SET DEFAULT 0,
  ALTER COLUMN "access_count" SET NOT NULL,
  ALTER COLUMN "expires_at" SET DEFAULT (NOW() + INTERVAL '180 days'),
  ALTER COLUMN "expires_at" SET NOT NULL;
--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_memory'
      AND constraint_name = 'ai_memory_pkey'
  ) THEN
    ALTER TABLE "ai_memory" DROP CONSTRAINT "ai_memory_pkey";
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "ai_memory" ADD PRIMARY KEY ("id");
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_memory'
      AND constraint_name = 'ai_memory_scope_check'
  ) THEN
    ALTER TABLE "ai_memory"
      ADD CONSTRAINT "ai_memory_scope_check" CHECK ("scope" IN ('user', 'tenant'));
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_memory'
      AND constraint_name = 'ai_memory_category_check'
  ) THEN
    ALTER TABLE "ai_memory"
      ADD CONSTRAINT "ai_memory_category_check" CHECK (
        "category" IN ('client_preference', 'workflow_rule', 'entity_alias', 'general')
      );
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_memory'
      AND constraint_name = 'ai_memory_source_check'
  ) THEN
    ALTER TABLE "ai_memory"
      ADD CONSTRAINT "ai_memory_source_check" CHECK ("source" IN ('flow_ia', 'manual', 'inferred'));
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_memory'
      AND constraint_name = 'ai_memory_confidence_check'
  ) THEN
    ALTER TABLE "ai_memory"
      ADD CONSTRAINT "ai_memory_confidence_check" CHECK ("confidence" BETWEEN 0 AND 1);
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ai_memory'
      AND constraint_name = 'ai_memory_value_size_check'
  ) THEN
    ALTER TABLE "ai_memory"
      ADD CONSTRAINT "ai_memory_value_size_check" CHECK (pg_column_size("value_json") <= 2048);
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ai_memory_tenant_idx" ON "ai_memory" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_memory_lookup_idx"
  ON "ai_memory" ("tenant_id", "user_id", "category", "entity_type", "entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_memory_expires_idx" ON "ai_memory" ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_memory_embedding_idx"
  ON "ai_memory" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_memory_cap() RETURNS TRIGGER AS $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM ai_memory WHERE tenant_id = NEW.tenant_id;
  IF cnt > 500 THEN
    DELETE FROM ai_memory WHERE id IN (
      SELECT id FROM ai_memory
      WHERE tenant_id = NEW.tenant_id
      ORDER BY last_accessed_at ASC NULLS FIRST, created_at ASC
      LIMIT (cnt - 500)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "ai_memory_cap_trigger" ON "ai_memory";
--> statement-breakpoint
CREATE TRIGGER "ai_memory_cap_trigger"
  AFTER INSERT ON "ai_memory"
  FOR EACH ROW EXECUTE FUNCTION enforce_memory_cap();
