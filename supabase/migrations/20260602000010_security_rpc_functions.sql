-- Migration: Create security-related RPC functions
-- Tasks: 3.1, 3.2, 3.3, 3.4
-- Requirements: 8.4, 8.5, 8.10, 9.3, 9.4, 7.9, 12.8

-- Task 3.1: Create update_biometric_setting RPC function
CREATE OR REPLACE FUNCTION public.update_biometric_setting(
  p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Update biometric setting
  UPDATE public.user_profiles
  SET 
    biometric_enabled = p_enabled,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Log the change to audit log
  INSERT INTO public.admin_audit_log (
    admin_id,
    action,
    entity_type,
    entity_id,
    changes,
    created_at
  ) VALUES (
    v_user_id,
    CASE WHEN p_enabled THEN 'biometric_enabled' ELSE 'biometric_disabled' END,
    'user_profile',
    v_user_id,
    jsonb_build_object('biometric_enabled', p_enabled),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'biometric_enabled', p_enabled
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_biometric_setting(BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.update_biometric_setting IS 'Updates user biometric authentication setting';


-- Task 3.2: Create set_pin_hash RPC function
CREATE OR REPLACE FUNCTION public.set_pin_hash(
  p_pin_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Validate pin_hash is not empty
  IF p_pin_hash IS NULL OR LENGTH(p_pin_hash) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PIN hash cannot be empty'
    );
  END IF;

  -- Update PIN hash
  UPDATE public.user_profiles
  SET 
    pin_hash = p_pin_hash,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Log the change to audit log
  INSERT INTO public.admin_audit_log (
    admin_id,
    action,
    entity_type,
    entity_id,
    changes,
    created_at
  ) VALUES (
    v_user_id,
    'pin_set',
    'user_profile',
    v_user_id,
    jsonb_build_object('pin_hash_updated', true),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'PIN set successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.set_pin_hash(TEXT) TO authenticated;

COMMENT ON FUNCTION public.set_pin_hash IS 'Sets user PIN hash for PIN lock authentication';


-- Task 3.3: Create remove_pin_lock RPC function
CREATE OR REPLACE FUNCTION public.remove_pin_lock()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Remove PIN hash
  UPDATE public.user_profiles
  SET 
    pin_hash = NULL,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Log the change to audit log
  INSERT INTO public.admin_audit_log (
    admin_id,
    action,
    entity_type,
    entity_id,
    changes,
    created_at
  ) VALUES (
    v_user_id,
    'pin_removed',
    'user_profile',
    v_user_id,
    jsonb_build_object('pin_hash', NULL),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'PIN lock removed successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.remove_pin_lock() TO authenticated;

COMMENT ON FUNCTION public.remove_pin_lock IS 'Removes user PIN lock by clearing pin_hash';


-- Task 3.4: Create sync_password_changed_timestamp trigger function
CREATE OR REPLACE FUNCTION public.sync_password_changed_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if encrypted_password changed
  IF OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password THEN
    
    -- Update password_changed_at in user_profiles
    UPDATE public.user_profiles
    SET 
      password_changed_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.id;
    
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_password_changed_timestamp IS
  'Syncs password change timestamp from auth.users to user_profiles. '
  'Trigger must be created via Supabase Dashboard if this migration role '
  'does not own auth.users.';

-- Create trigger on auth.users.
-- Wrapped in DO block: fails gracefully if current role lacks ownership of
-- auth.users (common in hosted Supabase projects where auth schema is managed
-- by the platform). In that case create the trigger manually in Supabase
-- Dashboard → Database → Triggers.
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_sync_password_timestamp ON auth.users;

  CREATE TRIGGER trigger_sync_password_timestamp
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password)
    EXECUTE FUNCTION public.sync_password_changed_timestamp();

  RAISE NOTICE 'trigger_sync_password_timestamp created on auth.users';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE
      'SKIPPED: Cannot create trigger on auth.users — insufficient privilege. '
      'Create it manually: Supabase Dashboard → Database → Triggers → '
      'Table: auth.users | Event: UPDATE | Function: public.sync_password_changed_timestamp';
  WHEN OTHERS THEN
    RAISE NOTICE 'SKIPPED trigger creation: %', SQLERRM;
END;
$$;
