-- Migration: Fix Admin Deletion User Metadata Reference
-- Date: 2026-04-22
-- Purpose: Fix admin deletion function that incorrectly references user_metadata column

-- 1. Update the admin deletion function to remove incorrect user_metadata reference
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
  auth_user_id uuid;
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
  
  -- Get the auth user ID for this admin profile
  SELECT id INTO auth_user_id
  FROM auth.users 
  WHERE raw_user_meta_data->>'profile_id' = admin_id_to_delete::text;
  
  -- Count related records before deletion
  SELECT COUNT(DISTINCT c.id), COUNT(DISTINCT g.id), COUNT(DISTINCT n.id)
  INTO client_count, gallery_count, notification_count
  FROM public.user_profiles up
  LEFT JOIN public.clients c ON c.owner_admin_id = up.id
  LEFT JOIN public.galleries g ON g.owner_admin_id = up.id
  LEFT JOIN public.notifications n ON n.user_id = auth_user_id
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
  
  -- Set notifications to NULL for deleted admin (if we found the auth user)
  IF auth_user_id IS NOT NULL THEN
    UPDATE public.notifications 
    SET user_id = NULL
    WHERE user_id = auth_user_id;
  END IF;
  
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

-- 2. Create a helper function to get auth user ID from profile ID
CREATE OR REPLACE FUNCTION public.get_auth_user_id_from_profile(profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user_id uuid;
BEGIN
  SELECT id INTO auth_user_id
  FROM auth.users 
  WHERE raw_user_meta_data->>'profile_id' = profile_id::text;
  
  RETURN auth_user_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_from_profile TO authenticated;

-- 3. Test the function to verify it works correctly
DO $$
DECLARE
  test_admin_id uuid;
  test_auth_id uuid;
BEGIN
  -- Get a test admin profile ID (if any exists)
  SELECT id INTO test_admin_id
  FROM public.user_profiles 
  WHERE role IN ('admin', 'super_admin')
  LIMIT 1;
  
  IF test_admin_id IS NOT NULL THEN
    -- Test the helper function
    test_auth_id := public.get_auth_user_id_from_profile(test_admin_id);
    
    RAISE NOTICE 'Test admin profile ID: %', test_admin_id;
    RAISE NOTICE 'Corresponding auth user ID: %', test_auth_id;
  END IF;
END $$;

COMMIT;

-- Usage Instructions:
-- 1. Run this migration to fix the user_metadata reference error
-- 2. The admin deletion function now uses raw_user_meta_data instead of user_metadata
-- 3. A helper function is provided to get auth user ID from profile ID
-- 4. Admin deletion should now work without column reference errors
