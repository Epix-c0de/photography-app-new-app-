-- =============================================
-- IMMEDIATE FIX FOR 42P17 ERROR - RUN IN SUPABASE SQL EDITOR
-- =============================================

-- This SQL script fixes the recursive RLS policies causing the 42P17 error
-- Copy and paste this into your Supabase SQL editor to apply the fix

-- Step 1: Drop the problematic recursive policies (if they exist)
DROP POLICY IF EXISTS "Admins can manage gallery photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Super admins can manage all gallery photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Clients can view their photos" ON public.gallery_photos;

-- Step 2: Create simplified, non-recursive policies for gallery_photos
-- Policy 1: Gallery owners can manage their photos (non-recursive)
CREATE POLICY "Gallery owners can manage their photos"
  ON public.gallery_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = gallery_photos.gallery_id
      AND g.owner_admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = gallery_photos.gallery_id
      AND g.owner_admin_id = auth.uid()
    )
  );

-- Policy 2: Super admins can manage all photos (non-recursive)
CREATE POLICY "Super admins can manage all photos"
  ON public.gallery_photos FOR ALL
  USING (
    auth.uid() IN (
      SELECT up.id FROM public.user_profiles up
      WHERE up.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT up.id FROM public.user_profiles up
      WHERE up.role IN ('admin', 'super_admin')
    )
  );

-- Policy 3: Clients can view their photos (non-recursive)
CREATE POLICY "Clients can view their photos"
  ON public.gallery_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = gallery_photos.gallery_id
      AND g.client_id IN (
        SELECT c.id FROM public.clients c
        WHERE c.user_id = auth.uid()
      )
    )
  );

-- Step 3: Test the fix by trying to insert a test record
-- (This will be rolled back)
BEGIN;

-- Try a test insert to see if the 42P17 error is resolved
INSERT INTO public.gallery_photos (
  gallery_id, 
  photo_url, 
  file_name, 
  file_size, 
  mime_type, 
  upload_order
) VALUES (
  'test-gallery-id', 
  'test/path/photo.jpg', 
  'test-photo.jpg', 
  1024, 
  'image/jpeg', 
  0
);

-- If this succeeds, the fix worked! Rollback the test data
ROLLBACK;

-- If you get the 42P17 error again, there's still an issue
-- Let me know and I'll provide additional fixes

-- =============================================
-- FIX APPLIED - TEST YOUR UPLOAD SCREEN NOW
-- =============================================