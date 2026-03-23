-- Migration: Comprehensive Permission and Role Fix
-- Date: 2026-03-14
-- Purpose: Fix role check constraint mismatch and ensure admin has full permissions

-- 1. Fix the check constraint on user_profiles.role
-- Many policies expect 'super_admin', but the table only allowed 'admin' or 'client'
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('admin', 'client', 'super_admin'));

-- 2. Ensure current admin accounts are actually set to 'admin' role
-- This fix is targeted at the user running the SQL
UPDATE public.user_profiles 
SET role = 'admin' 
WHERE id = auth.uid();

-- 3. Simplify and Fix Storage Policies for 'client-photos'
-- Drop existing possibly broken/conflicting policies
DROP POLICY IF EXISTS "Admins can upload client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete client photos" ON storage.objects;
DROP POLICY IF EXISTS "Gallery owners can manage their photos" ON storage.objects;

-- Create robust, direct policies for admins
CREATE POLICY "Admins can manage all client photos" 
ON storage.objects FOR ALL 
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

-- 4. Ensure RLS for tables includes a 'Super Admin' bypass
-- This ensures that even if local ID checks fail, any admin can manage the data

-- For clients
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
CREATE POLICY "Admins can manage all clients" 
ON public.clients FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- For galleries
DROP POLICY IF EXISTS "Admins can manage all galleries" ON public.galleries;
CREATE POLICY "Admins can manage all galleries" 
ON public.galleries FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- For gallery_photos
DROP POLICY IF EXISTS "Admins manage all gallery photos" ON public.gallery_photos;
CREATE POLICY "Admins manage all gallery photos" 
ON public.gallery_photos FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);
