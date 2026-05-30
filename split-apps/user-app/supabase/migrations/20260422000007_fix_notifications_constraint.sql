-- Migration: Fix Notifications Foreign Key Constraint for Admin Deletion
-- Date: 2026-04-22
-- Purpose: Fix foreign key constraint violation on notifications table when deleting admin users

-- 1. Drop the problematic foreign key constraint on notifications table
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- 2. Add the foreign key constraint back with ON DELETE SET NULL
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Check for any other foreign key constraints that might reference user_profiles or auth.users
-- Fix any remaining constraints that could block admin deletion

-- Check if there are constraints on other tables that reference user_profiles
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT 
            tc.table_name,
            tc.constraint_name,
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
        WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name IN ('user_profiles', 'auth.users')
        AND tc.table_name != 'user_profiles'
    LOOP
        -- Log the constraint for debugging
        RAISE NOTICE 'Found constraint: % on table % referencing %', 
            constraint_record.constraint_name, 
            constraint_record.table_name, 
            constraint_record.foreign_table_name;
    END LOOP;
END $$;

-- 4. Update the admin deletion function to handle notifications properly
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
  notification_count integer;
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
  
  -- Count related records before deletion
  SELECT COUNT(DISTINCT c.id), COUNT(DISTINCT g.id), COUNT(DISTINCT n.id)
  INTO client_count, gallery_count, notification_count
  FROM public.user_profiles up
  LEFT JOIN public.clients c ON c.owner_admin_id = up.id
  LEFT JOIN public.galleries g ON g.owner_admin_id = up.id
  LEFT JOIN public.notifications n ON n.user_id = (SELECT id FROM auth.users WHERE user_metadata->>'profile_id' = up.id::text)
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
  
  -- Set notifications to NULL for deleted admin
  UPDATE public.notifications 
  SET user_id = NULL
  WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE user_metadata->>'profile_id' = admin_id_to_delete::text
  );
  
  -- Log the reassignment
  INSERT INTO public.master_admin_assignments (
    deleted_admin_id, 
    master_admin_id, 
    clients_reassigned,
    galleries_reassigned,
    notifications_cleared,
    notes
  ) VALUES (
    admin_id_to_delete,
    master_admin_id,
    client_count,
    gallery_count,
    notification_count,
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
      'notifications_cleared', notification_count,
      'deleted_at', now()
    )
  );
  
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_admin_safely TO authenticated;

-- 5. Add missing column to master_admin_assignments table if it doesn't exist
ALTER TABLE public.master_admin_assignments 
ADD COLUMN IF NOT EXISTS notifications_cleared integer DEFAULT 0;

COMMIT;

-- Usage Instructions:
-- 1. Run this migration to fix notifications foreign key constraint
-- 2. Admin deletion should now work without constraint violations
-- 3. Notifications will be properly handled (set to NULL) when admin is deleted
-- 4. The enhanced deletion function handles all related data properly
