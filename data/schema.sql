CREATE TABLE users
(
  id             BIGSERIAL,
  public_id      UUID        NOT NULL DEFAULT gen_random_uuid(),
  email          VARCHAR(255),
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
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT    NOT NULL,
  description TEXT,
  price       INTEGER NOT NULL,
  prompt      TEXT    NULL,
  enabled     BOOLEAN NOT NULL         DEFAULT FALSE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prompts_name
  ON prompts (name);

CREATE INDEX idx_prompts_description
  ON prompts (description);

CREATE TABLE files
(
  id         BIGSERIAL PRIMARY KEY,
  ref_table  TEXT   NOT NULL,
  ref_id     BIGINT NOT NULL,
  file_type  TEXT   NOT NULL,
  position   INT    NOT NULL          DEFAULT 0,
  url        TEXT   NOT NULL,
  metadata   JSONB  NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_files_ref_table_ref_id
  ON files (ref_table, ref_id);

CREATE INDEX idx_files_file_type
  ON files (file_type);

CREATE TABLE kv_store
(
  id         BIGSERIAL PRIMARY KEY,
  json_key   VARCHAR(128) NOT NULL UNIQUE,
  json_value JSONB        NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
