CREATE TABLE ai_video_models
(
  id         BIGSERIAL PRIMARY KEY,
  uuid       UUID         NOT NULL DEFAULT gen_random_uuid(),
  provider   VARCHAR(50)  NOT NULL,
  model      VARCHAR(128) NOT NULL,
  name       VARCHAR(255) NOT NULL,
  enabled    BOOLEAN      NOT NULL DEFAULT TRUE,
  position   INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uk_ai_video_models_uuid
    UNIQUE (uuid),
  CONSTRAINT uk_ai_video_models_provider_model
    UNIQUE (provider, model)
);

CREATE INDEX idx_ai_video_models_enabled_position
  ON ai_video_models (enabled, position, id);

CREATE INDEX idx_ai_video_models_provider_enabled_position
  ON ai_video_models (provider, enabled, position, id);

CREATE TABLE ai_video_model_translations
(
  id             BIGSERIAL PRIMARY KEY,
  video_model_id BIGINT      NOT NULL REFERENCES ai_video_models (id) ON UPDATE CASCADE ON DELETE CASCADE,
  locale         VARCHAR(16) NOT NULL,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uk_ai_video_model_translations_model_locale
    UNIQUE (video_model_id, locale)
);

CREATE INDEX idx_ai_video_model_translations_locale
  ON ai_video_model_translations (locale);

INSERT INTO ai_video_models (provider, model, name, position)
VALUES
  ('KLING', 'kling-v1', 'Kling v1', 0),
  ('KLING', 'kling-v1-5', 'Kling v1.5', 1),
  ('KLING', 'kling-v1-6', 'Kling v1.6', 2),
  ('KLING', 'kling-v2-master', 'Kling v2 Master', 3),
  ('KLING', 'kling-v2-1', 'Kling v2.1', 4),
  ('KLING', 'kling-v2-1-master', 'Kling v2.1 Master', 5),
  ('KLING', 'kling-v2-5-turbo', 'Kling v2.5 Turbo', 6),
  ('KLING', 'kling-v2-6', 'Kling v2.6', 7),
  ('KLING', 'kling-v3', 'Kling v3', 8),
  ('KLING', 'kling-video-o1', 'Kling Video O1', 9),
  ('KLING', 'kling-v3-omni', 'Kling v3 Omni', 10)
ON CONFLICT (provider, model) DO UPDATE
  SET name = EXCLUDED.name,
      position = EXCLUDED.position,
      updated_at = NOW();
