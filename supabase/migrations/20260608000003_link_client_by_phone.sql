-- ============================================
-- Auto-link a new user to any client record
-- created by an admin with matching phone number.
-- Called from the user app after signup/login.
-- ============================================

-- Function: claim_client_by_phone
-- When a user signs up in the user app, call this with their phone number.
-- It finds any unlinked client records with a matching phone and sets user_id.
-- Returns the admin_id so the app knows which photographer owns them.

CREATE OR REPLACE FUNCTION public.claim_client_by_phone(
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   UUID;
  v_client    clients%ROWTYPE;
  v_updated   INT := 0;
  v_admin_ids JSONB := '[]'::JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Normalize the phone: strip everything except digits and leading +
  -- Match on exact phone OR mobile_number
  FOR v_client IN
    SELECT * FROM public.clients
    WHERE (
      REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g')
      OR
      REGEXP_REPLACE(mobile_number, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g')
    )
    AND user_id IS NULL
    AND owner_admin_id IS NOT NULL
  LOOP
    -- Link this client record to the signed-in user
    UPDATE public.clients
    SET user_id = v_user_id
    WHERE id = v_client.id;

    v_updated := v_updated + 1;
    v_admin_ids := v_admin_ids || jsonb_build_array(v_client.owner_admin_id);
  END LOOP;

  -- Also update the user_profiles phone if not already set
  UPDATE public.user_profiles
  SET phone = p_phone
  WHERE id = v_user_id AND (phone IS NULL OR phone = '');

  RETURN jsonb_build_object(
    'success', true,
    'linked_count', v_updated,
    'admin_ids', v_admin_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_client_by_phone(TEXT) TO authenticated;
