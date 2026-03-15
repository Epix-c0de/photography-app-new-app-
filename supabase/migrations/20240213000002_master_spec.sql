-- Migration for MASTER SPEC: BTS & Announcements

-- 0. Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public.bts_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text,
    media_url text NOT NULL,
    media_type text CHECK (media_type IN ('image', 'video')) NOT NULL,
    category text,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    is_active boolean DEFAULT true,
    shoot_type text,
    created_by uuid REFERENCES auth.users(id),
    likes_count int DEFAULT 0,
    comments_count int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    image_url text,
    tag text,
    cta text,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    is_active boolean DEFAULT true,
    content_html text,
    media_url text,
    media_type text CHECK (media_type IN ('image', 'video')),
    category text,
    created_by uuid REFERENCES auth.users(id),
    comments_count int DEFAULT 0
);

-- 1. Update bts_posts table (Safety check in case table existed but missing columns)
ALTER TABLE public.bts_posts 
ADD COLUMN IF NOT EXISTS shoot_type text,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS likes_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments_count int DEFAULT 0;

-- 2. Update announcements table (Safety check)
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS content_html text,
ADD COLUMN IF NOT EXISTS media_url text, -- to support video
ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'video')),
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS comments_count int DEFAULT 0;

-- 3. Create bts_comments table
CREATE TABLE IF NOT EXISTS public.bts_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bts_id uuid REFERENCES public.bts_posts(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    comment text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 4. Create announcement_comments table
CREATE TABLE IF NOT EXISTS public.announcement_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    comment text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 5. Create bts_likes table (to track unique likes)
CREATE TABLE IF NOT EXISTS public.bts_likes (
    user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    bts_id uuid REFERENCES public.bts_posts(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, bts_id)
);

-- 6. Enable RLS
ALTER TABLE public.bts_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bts_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bts_likes ENABLE ROW LEVEL SECURITY;

-- 7. Policies
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read bts_posts" ON public.bts_posts;
DROP POLICY IF EXISTS "Public read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Public read bts_comments" ON public.bts_comments;
DROP POLICY IF EXISTS "Public read announcement_comments" ON public.announcement_comments;
DROP POLICY IF EXISTS "Public read bts_likes" ON public.bts_likes;
DROP POLICY IF EXISTS "Authenticated insert bts_comments" ON public.bts_comments;
DROP POLICY IF EXISTS "Authenticated insert announcement_comments" ON public.announcement_comments;
DROP POLICY IF EXISTS "Authenticated insert bts_likes" ON public.bts_likes;
DROP POLICY IF EXISTS "User delete own bts_comments" ON public.bts_comments;
DROP POLICY IF EXISTS "User delete own announcement_comments" ON public.announcement_comments;
DROP POLICY IF EXISTS "User delete own bts_likes" ON public.bts_likes;
DROP POLICY IF EXISTS "Admins manage bts_posts" ON public.bts_posts;
DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;

-- Allow read access to everyone
CREATE POLICY "Public read bts_posts" ON public.bts_posts FOR SELECT USING (true);
CREATE POLICY "Public read announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Public read bts_comments" ON public.bts_comments FOR SELECT USING (true);
CREATE POLICY "Public read announcement_comments" ON public.announcement_comments FOR SELECT USING (true);
CREATE POLICY "Public read bts_likes" ON public.bts_likes FOR SELECT USING (true);

-- Allow authenticated users to insert comments/likes
CREATE POLICY "Authenticated insert bts_comments" ON public.bts_comments FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Authenticated insert announcement_comments" ON public.announcement_comments FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Authenticated insert bts_likes" ON public.bts_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own comments/likes
CREATE POLICY "User delete own bts_comments" ON public.bts_comments FOR DELETE USING (auth.uid() = client_id);
CREATE POLICY "User delete own announcement_comments" ON public.announcement_comments FOR DELETE USING (auth.uid() = client_id);
CREATE POLICY "User delete own bts_likes" ON public.bts_likes FOR DELETE USING (auth.uid() = user_id);

-- Allow admins to manage posts (assuming admin check via public.user_profiles or similar logic)
CREATE POLICY "Admins manage bts_posts" ON public.bts_posts USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins manage announcements" ON public.announcements USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 8. Functions to handle like counters
CREATE OR REPLACE FUNCTION handle_new_bts_like()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.bts_posts
  SET likes_count = likes_count + 1
  WHERE id = NEW.bts_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bts_like ON public.bts_likes;
CREATE TRIGGER on_bts_like
  AFTER INSERT ON public.bts_likes
  FOR EACH ROW EXECUTE PROCEDURE handle_new_bts_like();

CREATE OR REPLACE FUNCTION handle_remove_bts_like()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.bts_posts
  SET likes_count = likes_count - 1
  WHERE id = OLD.bts_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bts_unlike ON public.bts_likes;
CREATE TRIGGER on_bts_unlike
  AFTER DELETE ON public.bts_likes
  FOR EACH ROW EXECUTE PROCEDURE handle_remove_bts_like();

-- 9. Functions to handle comment counters
CREATE OR REPLACE FUNCTION handle_new_bts_comment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.bts_posts
  SET comments_count = comments_count + 1
  WHERE id = NEW.bts_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bts_comment ON public.bts_comments;
CREATE TRIGGER on_bts_comment
  AFTER INSERT ON public.bts_comments
  FOR EACH ROW EXECUTE PROCEDURE handle_new_bts_comment();

CREATE OR REPLACE FUNCTION handle_new_announcement_comment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.announcements
  SET comments_count = comments_count + 1
  WHERE id = NEW.announcement_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_announcement_comment ON public.announcement_comments;
CREATE TRIGGER on_announcement_comment
  AFTER INSERT ON public.announcement_comments
  FOR EACH ROW EXECUTE PROCEDURE handle_new_announcement_comment();
