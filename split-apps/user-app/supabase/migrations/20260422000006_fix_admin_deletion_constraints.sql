-- Migration: Fix Admin Deletion Foreign Key Constraints
-- Date: 2026-04-22
-- Purpose: Fix foreign key constraint violations when deleting admin users

-- 1. Drop the problematic foreign key constraint on clients table
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_user_id_fkey;

-- 2. Add the foreign key constraint back with ON DELETE SET NULL
ALTER TABLE public.clients 
ADD CONSTRAINT clients_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Check if there are any other foreign key constraints that need fixing
-- Drop and recreate constraints on other tables that reference user_profiles

-- Fix galleries owner_admin_id constraint
ALTER TABLE public.galleries DROP CONSTRAINT IF EXISTS galleries_owner_admin_id_fkey;
ALTER TABLE public.galleries 
ADD CONSTRAINT galleries_owner_admin_id_fkey 
FOREIGN KEY (owner_admin_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Fix clients owner_admin_id constraint  
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_owner_admin_id_fkey;
ALTER TABLE public.clients 
ADD CONSTRAINT clients_owner_admin_id_fkey 
FOREIGN KEY (owner_admin_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Fix bookings user_id constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE public.bookings 
ADD CONSTRAINT bookings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fix bookings package_id constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_package_id_fkey;
ALTER TABLE public.bookings 
ADD CONSTRAINT bookings_package_id_fkey 
FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE SET NULL;

-- 4. Update the admin deletion function to handle constraints properly
CREATE OR REPLACE FUNCTION public.delete_admin_safely(admin_id_to_delete uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_admin_id uuid;
  admin_email text;
  admin_role text;
  client_count integer;
  gallery_count integer;
BEGIN
  -- Verify current user is master admin
  SELECT id INTO master_admin_id
  FROM public.user_profiles 
  WHERE email = (SELECT value FROM public.system_settings WHERE key = 'master_admin_email');
  
  IF master_admin_id IS NULL OR master_admin_id != auth.uid() THEN
    RAISE EXCEPTION 'Only master admin can delete other admins';
  END IF;
  
  -- Cannot delete yourself
  IF admin_id_to_delete = master_admin_id THEN
    RAISE EXCEPTION 'Cannot delete your own admin account';
  END IF;
  
  -- Get admin info for logging
  SELECT email, role INTO admin_email, admin_role
  FROM public.user_profiles
  WHERE id = admin_id_to_delete;
  
  IF admin_email IS NULL THEN
    RAISE EXCEPTION 'Admin not found';
  END IF;
  
  -- Count clients and galleries before deletion
  SELECT COUNT(DISTINCT c.id), COUNT(DISTINCT g.id)
  INTO client_count, gallery_count
  FROM public.user_profiles up
  LEFT JOIN public.clients c ON c.owner_admin_id = up.id
  LEFT JOIN public.galleries g ON g.owner_admin_id = up.id
  WHERE up.id = admin_id_to_delete;
  
  -- Reassign clients to master admin
  UPDATE public.clients 
  SET owner_admin_id = master_admin_id,
      updated_at = now()
  WHERE owner_admin_id = admin_id_to_delete;
  
  -- Reassign galleries to master admin
  UPDATE public.galleries 
  SET owner_admin_id = master_admin_id,
      updated_at = now()
  WHERE owner_admin_id = admin_id_to_delete;
  
  -- Log the reassignment
  INSERT INTO public.master_admin_assignments (
    deleted_admin_id, 
    master_admin_id, 
    clients_reassigned,
    galleries_reassigned,
    notes
  ) VALUES (
    admin_id_to_delete,
    master_admin_id,
    client_count,
    gallery_count,
    'Admin deleted: ' || admin_email || ' (' || admin_role || ')'
  );
  
  -- Delete the user profile (auth user will remain but won't have access)
  DELETE FROM public.user_profiles
  WHERE id = admin_id_to_delete;
  
  -- Log the master admin action
  INSERT INTO public.master_admin_audit_log (
    master_admin_id,
    action,
    target_admin_id,
    details
  ) VALUES (
    master_admin_id,
    'admin_deleted',
    admin_id_to_delete,
    jsonb_build_object(
      'deleted_email', admin_email,
      'deleted_role', admin_role,
      'clients_reassigned', client_count,
      'galleries_reassigned', gallery_count,
      'deleted_at', now()
    )
  );
  
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_admin_safely TO authenticated;

-- 5. Verify all constraints are properly set
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type IN ('FOREIGN KEY') 
AND (tc.table_name IN ('clients', 'galleries', 'bookings', 'user_profiles'))
ORDER BY tc.table_name, tc.constraint_name;

COMMIT;

-- Usage Instructions:
-- 1. Run this migration to fix foreign key constraints
-- 2. Admin deletion should now work without constraint violations
-- 3. Related data will be properly reassigned or set to NULL
-- 4. The safe deletion function handles all edge cases
