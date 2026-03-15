-- Migration: Fix Upload Issues and RLS Policies
-- Date: 2026-03-11
-- Purpose: Fix schema mismatches and ensure proper RLS policies for BTS, Announcements, and Portfolio uploads

-- 1. Ensure BTS Posts has proper RLS policies (already applied, but verify INSERT permission)
ALTER TABLE public.bts_posts ENABLE ROW LEVEL SECURITY;

-- Drop existing BTS policies if they're too restrictive
DROP POLICY IF EXISTS "Admins manage bts_posts" ON public.bts_posts;
DROP POLICY IF EXISTS "Public read bts_posts" ON public.bts_posts;

-- Create new policies for BTS Posts
-- Allow public read (users can view BTS posts)
CREATE POLICY "BTS posts public read" ON public.bts_posts 
  FOR SELECT USING (true);

-- Allow admins to insert BTS posts (created_by should match their user_id)
CREATE POLICY "Admins can insert bts_posts" ON public.bts_posts 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
    AND created_by = auth.uid()
  );

-- Allow admins to update/delete their own BTS posts
CREATE POLICY "Admins can update bts_posts" ON public.bts_posts 
  FOR UPDATE USING (created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
  WITH CHECK (created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Admins can delete bts_posts" ON public.bts_posts 
  FOR DELETE USING (created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 2. Ensure Announcements has proper RLS policies
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they're too restrictive
DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Public read announcements" ON public.announcements;

-- Create new policies for Announcements
-- Allow public read
CREATE POLICY "Announcements public read" ON public.announcements 
  FOR SELECT USING (true);

-- Allow admins to insert announcements
CREATE POLICY "Admins can insert announcements" ON public.announcements 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
    AND created_by = auth.uid()
  );

-- Allow admins to update/delete their own announcements
CREATE POLICY "Admins can update announcements" ON public.announcements 
  FOR UPDATE USING (created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
  WITH CHECK (created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Admins can delete announcements" ON public.announcements 
  FOR DELETE USING (created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 3. Fix Portfolio Items RLS policies
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage their portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Clients can view public portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Public read portfolio_items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins manage portfolio_items" ON public.portfolio_items;

-- Create new policies for Portfolio Items
-- Allow public read of active items
CREATE POLICY "Portfolio items public read" ON public.portfolio_items 
  FOR SELECT USING (is_active = true);

-- Allow admins to insert portfolio items
CREATE POLICY "Admins can insert portfolio items" ON public.portfolio_items 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
    AND created_by = auth.uid()
  );

-- Allow admins to update their own items
CREATE POLICY "Admins can update portfolio items" ON public.portfolio_items 
  FOR UPDATE USING (created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
  WITH CHECK (created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Allow admins to delete their own items
CREATE POLICY "Admins can delete portfolio items" ON public.portfolio_items 
  FOR DELETE USING (created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 4. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_bts_posts_created_by ON public.bts_posts(created_by);
CREATE INDEX IF NOT EXISTS idx_bts_posts_is_active ON public.bts_posts(is_active);
CREATE INDEX IF NOT EXISTS idx_bts_posts_created_at ON public.bts_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_items_owner ON public.portfolio_items(created_by);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_is_active ON public.portfolio_items(is_active);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_created_at ON public.portfolio_items(created_at DESC);

-- 5. Verify media storage bucket exists and has public access
-- Note: This requires manual verification in Supabase Dashboard:
-- - Go to Storage > Buckets
-- - Ensure "media" bucket exists
-- - Set to PUBLIC access (not private)
-- - Verify RLS policies on storage.objects allow admin uploads

