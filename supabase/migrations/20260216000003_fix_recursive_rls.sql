-- =============================================
-- FIX RECURSIVE RLS POLICIES CAUSING 42P17 ERROR
-- =============================================

-- The 42P17 error is caused by recursive RLS policies that query the same table
-- during INSERT operations. This migration fixes the recursion issue.

-- Step 1: Drop the problematic recursive policies
DROP POLICY IF EXISTS "Admins can manage gallery photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Super admins can manage all gallery photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Gallery owners can manage their photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Super admins can manage all photos" ON public.gallery_photos;

-- Step 2: Create non-recursive policies that avoid querying the same table during INSERT
-- Policy 1: Gallery owners can manage their own gallery photos (non-recursive)
CREATE POLICY "Gallery owners can manage their photos"
  ON public.gallery_photos FOR ALL
  USING (
    -- For SELECT/UPDATE/DELETE: check if user owns the gallery
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = gallery_photos.gallery_id
      AND g.owner_admin_id = auth.uid()
    )
  )
  WITH CHECK (
    -- For INSERT/UPDATE: check if user owns the gallery (same logic, but called differently)
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = gallery_photos.gallery_id
      AND g.owner_admin_id = auth.uid()
    )
  );

-- Policy 2: Super admins can manage all gallery photos (non-recursive)
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

-- Step 3: Fix storage policies to avoid recursion
DROP POLICY IF EXISTS "Admins can upload client photos" ON storage.objects;
DROP POLICY IF EXISTS "Clients can view their photos" ON storage.objects;

-- Non-recursive storage upload policy
CREATE POLICY "Admins can upload client photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] IN ('clients', 'galleries')
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

-- Step 4: Add a diagnostic policy to help debug if issues persist
-- This policy allows any authenticated user to insert (for testing only)
-- Comment this out after confirming the fix works
-- CREATE POLICY "Debug: Allow all authenticated users" ON public.gallery_photos FOR INSERT
--   WITH CHECK (auth.role() = 'authenticated');

-- =============================================
-- MIGRATION COMPLETE - RECURSION FIXED
-- =============================================
