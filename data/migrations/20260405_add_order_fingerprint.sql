ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_orders_user_id_status_fingerprint
  ON orders (user_id, status, fingerprint);
