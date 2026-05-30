-- Feed Architecture Schema Additions

-- bts_posts additions
ALTER TABLE public.bts_posts
  ADD COLUMN IF NOT EXISTS video_thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS media_aspect_ratio    FLOAT,
  ADD COLUMN IF NOT EXISTS views_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count          INTEGER NOT NULL DEFAULT 0;

-- announcements additions
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS video_thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS media_aspect_ratio    FLOAT,
  ADD COLUMN IF NOT EXISTS views_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count          INTEGER NOT NULL DEFAULT 0;

-- portfolio_items additions
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS video_thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS media_aspect_ratio    FLOAT,
  ADD COLUMN IF NOT EXISTS views_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count          INTEGER NOT NULL DEFAULT 0;

-- bts_comments additions
ALTER TABLE public.bts_comments
  ADD COLUMN IF NOT EXISTS is_admin_reply        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_comment_id     UUID REFERENCES public.bts_comments(id) ON DELETE SET NULL;

-- announcement_comments additions
ALTER TABLE public.announcement_comments
  ADD COLUMN IF NOT EXISTS is_admin_reply        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_comment_id     UUID REFERENCES public.announcement_comments(id) ON DELETE SET NULL;

-- Helper RPC: increment_views
CREATE OR REPLACE FUNCTION public.increment_views(row_id UUID, table_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.%I SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1',
    table_name
  ) USING row_id;
END;
$$;

-- Helper RPC: increment_clicks
CREATE OR REPLACE FUNCTION public.increment_clicks(row_id UUID, table_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.%I SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = $1',
    table_name
  ) USING row_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_views(UUID, TEXT)  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_clicks(UUID, TEXT) TO authenticated, anon;
