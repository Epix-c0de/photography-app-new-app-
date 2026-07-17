-- Fix RLS: ensure super admin can manage platform_settings
-- Run this in Supabase SQL Editor

-- 1. Find the auth user ID for the super admin email
DO $$
DECLARE
  admin_uid UUID;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'epixshots002@gmail.com';

  IF admin_uid IS NULL THEN
    RAISE NOTICE 'No auth user found with email epixshots002@gmail.com';
    RETURN;
  END IF;

  -- 2. Upsert user_profiles with super_admin role
  INSERT INTO public.user_profiles (id, email, name, role, created_at, updated_at)
  VALUES (admin_uid, 'epixshots002@gmail.com', 'Super Admin', 'super_admin', NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET role = 'super_admin', updated_at = NOW();

  RAISE NOTICE 'User % now has super_admin role', admin_uid;
END $$;

-- 3. Verify: this query should return 1 row
-- SELECT id, email, role FROM user_profiles WHERE role = 'super_admin';
