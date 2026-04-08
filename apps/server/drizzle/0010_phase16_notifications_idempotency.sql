-- Fase 16: idempotencia para alerta de prazo 24h

DELETE FROM deadline_notif_log a
USING deadline_notif_log b
WHERE a.id > b.id
  AND a.tenant_id = b.tenant_id
  AND a.user_id = b.user_id
  AND a.job_id = b.job_id;

CREATE UNIQUE INDEX IF NOT EXISTS deadline_notif_tenant_user_job_unique
  ON deadline_notif_log (tenant_id, user_id, job_id);
