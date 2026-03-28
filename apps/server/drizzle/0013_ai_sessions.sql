DO $$ BEGIN
 CREATE TYPE "public"."ai_session_status" AS ENUM('active', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ai_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "title" varchar(255),
  "status" "ai_session_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "session_id" integer NOT NULL REFERENCES "ai_sessions"("id") ON DELETE CASCADE,
  "role" "ai_message_role" NOT NULL,
  "content" text NOT NULL,
  "command_detected" varchar(64),
  "tokens_used" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_sessions_tenant_idx" ON "ai_sessions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_sessions_user_idx" ON "ai_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "ai_sessions_updated_idx" ON "ai_sessions" ("updated_at");

CREATE INDEX IF NOT EXISTS "ai_messages_session_idx" ON "ai_messages" ("session_id");
CREATE INDEX IF NOT EXISTS "ai_messages_tenant_idx" ON "ai_messages" ("tenant_id");
