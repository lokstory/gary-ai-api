ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS display_id VARCHAR(32);

UPDATE orders
SET display_id = 'ORD-' || TO_CHAR(created_at AT TIME ZONE 'Asia/Taipei', 'YYMMDD') || '-' ||
  UPPER(SUBSTRING(MD5(id::text || '-' || uuid::text) FROM 1 FOR 6))
WHERE display_id IS NULL;

ALTER TABLE orders
  ALTER COLUMN display_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uk_orders_display_id'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT uk_orders_display_id
      UNIQUE (display_id);
  END IF;
END $$;
