-- Migration: Add Master Admin Role and Management System
-- Date: 2026-04-22
-- Purpose: Create master admin system for epixshots002@gmail.com

-- 1. Update user_profiles table to support master_admin role
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('admin', 'client', 'super_admin', 'master_admin'));

-- 2. Create master_admin_assignments table for managing admin reassignments
CREATE TABLE IF NOT EXISTS public.master_admin_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_admin_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  master_admin_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reassigned_to_admin_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  clients_reassigned integer DEFAULT 0,
  galleries_reassigned integer DEFAULT 0,
  reassigned_at timestamp with time zone DEFAULT now(),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Add master_admin_email to system settings (for easy configuration)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert master admin email setting
INSERT INTO public.system_settings (key, value, description) 
VALUES ('master_admin_email', 'epixshots002@gmail.com', 'Email of the master admin account')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- 4. Create function to check if user is master admin
CREATE OR REPLACE FUNCTION public.is_master_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email text;
  master_email text;
BEGIN
  -- Get user email
  SELECT email INTO user_email 
  FROM public.user_profiles 
  WHERE id = user_id;
  
  -- Get master admin email from settings
  SELECT value INTO master_email 
  FROM public.system_settings 
  WHERE key = 'master_admin_email';
  
  -- Check if user email matches master admin email
  RETURN user_email = master_email;
END;
$$;

-- 5. Create function to reassign clients when admin is deleted
CREATE OR REPLACE FUNCTION public.reassign_admin_clients(deleted_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_admin_id uuid;
  reassigned_count integer;
BEGIN
  -- Get master admin ID
  SELECT id INTO master_admin_id 
  FROM public.user_profiles 
  WHERE email = (SELECT value FROM public.system_settings WHERE key = 'master_admin_email');
  
  -- Reassign all clients to master admin
  UPDATE public.clients 
  SET owner_admin_id = master_admin_id,
      updated_at = now()
  WHERE owner_admin_id = deleted_admin_id;
  
  GET DIAGNOSTICS reassigned_count = ROW_COUNT;
  
  -- Log the reassignment
  INSERT INTO public.master_admin_assignments (
    deleted_admin_id, 
    master_admin_id, 
    clients_reassigned,
    notes
  ) VALUES (
    deleted_admin_id,
    master_admin_id,
    reassigned_count,
    'Clients reassigned to master admin on deletion'
  );
END;
$$;

-- 6. Update RLS policies to include master_admin
-- Allow master admins to view all admin profiles
CREATE POLICY "Master admins can view all profiles" 
ON public.user_profiles FOR SELECT
USING (public.is_master_admin(auth.uid()));

-- Allow master admins to update any admin profile
CREATE POLICY "Master admins can manage admins" 
ON public.user_profiles FOR UPDATE
USING (public.is_master_admin(auth.uid()))
WITH CHECK (public.is_master_admin(auth.uid()));

-- Allow master admins to delete admin profiles (with cascade)
CREATE POLICY "Master admins can delete admins" 
ON public.user_profiles FOR DELETE
USING (public.is_master_admin(auth.uid()));

-- 7. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.master_admin_assignments TO authenticated;
GRANT ALL ON public.system_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_admin_clients TO authenticated;

-- 8. Create trigger to automatically reassign clients when admin is deleted
CREATE OR REPLACE FUNCTION public.handle_admin_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If the deleted user was an admin, reassign their clients
  IF OLD.role IN ('admin', 'super_admin') THEN
    PERFORM public.reassign_admin_clients(OLD.id);
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER handle_admin_deletion_trigger
BEFORE DELETE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_deletion();

-- 9. Create view for master admin to see all admins
CREATE OR REPLACE VIEW public.admin_management_view AS
SELECT 
  up.id,
  up.email,
  up.name,
  up.role,
  up.created_at,
  COUNT(DISTINCT c.id) as client_count,
  COUNT(DISTINCT g.id) as gallery_count,
  up.phone,
  up.avatar_url
FROM public.user_profiles up
LEFT JOIN public.clients c ON c.owner_admin_id = up.id
LEFT JOIN public.galleries g ON g.owner_admin_id = up.id
WHERE up.role IN ('admin', 'super_admin')
GROUP BY up.id, up.email, up.name, up.role, up.created_at, up.phone, up.avatar_url
ORDER BY up.created_at DESC;

-- Grant access to the view for master admins
GRANT SELECT ON public.admin_management_view TO authenticated;

-- 10. Update existing policies to include master_admin in admin checks
-- This ensures master admin has all admin privileges
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
CREATE POLICY "Admins can manage all clients" 
ON public.clients FOR ALL 
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) IN ('admin', 'super_admin', 'master_admin')
);

-- Similar updates for other tables...
DROP POLICY IF EXISTS "Admins can manage all galleries" ON public.galleries;
CREATE POLICY "Admins can manage all galleries" 
ON public.galleries FOR ALL 
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) IN ('admin', 'super_admin', 'master_admin')
);
