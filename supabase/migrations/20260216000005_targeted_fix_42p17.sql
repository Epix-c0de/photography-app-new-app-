-- =============================================
-- TARGETED FIX FOR 42P17 ERROR - GALLERY_PHOTOS ONLY
-- =============================================

-- This migration specifically fixes the 42P17 error for gallery_photos table
-- without touching other tables or policies that already exist

-- Step 1: Only drop gallery_photos policies (if they exist)
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

-- Step 3: Fix storage policies ONLY for client-photos bucket
DROP POLICY IF EXISTS "Admins can upload client photos" ON storage.objects;
DROP POLICY IF EXISTS "Clients can view their photos" ON storage.objects;

-- Non-recursive storage upload policy
CREATE POLICY "Admins can upload client photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = 'clients'
    AND auth.uid() IN (
      SELECT up.id FROM public.user_profiles up
      WHERE up.role IN ('admin', 'super_admin')
    )
  );

-- Non-recursive storage view policy
CREATE POLICY "Clients can view their photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-photos'
    AND EXISTS (
      SELECT 1 FROM public.gallery_photos gp
      JOIN public.galleries g ON gp.gallery_id = g.id
      JOIN public.clients c ON g.client_id = c.id
      WHERE c.user_id = auth.uid()
      AND gp.photo_url LIKE '%' || storage.objects.name
    )
  );

-- =============================================
-- MIGRATION COMPLETE - TARGETED FIX APPLIED
-- =============================================