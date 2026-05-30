-- Migration: Fix Admin Deletion Issues
-- Date: 2026-04-22
-- Purpose: Fix admin deletion by handling auth users and constraints properly

-- 1. Create a more robust admin deletion function
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

-- 2. Create a function to check if admin can be deleted
CREATE OR REPLACE FUNCTION public.can_delete_admin(admin_id_to_delete uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_admin_id uuid;
  admin_email text;
BEGIN
  -- Get master admin ID
  SELECT id INTO master_admin_id
  FROM public.user_profiles 
  WHERE email = (SELECT value FROM public.system_settings WHERE key = 'master_admin_email');
  
  -- Check if current user is master admin
  IF master_admin_id != auth.uid() THEN
    RETURN false;
  END IF;
  
  -- Cannot delete yourself
  IF admin_id_to_delete = master_admin_id THEN
    RETURN false;
  END IF;
  
  -- Check if admin exists
  SELECT email INTO admin_email
  FROM public.user_profiles
  WHERE id = admin_id_to_delete;
  
  RETURN admin_email IS NOT NULL;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_delete_admin TO authenticated;

-- 3. Update the trigger to use the new safe deletion function
CREATE OR REPLACE FUNCTION public.handle_admin_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This trigger is now handled by the delete_admin_safely function
  -- Keeping it for backward compatibility but it won't be used
  IF OLD.role IN ('admin', 'super_admin') THEN
    -- Log the deletion attempt
    INSERT INTO public.master_admin_audit_log (
      master_admin_id,
      action,
      target_admin_id,
      details
    ) VALUES (
      auth.uid(),
      'admin_deletion_attempt',
      OLD.id,
      jsonb_build_object(
        'deleted_email', OLD.email,
        'deleted_role', OLD.role,
        'deleted_at', now()
      )
    );
  END IF;
  RETURN OLD;
END;
$$;

-- 4. Drop and recreate the trigger
DROP TRIGGER IF EXISTS handle_admin_deletion_trigger ON public.user_profiles;
CREATE TRIGGER handle_admin_deletion_trigger
BEFORE DELETE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_deletion();

-- 5. Create a view for admin deletion status
CREATE OR REPLACE VIEW public.admin_deletion_status_view AS
SELECT 
  up.id,
  up.email,
  up.name,
  up.role,
  up.created_at,
  COUNT(DISTINCT c.id) as client_count,
  COUNT(DISTINCT g.id) as gallery_count,
  public.can_delete_admin(up.id) as can_delete,
  CASE 
    WHEN up.email = (SELECT value FROM public.system_settings WHERE key = 'master_admin_email') 
    THEN 'master_admin'
    WHEN public.can_delete_admin(up.id) 
    THEN 'deletable'
    ELSE 'protected'
  END as deletion_status
FROM public.user_profiles up
LEFT JOIN public.clients c ON c.owner_admin_id = up.id
LEFT JOIN public.galleries g ON g.owner_admin_id = up.id
WHERE up.role IN ('admin', 'super_admin')
GROUP BY up.id, up.email, up.name, up.role, up.created_at
ORDER BY up.created_at DESC;

-- Grant access to the view
GRANT SELECT ON public.admin_deletion_status_view TO authenticated;

COMMIT;

-- Usage Instructions:
-- 1. Use the delete_admin_safely function instead of direct DELETE
-- 2. The function handles all reassignments and logging automatically
-- 3. Use can_delete_admin to check if deletion is allowed
-- 4. The admin_deletion_status_view shows which admins can be deleted
-- 5. This prevents deletion of master admin and handles all constraints properly
