-- Add premium features columns to bts_posts
ALTER TABLE bts_posts 
ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS music_url text,
ADD COLUMN IF NOT EXISTS views_count bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks_count bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_audience text[];

-- Add premium features columns to announcements
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS views_count bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks_count bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_audience text[];

-- Add client_type to user_profiles for targeted announcements
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS client_type text;

-- Create a function to increment views safely
CREATE OR REPLACE FUNCTION increment_views(row_id uuid, table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF table_name = 'bts_posts' THEN
    UPDATE bts_posts SET views_count = views_count + 1 WHERE id = row_id;
  ELSIF table_name = 'announcements' THEN
    UPDATE announcements SET views_count = views_count + 1 WHERE id = row_id;
  END IF;
END;
$$;

-- Create a function to increment clicks safely
CREATE OR REPLACE FUNCTION increment_clicks(row_id uuid, table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF table_name = 'bts_posts' THEN
    UPDATE bts_posts SET clicks_count = clicks_count + 1 WHERE id = row_id;
  ELSIF table_name = 'announcements' THEN
    UPDATE announcements SET clicks_count = clicks_count + 1 WHERE id = row_id;
  END IF;
END;
$$;
