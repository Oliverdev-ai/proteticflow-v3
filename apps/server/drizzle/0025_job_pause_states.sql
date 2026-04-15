ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'rework_in_progress';
ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'suspended';

ALTER TABLE "jobs"
ADD COLUMN IF NOT EXISTS "resume_status" varchar(64);

UPDATE "jobs"
SET
  "status" = 'rework_in_progress',
  "job_sub_type" = 'rework',
  "suspended_at" = COALESCE("suspended_at", NOW()),
  "suspend_reason" = COALESCE("suspend_reason", "rework_reason", 'Remoldagem em andamento'),
  "resume_status" = COALESCE("resume_status", 'ready')
WHERE "status" = 'completed_with_rework';
