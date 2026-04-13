ALTER TABLE public.prompts
ADD COLUMN featured_rank INTEGER NOT NULL DEFAULT -1;

COMMENT ON COLUMN public.prompts.featured_rank IS '-1 means not featured; 0 or greater means featured rank';

CREATE INDEX idx_prompts_featured_rank
  ON public.prompts (featured_rank);

CREATE INDEX idx_prompts_enabled_featured_rank_created_at
  ON public.prompts (enabled, featured_rank, created_at DESC);
