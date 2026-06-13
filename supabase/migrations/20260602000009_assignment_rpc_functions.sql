-- Migration: Create assignment-related RPC functions
-- Tasks: 2.1, 2.2, 2.3, 2.4
-- Requirements: 3.3, 3.4, 1.1, 14.5

-- Drop any previous overloads that may be causing ambiguity
DROP FUNCTION IF EXISTS public.auto_assign_on_login();
DROP FUNCTION IF EXISTS public.auto_assign_on_login(TEXT);

-- Task 2.1: Create auto_assign_on_login RPC function
CREATE OR REPLACE FUNCTION public.auto_assign_on_login(
  p_mobile_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_client_record RECORD;
  v_admin_name    TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'auto_assigned', false, 'error', 'Not authenticated'
    );
  END IF;

  -- Check if user already has a client assignment
  SELECT * INTO v_client_record
  FROM public.clients
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_client_record.owner_admin_id IS NOT NULL THEN
    SELECT name INTO v_admin_name
    FROM public.user_profiles
    WHERE id = v_client_record.owner_admin_id;

    RETURN jsonb_build_object(
      'success', true, 'auto_assigned', false,
      'admin_id', v_client_record.owner_admin_id,
      'admin_name', v_admin_name,
      'message', 'Already assigned'
    );
  END IF;

  -- Look for a client record matching by phone (the actual column name).
  -- mobile_number is a compatibility alias added by migration 20260602000008;
  -- fall back to it if the phone column is null.
  SELECT * INTO v_client_record
  FROM public.clients
  WHERE (
      phone         = p_mobile_number
    OR COALESCE(mobile_number, '') = p_mobile_number
  )
    AND owner_admin_id IS NOT NULL
    AND (user_id IS NULL OR user_id = v_user_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_client_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'auto_assigned', false,
      'message', 'No matching client record found'
    );
  END IF;

  IF v_client_record.user_id IS NULL THEN
    UPDATE public.clients
    SET user_id    = v_user_id,
        updated_at = NOW()
    WHERE id = v_client_record.id;
  END IF;

  -- Log the assignment (photographer_code may not be known here — use empty string)
  INSERT INTO public.client_assignment_log (
    client_id, admin_id, photographer_code, assigned_via, created_at
  )
  SELECT
    v_client_record.id,
    v_client_record.owner_admin_id,
    COALESCE(up.photographer_code, ''),
    'admin_invite',
    NOW()
  FROM public.user_profiles up
  WHERE up.id = v_client_record.owner_admin_id;

  SELECT name INTO v_admin_name
  FROM public.user_profiles
  WHERE id = v_client_record.owner_admin_id;

  RETURN jsonb_build_object(
    'success', true, 'auto_assigned', true,
    'admin_id',   v_client_record.owner_admin_id,
    'admin_name', v_admin_name,
    'client_id',  v_client_record.id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 'auto_assigned', false, 'error', SQLERRM
  );
END;
$$;

-- Specify full signature to avoid ambiguity
GRANT EXECUTE ON FUNCTION public.auto_assign_on_login(TEXT) TO authenticated;
COMMENT ON FUNCTION public.auto_assign_on_login(TEXT) IS
  'Auto-assigns user to photographer if mobile number matches existing client record';


-- Task 2.2: Create client_needs_assignment RPC function
DROP FUNCTION IF EXISTS public.client_needs_assignment();

CREATE OR REPLACE FUNCTION public.client_needs_assignment()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_owner_admin_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT owner_admin_id INTO v_owner_admin_id
  FROM public.clients
  WHERE user_id = v_user_id
  LIMIT 1;

  RETURN (v_owner_admin_id IS NULL);

EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_needs_assignment() TO authenticated;
COMMENT ON FUNCTION public.client_needs_assignment() IS
  'Checks if the current authenticated user needs photographer assignment';


-- Task 2.3: Create close_unassigned_session_on_assignment trigger function
CREATE OR REPLACE FUNCTION public.close_unassigned_session_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_start TIMESTAMPTZ;
BEGIN
  IF OLD.owner_admin_id IS NULL AND NEW.owner_admin_id IS NOT NULL THEN

    SELECT session_start INTO v_session_start
    FROM public.unassigned_user_sessions
    WHERE user_id      = NEW.user_id
      AND session_end  IS NULL
      AND assigned_at  IS NULL
    ORDER BY session_start DESC
    LIMIT 1;

    IF v_session_start IS NOT NULL THEN
      UPDATE public.unassigned_user_sessions
      SET
        session_end                = NOW(),
        assigned_at                = NOW(),
        assigned_via               = COALESCE(
          (SELECT assigned_via
             FROM public.client_assignment_log
            WHERE client_id = NEW.id
            ORDER BY created_at DESC
            LIMIT 1),
          'unknown'
        ),
        time_to_assignment_seconds = EXTRACT(EPOCH FROM (NOW() - session_start))::INTEGER,
        updated_at                 = NOW()
      WHERE user_id      = NEW.user_id
        AND session_start = v_session_start
        AND session_end   IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.close_unassigned_session_on_assignment() IS
  'Closes unassigned user session when client gets assigned';


-- Task 2.4: Trigger on clients table for session closure
DROP TRIGGER IF EXISTS trigger_close_unassigned_session ON public.clients;

CREATE TRIGGER trigger_close_unassigned_session
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  WHEN (OLD.owner_admin_id IS DISTINCT FROM NEW.owner_admin_id)
  EXECUTE FUNCTION public.close_unassigned_session_on_assignment();

COMMENT ON TRIGGER trigger_close_unassigned_session ON public.clients IS
  'Triggers session closure when client assignment changes';
