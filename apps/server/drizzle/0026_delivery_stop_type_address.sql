DO $$
BEGIN
  CREATE TYPE delivery_stop_type AS ENUM ('delivery', 'pickup');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE delivery_items
  ADD COLUMN IF NOT EXISTS stop_type delivery_stop_type NOT NULL DEFAULT 'delivery';

ALTER TABLE delivery_items
  ALTER COLUMN job_id DROP NOT NULL;

ALTER TABLE delivery_items
  ADD COLUMN IF NOT EXISTS delivery_address text;

UPDATE delivery_items di
SET delivery_address = NULLIF(
  concat_ws(', ', c.street, c.address_number, c.neighborhood, c.city, c.state),
  ''
)
FROM clients c
WHERE di.client_id = c.id
  AND (di.delivery_address IS NULL OR di.delivery_address = '');

CREATE INDEX IF NOT EXISTS di_stop_type_idx ON delivery_items (stop_type);
