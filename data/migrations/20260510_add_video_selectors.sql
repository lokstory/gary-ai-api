BEGIN;

CREATE TABLE video_selectors
(
  id            BIGSERIAL PRIMARY KEY,
  uuid          UUID         NOT NULL DEFAULT gen_random_uuid(),
  selector_type VARCHAR(32)  NOT NULL,
  code          VARCHAR(128) NOT NULL,
  prompt        TEXT         NOT NULL,
  enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
  position      INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uk_video_selectors_uuid
    UNIQUE (uuid),
  CONSTRAINT uk_video_selectors_type_code
    UNIQUE (selector_type, code)
);

CREATE INDEX idx_video_selectors_type_enabled_position
  ON video_selectors (selector_type, enabled, position, id);

CREATE INDEX idx_video_selectors_enabled
  ON video_selectors (enabled);

CREATE TABLE video_selector_translations
(
  id                BIGSERIAL PRIMARY KEY,
  video_selector_id BIGINT       NOT NULL,
  locale            VARCHAR(16)  NOT NULL,
  name              VARCHAR(255) NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_video_selector_translations_selector_id
    FOREIGN KEY (video_selector_id) REFERENCES video_selectors (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT uk_video_selector_translations_selector_locale
    UNIQUE (video_selector_id, locale)
);

CREATE INDEX idx_video_selector_translations_locale
  ON video_selector_translations (locale);

CREATE INDEX idx_video_selector_translations_selector_id
  ON video_selector_translations (video_selector_id);

CREATE TABLE video_selector_types
(
  id                   BIGSERIAL PRIMARY KEY,
  selector_type        VARCHAR(32) NOT NULL,
  has_global_thumbnail BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uk_video_selector_types_type
    UNIQUE (selector_type)
);

COMMENT ON COLUMN video_selector_types.has_global_thumbnail IS
  'Whether this selector type uses one shared thumbnail for all selectors.';

INSERT INTO video_selector_types (selector_type, has_global_thumbnail)
VALUES ('STYLE', FALSE),
       ('MOVEMENT', TRUE),
       ('MOTION', TRUE)
ON CONFLICT (selector_type) DO NOTHING;

COMMIT;
