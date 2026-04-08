-- Phase 15: Settings module hardening
DO $$ BEGIN
 CREATE TYPE "smtp_mode" AS ENUM('resend_fallback', 'custom_smtp');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "lab_settings"
  ADD COLUMN IF NOT EXISTS "secondary_color" varchar(7) DEFAULT '#6b7280' NOT NULL,
  ADD COLUMN IF NOT EXISTS "website" varchar(255),
  ADD COLUMN IF NOT EXISTS "printer_host" varchar(255),
  ADD COLUMN IF NOT EXISTS "printer_port" integer,
  ADD COLUMN IF NOT EXISTS "smtp_mode" "smtp_mode" DEFAULT 'resend_fallback' NOT NULL,
  ADD COLUMN IF NOT EXISTS "smtp_host" varchar(255),
  ADD COLUMN IF NOT EXISTS "smtp_port" integer,
  ADD COLUMN IF NOT EXISTS "smtp_secure" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "smtp_username" varchar(255),
  ADD COLUMN IF NOT EXISTS "smtp_password_encrypted" text,
  ADD COLUMN IF NOT EXISTS "smtp_from_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "smtp_from_email" varchar(320),
  ADD COLUMN IF NOT EXISTS "last_smtp_test_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_smtp_test_status" varchar(16);

CREATE UNIQUE INDEX IF NOT EXISTS "lab_settings_tenant_unique" ON "lab_settings" ("tenant_id");
