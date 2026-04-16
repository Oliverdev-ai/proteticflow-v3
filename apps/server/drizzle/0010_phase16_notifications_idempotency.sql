-- Fase 16: adicionar tenant_id/user_id em deadline_notif_log + idempotencia

-- Adicionar colunas que faltavam na criacao inicial (0000)
ALTER TABLE "deadline_notif_log"
  ADD COLUMN IF NOT EXISTS "tenant_id" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "user_id" integer NOT NULL DEFAULT 0;

-- Remover duplicatas existentes (se houver)
DELETE FROM deadline_notif_log
WHERE id IN (
  SELECT a.id
  FROM deadline_notif_log a
  JOIN deadline_notif_log b ON
    a.tenant_id = b.tenant_id AND
    a.user_id   = b.user_id   AND
    a.job_id    = b.job_id    AND
    a.id > b.id
);

CREATE UNIQUE INDEX IF NOT EXISTS deadline_notif_tenant_user_job_unique
  ON deadline_notif_log (tenant_id, user_id, job_id);
