-- Fix gallery_views RLS: allow admins to view all views for their galleries
-- and allow the view tracking function to work

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their gallery views" ON public.gallery_views;
DROP POLICY IF EXISTS "Users can insert gallery views" ON public.gallery_views;

-- Users can view their own views
CREATE POLICY "Users can view their gallery views"
  ON public.gallery_views FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all views for their galleries
CREATE POLICY "Admins can view all gallery views"
  ON public.gallery_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM galleries
      WHERE galleries.id = gallery_views.gallery_id
      AND galleries.owner_admin_id = auth.uid()
    )
  );

-- Users can insert their own views
CREATE POLICY "Users can insert gallery views"
  ON public.gallery_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to insert views (for the tracking function)
CREATE POLICY "Authenticated users can insert gallery views"
  ON public.gallery_views FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
