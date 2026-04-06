-- F35: adiciona campos de rastreamento de origem em accounts_payable
-- Permite vincular lançamentos gerados automaticamente (ex: recebimento de OC)

ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS reference_id INTEGER,
  ADD COLUMN IF NOT EXISTS reference_type VARCHAR(64);

CREATE INDEX IF NOT EXISTS ap_reference_idx
  ON accounts_payable (reference_type, reference_id);
