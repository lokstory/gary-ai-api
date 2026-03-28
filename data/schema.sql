CREATE TABLE kv_store
(
  id         BIGSERIAL PRIMARY KEY,
  json_key   VARCHAR(128) NOT NULL UNIQUE,
  json_value JSONB        NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users
(
  id             BIGSERIAL,
  public_id      UUID        NOT NULL DEFAULT gen_random_uuid(),
  email          VARCHAR(255),
  name           VARCHAR(64),
  password_hash  TEXT,
  google_id      VARCHAR(512),
  google_email   VARCHAR(255),
  email_verified BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_users
    PRIMARY KEY (id),
  CONSTRAINT uk_users_public_id
    UNIQUE (public_id),
  CONSTRAINT uk_users_email
    UNIQUE (email),
  CONSTRAINT uk_users_google_id
    UNIQUE (google_id),
  CONSTRAINT users_login_method_check
    CHECK (email IS NOT NULL OR google_id IS NOT NULL)
--   CONSTRAINT users_password_required_check
--     CHECK (
--       email IS NULL
--         OR password_hash IS NOT NULL
--       )
);

CREATE INDEX idx_users_created_at
  ON users (created_at);


CREATE TABLE prompts
(
  id           BIGSERIAL PRIMARY KEY,
  public_id  UUID         NOT NULL    DEFAULT gen_random_uuid() UNIQUE,
  name         TEXT    NOT NULL,
  description  TEXT,
  price        INTEGER NOT NULL,
  bonus_credit INTEGER NOT NULL         DEFAULT 0,
  enabled      BOOLEAN NOT NULL         DEFAULT FALSE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prompts_name
  ON prompts (name);

CREATE INDEX idx_prompts_description
  ON prompts (description);

CREATE TABLE files
(
  id         BIGSERIAL PRIMARY KEY,
  public_id  UUID         NOT NULL    DEFAULT gen_random_uuid() UNIQUE,
  ref_table  TEXT         NOT NULL,
  ref_id     BIGINT       NOT NULL,
  file_type  TEXT         NOT NULL,
  position   INT          NOT NULL    DEFAULT 0,
  bucket     VARCHAR(128) NULL,
  url        TEXT         NOT NULL,
  metadata   JSONB        NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_files_ref_table_ref_id
  ON files (ref_table, ref_id);

CREATE INDEX idx_files_file_type
  ON files (file_type);

CREATE TABLE user_prompt_favorites
(
  user_id    BIGINT                    NOT NULL,
  prompt_id  BIGINT                    NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, prompt_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_user_prompt_favorites_updated_at
  ON user_prompt_favorites (user_id, updated_at DESC);


CREATE TABLE cart_items
(
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  item_type  VARCHAR(50) NOT NULL,
  item_id    BIGINT      NOT NULL,
  quantity   INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_cart_user_id_item_type_item_id UNIQUE (user_id, item_type, item_id)
);

CREATE TABLE orders
(
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  status     VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  amount     INTEGER     NOT NULL CHECK (amount >= 0),
  currency   VARCHAR(10) NOT NULL DEFAULT 'TWD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);


CREATE TABLE order_items
(
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT      NOT NULL REFERENCES orders (id) ON UPDATE CASCADE ON DELETE CASCADE,
  item_type  VARCHAR(50) NOT NULL,
  item_id    BIGINT      NOT NULL,
  quantity   INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price INTEGER     NOT NULL CHECK (unit_price >= 0),
  amount     INTEGER     NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);


CREATE TABLE payments
(
  id                  BIGSERIAL PRIMARY KEY,
  order_id            BIGINT       NOT NULL REFERENCES orders (id) ON UPDATE CASCADE ON DELETE CASCADE,
  provider            VARCHAR(50)  NOT NULL,
  status              VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
  provider_payment_id VARCHAR(512) NOT NULL,
  provider_session_id VARCHAR(512),
  checkout_url        TEXT,
  raw_payload         JSONB,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uk_payments_provider_payment_id
    UNIQUE (provider, provider_payment_id)
);

CREATE INDEX idx_payments_order_id ON payments (order_id);
CREATE INDEX idx_payments_provider_status ON payments (provider, status);