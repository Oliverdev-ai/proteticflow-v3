-- Migration 0039: enforce ai_memory identity for atomic upserts.

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY
        "tenant_id",
        "scope",
        "category",
        "key_text",
        "user_id",
        "entity_type",
        "entity_id"
      ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
    ) AS row_num
  FROM "ai_memory"
)
DELETE FROM "ai_memory"
USING ranked
WHERE "ai_memory"."id" = ranked."id"
  AND ranked.row_num > 1;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "ai_memory_identity_uniq"
  ON "ai_memory" (
    "tenant_id",
    "scope",
    "category",
    "key_text",
    "user_id",
    "entity_type",
    "entity_id"
  ) NULLS NOT DISTINCT;
