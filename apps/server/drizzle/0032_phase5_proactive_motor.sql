-- Log de alertas enviados (dedup + auditoria)
CREATE TABLE alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  alert_type TEXT NOT NULL,                    -- 'deadline_24h' | 'deadline_overdue' | 'stock_low' | 'payment_overdue' | 'briefing_daily'
  entity_type TEXT,                            -- 'job' | 'stock_item' | 'account_receivable'
  entity_id INT,                               -- FK logica (nao enforced)
  dedup_key TEXT NOT NULL,                     -- hash(tenant_id + alert_type + entity_id + window)
  channel TEXT NOT NULL,                       -- 'push' | 'email' | 'whatsapp' | 'in_app'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);

CREATE UNIQUE INDEX alert_log_dedup_uniq ON alert_log(tenant_id, dedup_key);
CREATE INDEX alert_log_tenant_type_idx ON alert_log(tenant_id, alert_type, sent_at DESC);

-- Preferencias do usuario (quiet mode, canais, horario)
CREATE TABLE user_preferences (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  briefing_enabled BOOLEAN DEFAULT TRUE,
  briefing_time TIME DEFAULT '08:00',
  quiet_hours_start TIME DEFAULT '20:00',
  quiet_hours_end TIME DEFAULT '07:00',
  channels JSONB DEFAULT '{"push":true,"email":true,"whatsapp":false,"in_app":true}',
  alert_types_muted TEXT[] DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
