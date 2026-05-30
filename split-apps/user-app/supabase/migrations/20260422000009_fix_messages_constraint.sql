-- Migration: Fix Messages Foreign Key Constraint for Admin Deletion
-- Date: 2026-04-22
-- Purpose: Fix foreign key constraint violation on messages table when deleting admin users

-- 1. Drop the problematic foreign key constraint on messages table
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_owner_admin_id_fkey;

-- 2. Add the foreign key constraint back with ON DELETE SET NULL
ALTER TABLE public.messages 
ADD CONSTRAINT messages_owner_admin_id_fkey 
FOREIGN KEY (owner_admin_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 3. Check for any other tables that might have foreign key constraints to user_profiles
-- and update them to use ON DELETE SET NULL for safe admin deletion

-- Fix chat_sessions owner_admin_id constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_sessions_owner_admin_id_fkey'
        AND table_name = 'chat_sessions'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.chat_sessions DROP CONSTRAINT chat_sessions_owner_admin_id_fkey;
        ALTER TABLE public.chat_sessions 
        ADD CONSTRAINT chat_sessions_owner_admin_id_fkey 
        FOREIGN KEY (owner_admin_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Update the admin deletion function to handle messages properly
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
  chat_session_count integer;
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
         COUNT(DISTINCT m.id), COUNT(DISTINCT cs.id)
  INTO client_count, gallery_count, notification_count, message_count, chat_session_count
  FROM public.user_profiles up
  LEFT JOIN public.clients c ON c.owner_admin_id = up.id
  LEFT JOIN public.galleries g ON g.owner_admin_id = up.id
  LEFT JOIN public.notifications n ON n.user_id = auth_user_id
  LEFT JOIN public.messages m ON m.owner_admin_id = up.id
  LEFT JOIN public.chat_sessions cs ON cs.owner_admin_id = up.id
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
  
  -- Reassign messages to master admin
  UPDATE public.messages 
  SET owner_admin_id = master_admin_id,
      updated_at = now()
  WHERE owner_admin_id = admin_id_to_delete;
  
  -- Reassign chat sessions to master admin
  UPDATE public.chat_sessions 
  SET owner_admin_id = master_admin_id,
      updated_at = now()
  WHERE owner_admin_id = admin_id_to_delete;
  
  -- Log the reassignment
  INSERT INTO public.master_admin_assignments (
    deleted_admin_id, 
    master_admin_id, 
    clients_reassigned,
    galleries_reassigned,
    notifications_cleared,
    messages_reassigned,
    chat_sessions_reassigned,
    notes
  ) VALUES (
    admin_id_to_delete,
    master_admin_id,
    client_count,
    gallery_count,
    notification_count,
    message_count,
    chat_session_count,
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
      'chat_sessions_reassigned', chat_session_count,
      'deleted_at', now()
    )
  );
  
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_admin_safely TO authenticated;

-- 5. Add missing columns to master_admin_assignments table if they don't exist
ALTER TABLE public.master_admin_assignments 
ADD COLUMN IF NOT EXISTS messages_reassigned integer DEFAULT 0;

ALTER TABLE public.master_admin_assignments 
ADD COLUMN IF NOT EXISTS chat_sessions_reassigned integer DEFAULT 0;

-- 6. Verify all foreign key constraints are properly set
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.constraint_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND (tc.table_name IN ('messages', 'chat_sessions', 'clients', 'galleries', 'notifications', 'user_profiles'))
AND ccu.table_name = 'user_profiles'
ORDER BY tc.table_name, tc.constraint_name;

COMMIT;

-- Usage Instructions:
-- 1. Run this migration to fix messages foreign key constraint
-- 2. Admin deletion should now work without constraint violations
-- 3. Messages and chat sessions will be properly reassigned to master admin
-- 4. The enhanced deletion function handles all related data properly
