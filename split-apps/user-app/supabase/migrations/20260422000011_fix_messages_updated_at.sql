-- Migration: Fix Messages Table Missing updated_at Column
-- Date: 2026-04-22
-- Purpose: Add missing updated_at column to messages table for admin deletion functionality

-- 1. Add updated_at column to messages table if it doesn't exist
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_messages_updated_at ON public.messages(updated_at);

-- 3. Update existing messages to have updated_at set to their created_at
UPDATE public.messages 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 4. Set default value for future inserts
ALTER TABLE public.messages 
ALTER COLUMN updated_at SET DEFAULT now();

-- 5. Create trigger to automatically update updated_at on message changes
CREATE OR REPLACE FUNCTION public.update_message_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_message_updated_at_trigger ON public.messages;

-- Create the trigger
CREATE TRIGGER update_message_updated_at_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_message_updated_at();

-- 6. Update the admin deletion function to handle messages properly without updated_at issues
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
  message_count integer;
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
  SELECT COUNT(DISTINCT c.id), COUNT(DISTINCT g.id), COUNT(DISTINCT n.id), 
         COUNT(DISTINCT m.id)
  INTO client_count, gallery_count, notification_count, message_count
  FROM public.user_profiles up
  LEFT JOIN public.clients c ON c.owner_admin_id = up.id
  LEFT JOIN public.galleries g ON g.owner_admin_id = up.id
  LEFT JOIN public.notifications n ON n.user_id = auth_user_id
  LEFT JOIN public.messages m ON m.owner_admin_id = up.id
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
  
  -- Reassign messages to master admin (only if messages table has updated_at column)
  BEGIN
    UPDATE public.messages 
    SET owner_admin_id = master_admin_id;
    
    -- Try to update updated_at if the column exists
    BEGIN
      UPDATE public.messages 
      SET updated_at = now()
      WHERE owner_admin_id = master_admin_id;
    EXCEPTION
      WHEN undefined_column THEN
        -- updated_at column doesn't exist, skip this update
        NULL;
    END;
  EXCEPTION
    WHEN undefined_table THEN
      -- messages table doesn't exist, skip this operation
      NULL;
  END;
  
  -- Log the reassignment
  INSERT INTO public.master_admin_assignments (
    deleted_admin_id, 
    master_admin_id, 
    clients_reassigned,
    galleries_reassigned,
    notifications_cleared,
    messages_reassigned,
    notes
  ) VALUES (
    admin_id_to_delete,
    master_admin_id,
    client_count,
    gallery_count,
    notification_count,
    message_count,
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
      'messages_reassigned', message_count,
      'deleted_at', now()
    )
  );
  
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_admin_safely TO authenticated;

-- 7. Verify the messages table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND table_schema = 'public'
ORDER BY ordinal_position;

COMMIT;

-- Usage Instructions:
-- 1. Run this migration to fix messages table updated_at column
-- 2. Admin deletion should now work without updated_at column errors
-- 3. The deletion function handles both cases: with and without updated_at column
-- 4. Messages will be properly reassigned to master admin
