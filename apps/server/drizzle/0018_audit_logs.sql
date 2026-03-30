CREATE TABLE IF NOT EXISTS "audit_logs" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "user_id" integer NOT NULL,
 "action" varchar(128) NOT NULL,
 "entity_type" varchar(64) NOT NULL,
 "entity_id" integer,
 "old_value" jsonb,
 "new_value" jsonb,
 "ip_address" varchar(45),
 "user_agent" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "tenant_members" ADD COLUMN IF NOT EXISTS "blocked_at" timestamp with time zone;
ALTER TABLE "tenant_members" ADD COLUMN IF NOT EXISTS "blocked_reason" text;
ALTER TABLE "tenant_members" ADD COLUMN IF NOT EXISTS "blocked_by" integer;

CREATE INDEX IF NOT EXISTS "audit_logs_tenant_idx" ON "audit_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" ("entity_type","entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" ("user_id");
