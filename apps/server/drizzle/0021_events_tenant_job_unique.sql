DELETE FROM events e
USING events newer
WHERE e.id < newer.id
  AND e.tenant_id = newer.tenant_id
  AND e.job_id = newer.job_id
  AND e.job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_tenant_job_unique
  ON events (tenant_id, job_id);
