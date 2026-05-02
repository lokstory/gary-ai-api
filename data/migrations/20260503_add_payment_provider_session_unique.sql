DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uk_payments_provider_session_id'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT uk_payments_provider_session_id
      UNIQUE (provider, provider_session_id);
  END IF;
END $$;
