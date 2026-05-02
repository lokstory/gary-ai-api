CREATE TABLE generation_requests
(
  id              BIGSERIAL PRIMARY KEY,
  uuid            UUID         NOT NULL DEFAULT gen_random_uuid(),
  user_id         BIGINT       NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,
  provider        VARCHAR(50)  NOT NULL,
  media_type      VARCHAR(16)  NOT NULL,
  request_type    VARCHAR(64)  NOT NULL,
  status          VARCHAR(64)  NOT NULL DEFAULT 'PENDING',
  prompt          TEXT,
  negative_prompt TEXT,
  input_payload   JSONB,
  output_payload  JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uk_generation_requests_uuid
    UNIQUE (uuid)
);

CREATE INDEX idx_generation_requests_user_created_at
  ON generation_requests (user_id, created_at DESC);

CREATE INDEX idx_generation_requests_provider_status_created_at
  ON generation_requests (provider, status, created_at DESC);

CREATE TABLE kling_tasks
(
  id                    BIGSERIAL PRIMARY KEY,
  generation_request_id BIGINT       NOT NULL REFERENCES generation_requests (id) ON UPDATE CASCADE ON DELETE CASCADE,
  attempt_no            INTEGER      NOT NULL DEFAULT 1,
  task_id               VARCHAR(255),
  external_task_id      VARCHAR(255),
  task_type             VARCHAR(64)  NOT NULL,
  model                 VARCHAR(128),
  status                VARCHAR(64)  NOT NULL,
  request_payload       JSONB,
  submit_response       JSONB,
  result_payload        JSONB,
  error_message         TEXT,
  submitted_at          TIMESTAMPTZ,
  last_callback_at      TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uk_kling_tasks_task_id
    UNIQUE (task_id),
  CONSTRAINT uk_kling_tasks_generation_request_attempt_no
    UNIQUE (generation_request_id, attempt_no)
);

CREATE INDEX idx_kling_tasks_generation_request_id
  ON kling_tasks (generation_request_id);

CREATE INDEX idx_kling_tasks_task_type_status
  ON kling_tasks (task_type, status);

CREATE INDEX idx_kling_tasks_external_task_id
  ON kling_tasks (external_task_id);

CREATE INDEX idx_kling_tasks_created_at
  ON kling_tasks (created_at);

CREATE TABLE kling_task_callbacks
(
  id            BIGSERIAL PRIMARY KEY,
  kling_task_id BIGINT      NOT NULL REFERENCES kling_tasks (id) ON UPDATE CASCADE ON DELETE CASCADE,
  status        VARCHAR(64),
  headers       JSONB,
  payload       JSONB       NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kling_task_callbacks_task_created_at
  ON kling_task_callbacks (kling_task_id, created_at);
