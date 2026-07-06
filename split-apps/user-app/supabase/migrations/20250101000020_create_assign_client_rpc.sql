-- assign_client_to_photographer: Links a client to an admin via photographer code
-- Called from user-app when client enters their photographer code

-- Drop existing function first (PostgreSQL requires this when changing parameter names)
DROP FUNCTION IF EXISTS public.assign_client_to_photographer(uuid, text);

CREATE OR REPLACE FUNCTION public.assign_client_to_photographer(
  p_client_user_id uuid,
  p_photographer_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_name text;
  v_existing_client_id uuid;
BEGIN
  SELECT id, COALESCE(full_name, brand_name, 'Photographer')
  INTO v_admin_id, v_admin_name
  FROM user_profiles
  WHERE photographer_code = upper(trim(p_photographer_code))
    AND role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid photographer code. Please check and try again.'
    );
  END IF;

  IF v_admin_id = p_client_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You cannot assign yourself as a client.'
    );
  END IF;

  SELECT id INTO v_existing_client_id
  FROM clients
  WHERE user_id = p_client_user_id
    AND owner_admin_id = v_admin_id
  LIMIT 1;

  IF v_existing_client_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'admin_id', v_admin_id,
      'admin_name', v_admin_name,
      'message', 'Already connected to this photographer.'
    );
  END IF;

  INSERT INTO clients (id, owner_admin_id, user_id, name, phone, email, created_at)
  VALUES (
    gen_random_uuid(),
    v_admin_id,
    p_client_user_id,
    COALESCE(
      (SELECT full_name FROM user_profiles WHERE id = p_client_user_id),
      'Client'
    ),
    (SELECT phone FROM user_profiles WHERE id = p_client_user_id),
    (SELECT email FROM auth.users WHERE id = p_client_user_id),
    now()
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_existing_client_id
  FROM clients
  WHERE user_id = p_client_user_id
    AND owner_admin_id = v_admin_id
  LIMIT 1;

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, created_at)
  VALUES (v_admin_id, 'client_assigned_via_code', 'client', COALESCE(v_existing_client_id, gen_random_uuid()), now());

  RETURN jsonb_build_object(
    'success', true,
    'admin_id', v_admin_id,
    'admin_name', v_admin_name,
    'message', 'Successfully connected to ' || v_admin_name || '!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_client_to_photographer(uuid, text) TO authenticated;
