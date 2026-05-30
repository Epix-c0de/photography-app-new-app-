-- Migration: Create Master Admin User
-- Date: 2026-04-22
-- Purpose: Create epixshots002@gmail.com as master admin

-- This script should be run after the master admin role migration

-- 1. Create the master admin user profile
-- Note: The auth user must be created through Supabase Dashboard or Auth API first
-- This migration only creates the user profile after the auth user exists

DO $$
DECLARE
  master_admin_email TEXT := 'epixshots002@gmail.com';
  user_id UUID;
BEGIN
  -- Get the auth user ID (this assumes the auth user was already created)
  SELECT id INTO user_id 
  FROM auth.users 
  WHERE email = master_admin_email;
  
  -- If user exists, create/update their profile
  IF user_id IS NOT NULL THEN
    INSERT INTO public.user_profiles (
      id,
      email,
      role,
      name,
      profile_complete,
      created_at,
      updated_at
    ) VALUES (
      user_id,
      master_admin_email,
      'master_admin',
      'Master Administrator',
      true,
      now(),
      now()
    ) ON CONFLICT (id) DO UPDATE SET
      role = 'master_admin',
      name = 'Master Administrator',
      profile_complete = true,
      updated_at = now();
      
    RAISE NOTICE 'Master admin profile created/updated with ID: %', user_id;
  ELSE
    RAISE NOTICE 'Master admin auth user not found. Please create epixshots002@gmail.com through Supabase Auth first.';
  END IF;
END $$;

-- 2. Set the master admin email in system settings (if not already set)
INSERT INTO public.system_settings (key, value, description) 
VALUES ('master_admin_email', 'epixshots002@gmail.com', 'Email of the master admin account')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- 3. Grant master admin all necessary permissions
-- The RLS policies already handle master_admin permissions through the is_master_admin function

-- 4. Create a function to check and update master admin status
CREATE OR REPLACE FUNCTION public.ensure_master_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_email TEXT := 'epixshots002@gmail.com';
  admin_id UUID;
BEGIN
  -- Get or create master admin
  SELECT id INTO admin_id 
  FROM public.user_profiles 
  WHERE email = master_email;
  
  -- If master admin doesn't exist, create them
  IF admin_id IS NULL THEN
    -- This would need to be handled through auth system
    RAISE NOTICE 'Master admin user needs to be created through auth system';
  ELSE
    -- Ensure they have master_admin role
    UPDATE public.user_profiles 
    SET role = 'master_admin',
        updated_at = now()
    WHERE id = admin_id AND role != 'master_admin';
  END IF;
END;
$$;

-- 5. Create a view to easily identify the master admin
CREATE OR REPLACE VIEW public.master_admin_view AS
SELECT 
  up.id,
  up.email,
  up.name,
  up.role,
  up.created_at,
  COUNT(DISTINCT c.id) as client_count,
  COUNT(DISTINCT g.id) as gallery_count
FROM public.user_profiles up
LEFT JOIN public.clients c ON c.owner_admin_id = up.id
LEFT JOIN public.galleries g ON g.owner_admin_id = up.id
WHERE up.email = (SELECT value FROM public.system_settings WHERE key = 'master_admin_email')
GROUP BY up.id, up.email, up.name, up.role, up.created_at;

-- Grant access to the view
GRANT SELECT ON public.master_admin_view TO authenticated;

-- 6. Create audit log for master admin actions
CREATE TABLE IF NOT EXISTS public.master_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_admin_id uuid NOT NULL REFERENCES public.user_profiles(id),
  action text NOT NULL,
  target_admin_id uuid REFERENCES public.user_profiles(id),
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Grant permissions for audit log
GRANT ALL ON public.master_admin_audit_log TO authenticated;

-- 7. Create function to log master admin actions
CREATE OR REPLACE FUNCTION public.log_master_admin_action(
  action text,
  target_admin_id uuid DEFAULT NULL,
  details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_id uuid;
BEGIN
  -- Get master admin ID
  SELECT id INTO master_id 
  FROM public.user_profiles 
  WHERE email = (SELECT value FROM public.system_settings WHERE key = 'master_admin_email');
  
  -- Log the action
  INSERT INTO public.master_admin_audit_log (
    master_admin_id,
    action,
    target_admin_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    master_id,
    action,
    target_admin_id,
    details,
    current_setting('request.headers')::json->>'x-forwarded-for',
    current_setting('request.headers')::json->>'user-agent'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.log_master_admin_action TO authenticated;

-- 8. Update the admin deletion trigger to log master admin actions
CREATE OR REPLACE FUNCTION public.handle_admin_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If the deleted user was an admin, reassign their clients and log the action
  IF OLD.role IN ('admin', 'super_admin') THEN
    PERFORM public.reassign_admin_clients(OLD.id);
    
    -- Log the master admin action if the current user is master admin
    IF public.is_master_admin(auth.uid()) THEN
      PERFORM public.log_master_admin_action(
        'admin_deleted',
        OLD.id,
        jsonb_build_object(
          'deleted_email', OLD.email,
          'deleted_role', OLD.role,
          'deleted_at', now()
        )
      );
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS handle_admin_deletion_trigger ON public.user_profiles;
CREATE TRIGGER handle_admin_deletion_trigger
BEFORE DELETE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_deletion();

COMMIT;

-- Usage Instructions:
-- 1. First, create the auth user through Supabase Dashboard:
--    - Go to Authentication > Users
--    - Click "Add user"
--    - Email: epixshots002@gmail.com
--    - Set a secure password
--    - Enable "Auto-confirm" to skip email verification
-- 2. Then run this migration in Supabase SQL Editor
-- 3. The user will have full administrative privileges and can manage other admins
-- 4. When other admins are deleted, their clients and galleries are automatically reassigned to the master admin

-- IMPORTANT: The auth user MUST be created first before running this migration
