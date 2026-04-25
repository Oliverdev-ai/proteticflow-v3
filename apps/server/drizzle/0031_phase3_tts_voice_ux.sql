ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "ai_voice_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "ai_voice_gender" varchar(16) NOT NULL DEFAULT 'female',
  ADD COLUMN IF NOT EXISTS "ai_voice_speed" real NOT NULL DEFAULT 1.0;

CREATE TABLE IF NOT EXISTS "tts_usage" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "characters_billed" integer NOT NULL,
  "audio_bytes" integer NOT NULL,
  "voice" varchar(16) NOT NULL DEFAULT 'female',
  "source" varchar(32) NOT NULL DEFAULT 'ai.tts',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tts_usage_tenant_idx" ON "tts_usage" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tts_usage_user_idx" ON "tts_usage" ("user_id");
CREATE INDEX IF NOT EXISTS "tts_usage_created_idx" ON "tts_usage" ("created_at");
