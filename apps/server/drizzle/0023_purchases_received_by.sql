-- F35 gap: persistir usuario responsavel pelo recebimento da compra

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS received_by integer;

CREATE INDEX IF NOT EXISTS po_received_by_idx
  ON purchase_orders (received_by);
