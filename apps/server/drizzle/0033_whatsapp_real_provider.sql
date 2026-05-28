-- Fase 6: WhatsApp BSP real (staging blockers + base para produção)
-- Base: 7adf4f5

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.phone_e164 IS 'Numero E.164 sem +, ex: 5511999990000';
COMMENT ON COLUMN users.whatsapp_opt_in IS 'Consentimento LGPD para receber mensagens WhatsApp';

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_provider') THEN
    CREATE TYPE whatsapp_provider AS ENUM ('mock', 'blip', 'meta');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_template_status') THEN
    CREATE TYPE whatsapp_template_status AS ENUM ('pending', 'approved', 'rejected', 'disabled');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_opt_in_status') THEN
    CREATE TYPE whatsapp_opt_in_status AS ENUM ('pending', 'opted_in', 'opted_out');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_message_direction') THEN
    CREATE TYPE whatsapp_message_direction AS ENUM ('inbound', 'outbound');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_message_status') THEN
    CREATE TYPE whatsapp_message_status AS ENUM (
      'queued',
      'sent',
      'delivered',
      'read',
      'failed',
      'blocked',
      'received'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_name VARCHAR(120) NOT NULL,
  language VARCHAR(16) NOT NULL DEFAULT 'pt_BR',
  category VARCHAR(32) NOT NULL DEFAULT 'utility',
  status whatsapp_template_status NOT NULL DEFAULT 'pending',
  provider_template_id VARCHAR(191),
  rejected_reason TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_templates_tenant_name_language_uniq UNIQUE (tenant_id, template_name, language)
);

CREATE INDEX IF NOT EXISTS whatsapp_templates_tenant_status_idx
  ON whatsapp_templates (tenant_id, status);

CREATE TABLE IF NOT EXISTS whatsapp_opt_ins (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  phone_e164 TEXT NOT NULL,
  status whatsapp_opt_in_status NOT NULL DEFAULT 'pending',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  source VARCHAR(64) NOT NULL DEFAULT 'manual',
  keyword TEXT,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_opt_ins_tenant_phone_uniq UNIQUE (tenant_id, phone_e164)
);

CREATE INDEX IF NOT EXISTS whatsapp_opt_ins_tenant_status_idx
  ON whatsapp_opt_ins (tenant_id, status);

CREATE INDEX IF NOT EXISTS whatsapp_opt_ins_tenant_client_idx
  ON whatsapp_opt_ins (tenant_id, client_id);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  direction whatsapp_message_direction NOT NULL,
  status whatsapp_message_status NOT NULL DEFAULT 'queued',
  provider whatsapp_provider NOT NULL DEFAULT 'mock',
  provider_message_id VARCHAR(191),
  phone_e164 TEXT NOT NULL,
  template_name VARCHAR(120),
  body TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_rank INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_tenant_provider_msg_uniq
  ON whatsapp_messages (tenant_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_tenant_created_idx
  ON whatsapp_messages (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_messages_tenant_phone_idx
  ON whatsapp_messages (tenant_id, phone_e164, created_at DESC);
