-- Fase 7: Memoria persistente, quiet mode, LGPD data export/delete
-- Base: 0ad5091

-- Memoria do assistente por tenant+user
CREATE TABLE IF NOT EXISTS ai_memory (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'assistant',
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_memory_tenant_user_key_uniq
  ON ai_memory (tenant_id, user_id, key);

CREATE INDEX IF NOT EXISTS ai_memory_tenant_user_idx ON ai_memory (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS ai_memory_expires_idx ON ai_memory (expires_at) WHERE expires_at IS NOT NULL;

-- Quiet mode por tenant (silencia o assistente em horario configurado)
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS quiet_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quiet_mode_start   TEXT NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_mode_end     TEXT NOT NULL DEFAULT '07:00';

-- LGPD: registro de solicitacoes de portabilidade/exclusao
CREATE TABLE IF NOT EXISTS lgpd_requests (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('export', 'delete')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  payload_url  TEXT
);

CREATE INDEX IF NOT EXISTS lgpd_requests_tenant_user_idx ON lgpd_requests (tenant_id, user_id);
