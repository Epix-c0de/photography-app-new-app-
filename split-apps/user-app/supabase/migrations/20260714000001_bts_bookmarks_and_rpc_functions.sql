-- ============================================================
-- BTS Bookmarks Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bts_bookmarks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bts_id uuid NOT NULL REFERENCES public.bts_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(bts_id, user_id)
);

ALTER TABLE public.bts_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bookmarks"
  ON public.bts_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
  ON public.bts_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON public.bts_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- RPC: Increment views count on a table row
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_views(row_id uuid, table_name text)
RETURNS void AS $$
BEGIN
  IF table_name = 'bts_posts' THEN
    UPDATE public.bts_posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = row_id;
  ELSIF table_name = 'announcements' THEN
    UPDATE public.announcements SET views_count = COALESCE(views_count, 0) + 1 WHERE id = row_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Increment clicks count on a table row
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_clicks(row_id uuid, table_name text)
RETURNS void AS $$
BEGIN
  IF table_name = 'bts_posts' THEN
    UPDATE public.bts_posts SET clicks_count = COALESCE(clicks_count, 0) + 1 WHERE id = row_id;
  ELSIF table_name = 'announcements' THEN
    UPDATE public.announcements SET clicks_count = COALESCE(clicks_count, 0) + 1 WHERE id = row_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Add caption column if missing (from migration 20260217000002)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bts_posts' AND column_name = 'caption'
  ) THEN
    ALTER TABLE public.bts_posts ADD COLUMN caption text;
  END IF;
END $$;

-- ============================================================
-- Add video_thumbnail_url column if missing
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bts_posts' AND column_name = 'video_thumbnail_url'
  ) THEN
    ALTER TABLE public.bts_posts ADD COLUMN video_thumbnail_url text;
  END IF;
END $$;

-- ============================================================
-- Add views_count and clicks_count columns if missing
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bts_posts' AND column_name = 'views_count'
  ) THEN
    ALTER TABLE public.bts_posts ADD COLUMN views_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bts_posts' AND column_name = 'clicks_count'
  ) THEN
    ALTER TABLE public.bts_posts ADD COLUMN clicks_count integer DEFAULT 0;
  END IF;
END $$;
