-- Migration: Fix Admin Upload Permissions for Client Photos
-- Date: 2026-03-14
-- Purpose: Ensure admins can insert and update client photos in the storage bucket

-- Drop any restrictive policies on the client-photos bucket that might prevent direct admin uploads
DROP POLICY IF EXISTS "Admins can upload client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete client photos" ON storage.objects;

-- Insert permissive policies for authenticated users with admin roles
CREATE POLICY "Admins can upload client photos" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'client-photos' 
  AND EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update client photos" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'client-photos' 
  AND EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  bucket_id = 'client-photos' 
  AND EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can delete client photos" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'client-photos' 
  AND EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);
