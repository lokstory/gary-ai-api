CREATE TABLE IF NOT EXISTS categories
(
  id         SERIAL,
  code       VARCHAR(100)  NOT NULL,
  name       VARCHAR(255)  NOT NULL,
  enabled    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_categories
    PRIMARY KEY (id),
  CONSTRAINT uk_categories_code
    UNIQUE (code),
  CONSTRAINT uk_categories_name
    UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_categories_enabled
  ON categories (enabled);

CREATE INDEX IF NOT EXISTS idx_categories_created_at
  ON categories (created_at);

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(16),
  ADD COLUMN IF NOT EXISTS category_id INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_prompts_category_id'
  ) THEN
    ALTER TABLE prompts
      ADD CONSTRAINT fk_prompts_category_id
        FOREIGN KEY (category_id) REFERENCES categories (id)
          ON UPDATE CASCADE
          ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prompts_category_id
  ON prompts (category_id);

CREATE INDEX IF NOT EXISTS idx_prompts_media_type
  ON prompts (media_type);
