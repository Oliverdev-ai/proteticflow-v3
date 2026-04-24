-- Fase 6: WhatsApp BSP real — adicionar phone_verified e whatsapp_opt_in
-- Base: 7adf4f5

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.phone_e164 IS 'Numero E.164 sem +, ex: 5511999990000';
COMMENT ON COLUMN users.whatsapp_opt_in IS 'Consentimento LGPD para receber mensagens WhatsApp';
