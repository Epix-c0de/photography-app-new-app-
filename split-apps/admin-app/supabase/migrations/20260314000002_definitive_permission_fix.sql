-- Migration: Definitive Permission Fix for Photo Uploads
-- Date: 2026-03-14
-- Purpose: Fix the role mismatch and ensure admin has permissions to upload
-- 
-- HOW TO APPLY:
-- Go to Supabase Dashboard > SQL Editor > New Query
-- Paste this entire file and click Run

-- ============================================================
-- STEP 1: Fix the role check constraint (allow super_admin)
-- ============================================================
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('admin', 'client', 'super_admin'));

-- ============================================================
-- STEP 2: Set YOUR current account to admin role
-- (This sets the role for whichever user runs this SQL)
-- ============================================================
UPDATE public.user_profiles 
SET role = 'admin' 
WHERE id = auth.uid();

-- Confirm the update happened; if 0 rows updated, we need to insert:
DO $$
DECLARE
  current_user_id uuid := auth.uid();
  row_count int;
BEGIN
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count = 0 THEN
    INSERT INTO public.user_profiles (id, role, email)
    VALUES (current_user_id, 'admin', (SELECT email FROM auth.users WHERE id = current_user_id))
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
  END IF;
END $$;

-- ============================================================
-- STEP 3: Simplify client-photos bucket storage policies
-- Make folder check less restrictive  
-- ============================================================
DROP POLICY IF EXISTS "Admins can upload client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all client photos" ON storage.objects;
DROP POLICY IF EXISTS "Gallery owners can manage their photos" ON storage.objects;

-- Simple: any authenticated user with admin role can do anything in client-photos
CREATE POLICY "Admins can manage all client photos" 
ON storage.objects FOR ALL 
USING (
  bucket_id = 'client-photos' 
  AND (
    SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
  ) IN ('admin', 'super_admin')
)
WITH CHECK (
  bucket_id = 'client-photos' 
  AND (
    SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
  ) IN ('admin', 'super_admin')
);

-- ============================================================
-- STEP 4: Simplify Table RLS to not block admin at any step
-- ============================================================

-- clients table
DROP POLICY IF EXISTS "Admins can manage their own clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
CREATE POLICY "Admins can manage all clients" 
ON public.clients FOR ALL 
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) IN ('admin', 'super_admin')
);

-- galleries table
DROP POLICY IF EXISTS "Admins can manage their own galleries" ON public.galleries;
DROP POLICY IF EXISTS "Admins can manage all galleries" ON public.galleries;
CREATE POLICY "Admins can manage all galleries" 
ON public.galleries FOR ALL 
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) IN ('admin', 'super_admin')
);

-- gallery_photos table (drop all old policies first)
DROP POLICY IF EXISTS "Gallery owners can manage their photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Super admins can manage all photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Admins manage all gallery photos" ON public.gallery_photos;
CREATE POLICY "Admins manage all gallery photos" 
ON public.gallery_photos FOR ALL 
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) IN ('admin', 'super_admin')
)
WITH CHECK (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) IN ('admin', 'super_admin')
);

-- ============================================================
-- STEP 5: Ensure the client-photos bucket public access
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-photos', 'client-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;
