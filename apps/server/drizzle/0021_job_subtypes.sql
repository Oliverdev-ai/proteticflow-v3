DO $$ BEGIN
  ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'completed_with_rework';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "job_sub_type" AS ENUM ('standard', 'proof', 'rework');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "job_sub_type" "job_sub_type" DEFAULT 'standard' NOT NULL;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "is_urgent" boolean DEFAULT false NOT NULL;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "suspended_by" integer;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "suspend_reason" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "rework_reason" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "rework_parent_id" integer;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "proof_due_date" timestamp with time zone;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "proof_returned_at" timestamp with time zone;

DO $$ BEGIN
  ALTER TABLE "jobs"
    ADD CONSTRAINT "jobs_suspended_by_users_id_fk"
    FOREIGN KEY ("suspended_by") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "jobs"
    ADD CONSTRAINT "jobs_rework_parent_id_jobs_id_fk"
    FOREIGN KEY ("rework_parent_id") REFERENCES "public"."jobs"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "jobs_subtype_idx" ON "jobs" ("job_sub_type");
CREATE INDEX IF NOT EXISTS "jobs_urgent_idx" ON "jobs" ("is_urgent");
CREATE INDEX IF NOT EXISTS "jobs_suspended_at_idx" ON "jobs" ("suspended_at");
CREATE INDEX IF NOT EXISTS "jobs_rework_parent_idx" ON "jobs" ("rework_parent_id");
