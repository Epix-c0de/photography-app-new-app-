-- Migration: Final Fix for Client Photos Bucket and Policies
-- Date: 2026-03-14
-- Purpose: Ensure the 'client-photos' bucket exists and admins have full control

-- 1. Ensure bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-photos', 
  'client-photos', 
  true, 
  524288000, -- 500MB
  '{image/*,video/*}'
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = '{image/*,video/*}';

-- 1.1 Ensure avatars bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can upload client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all client photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view client photos" ON storage.objects;

-- 3. Create robust Admin policies
-- This policy allows any authenticated admin to manage everything in client-photos
CREATE POLICY "Admins can manage all client photos" 
ON storage.objects FOR ALL 
TO authenticated
USING (
  bucket_id = 'client-photos' 
  AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  )
)
WITH CHECK (
  bucket_id = 'client-photos' 
  AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  )
);

-- 4. Create Public/Client view policy
-- Allows everyone to view watermarked photos, and authenticated clients to view their own photos
CREATE POLICY "Public can view client photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-photos'
);

-- 4.1 Avatars policies
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can manage their own avatars" ON storage.objects;
CREATE POLICY "Users can manage their own avatars"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Ensure user_profiles has the correct role for the current user
-- This is a self-fix for the admin running this migration
UPDATE public.user_profiles 
SET role = 'admin' 
WHERE id = auth.uid();
