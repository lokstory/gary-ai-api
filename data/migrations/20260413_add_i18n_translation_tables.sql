BEGIN;

CREATE TABLE public.prompt_translations
(
  id          BIGSERIAL PRIMARY KEY,
  prompt_id   BIGINT      NOT NULL,
  locale      VARCHAR(16) NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_prompt_translations_prompt_id
    FOREIGN KEY (prompt_id) REFERENCES public.prompts (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT uk_prompt_translations_prompt_id_locale
    UNIQUE (prompt_id, locale)
);

CREATE INDEX idx_prompt_translations_locale
  ON public.prompt_translations (locale);

CREATE INDEX idx_prompt_translations_prompt_id
  ON public.prompt_translations (prompt_id);

CREATE TABLE public.category_translations
(
  id          BIGSERIAL PRIMARY KEY,
  category_id INT          NOT NULL,
  locale      VARCHAR(16)  NOT NULL,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_category_translations_category_id
    FOREIGN KEY (category_id) REFERENCES public.categories (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT uk_category_translations_category_id_locale
    UNIQUE (category_id, locale)
);

CREATE INDEX idx_category_translations_locale
  ON public.category_translations (locale);

CREATE INDEX idx_category_translations_category_id
  ON public.category_translations (category_id);

CREATE TABLE public.label_translations
(
  id          BIGSERIAL PRIMARY KEY,
  label_id    INT          NOT NULL,
  locale      VARCHAR(16)  NOT NULL,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_label_translations_label_id
    FOREIGN KEY (label_id) REFERENCES public.labels (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT uk_label_translations_label_id_locale
    UNIQUE (label_id, locale)
);

CREATE INDEX idx_label_translations_locale
  ON public.label_translations (locale);

CREATE INDEX idx_label_translations_label_id
  ON public.label_translations (label_id);

INSERT INTO public.prompt_translations (prompt_id, locale, name, description)
SELECT id, 'en', name, description
FROM public.prompts;

INSERT INTO public.category_translations (category_id, locale, name)
SELECT id, 'en', name
FROM public.categories;

INSERT INTO public.label_translations (label_id, locale, name)
SELECT id, 'en', name
FROM public.labels;

ALTER TABLE public.prompts
  DROP COLUMN name,
  DROP COLUMN description;

ALTER TABLE public.categories
  DROP CONSTRAINT uk_categories_name,
  DROP COLUMN name;

ALTER TABLE public.labels
  DROP CONSTRAINT uk_labels_name,
  DROP COLUMN name;

COMMIT;
