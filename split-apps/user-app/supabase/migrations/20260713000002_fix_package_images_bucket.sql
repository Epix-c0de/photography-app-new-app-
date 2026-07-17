-- Migration: Fix package-images bucket and media bucket policies
-- Date: 2026-07-13
-- Purpose: Create package-images bucket and allow package uploads via media bucket fallback

-- 1. Create package-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('package-images', 'package-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop and recreate package-images policies
DROP POLICY IF EXISTS "Admins can upload package images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update package images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete package images" ON storage.objects;
DROP POLICY IF EXISTS "Package images are public" ON storage.objects;

CREATE POLICY "Admins can upload package images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'package-images'
    AND (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Package images are public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'package-images');

CREATE POLICY "Admins can delete package images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'package-images'
    AND (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
    )
  );

-- 3. Widen media bucket policy to also allow 'packages' folder
DROP POLICY IF EXISTS "Admins can upload media" ON storage.objects;
CREATE POLICY "Admins can upload media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] IN ('bts', 'announcements', 'music', 'packages')
    AND (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
    )
  );
