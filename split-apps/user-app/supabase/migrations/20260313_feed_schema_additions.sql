-- ============================================================
-- Feed Architecture Schema Additions
-- Adds video_thumbnail_url, media_aspect_ratio, views_count,
-- shares_count to bts_posts and announcements, and
-- is_admin_reply + parent_comment_id to comment tables.
-- ============================================================

-- ── bts_posts additions ──────────────────────────────────────
ALTER TABLE public.bts_posts
  ADD COLUMN IF NOT EXISTS video_thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS media_aspect_ratio    FLOAT,
  ADD COLUMN IF NOT EXISTS views_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count          INTEGER NOT NULL DEFAULT 0;

-- ── announcements additions ──────────────────────────────────
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS video_thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS media_aspect_ratio    FLOAT,
  ADD COLUMN IF NOT EXISTS views_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count          INTEGER NOT NULL DEFAULT 0;

-- ── portfolio_items additions ────────────────────────────────
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS video_thumbnail_url   TEXT,
  ADD COLUMN IF NOT EXISTS media_aspect_ratio    FLOAT,
  ADD COLUMN IF NOT EXISTS views_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count          INTEGER NOT NULL DEFAULT 0;

-- ── bts_comments additions ───────────────────────────────────
ALTER TABLE public.bts_comments
  ADD COLUMN IF NOT EXISTS is_admin_reply        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_comment_id     UUID REFERENCES public.bts_comments(id) ON DELETE SET NULL;

-- ── announcement_comments additions ─────────────────────────
ALTER TABLE public.announcement_comments
  ADD COLUMN IF NOT EXISTS is_admin_reply        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_comment_id     UUID REFERENCES public.announcement_comments(id) ON DELETE SET NULL;

-- ── portfolio_comments additions (if table exists) ───────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'portfolio_comments') THEN
    ALTER TABLE public.portfolio_comments
      ADD COLUMN IF NOT EXISTS is_admin_reply    BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES public.portfolio_comments(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ── Helper RPC: increment_views ──────────────────────────────
-- Usage: SELECT increment_views('post-uuid', 'bts_posts')
CREATE OR REPLACE FUNCTION public.increment_views(row_id UUID, table_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.%I SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1',
    table_name
  ) USING row_id;
END;
$$;

-- ── Helper RPC: increment_clicks (alias for shares) ──────────
CREATE OR REPLACE FUNCTION public.increment_clicks(row_id UUID, table_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.%I SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = $1',
    table_name
  ) USING row_id;
END;
$$;

-- ── Grant execute rights ─────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.increment_views(UUID, TEXT)   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_clicks(UUID, TEXT)  TO authenticated, anon;

-- ── Done ─────────────────────────────────────────────────────
-- After running this migration, the generate_video_thumbnail
-- Edge Function should populate video_thumbnail_url in the
-- matching row after async processing, and media_aspect_ratio
-- should be set at upload time from the picker asset's
-- width/height: aspectRatio = asset.width / asset.height.
