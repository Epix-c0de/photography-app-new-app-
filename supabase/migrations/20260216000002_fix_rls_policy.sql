-- =============================================
-- FIX RLS POLICY FOR GALLERY_PHOTOS TO RESOLVE 42P17 ERROR
-- =============================================

-- Fix the RLS policy for gallery_photos table to resolve the 42P17 "invalid object definition" error
-- The issue is likely with the complex JWT role checking syntax

-- First, drop the existing problematic policy
DROP POLICY IF EXISTS "Admins can manage gallery photos" ON public.gallery_photos;

-- Create a simpler, more robust policy that avoids JWT function complexity
CREATE POLICY "Admins can manage gallery photos"
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

-- Create a separate policy for admin/super_admin roles using user_profiles table
DROP POLICY IF EXISTS "Super admins can manage all gallery photos" ON public.gallery_photos;

CREATE POLICY "Super admins can manage all gallery photos"
  ON public.gallery_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'super_admin')
    )
  );

-- Fix the storage policy as well to avoid JWT complexity
DROP POLICY IF EXISTS "Admins can upload client photos" ON storage.objects;

CREATE POLICY "Admins can upload client photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = 'clients'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'super_admin')
    )
  );

-- Fix the client viewing policy for storage
DROP POLICY IF EXISTS "Clients can view their photos" ON storage.objects;

CREATE POLICY "Clients can view their photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-photos'
    AND EXISTS (
      SELECT 1 FROM public.gallery_photos gp
      JOIN public.galleries g ON gp.gallery_id = g.id
      JOIN public.clients c ON g.client_id = c.id
      WHERE gp.photo_url LIKE '%' || storage.objects.name
      AND c.user_id = auth.uid()
    )
  );

-- =============================================
-- MIGRATION COMPLETE
-- =============================================