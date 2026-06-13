-- ============================================================
-- Fix 1: Messages RLS
-- The old admin INSERT policy checked owner_admin_id = auth.uid()
-- which blocks the photographer web dashboard from sending messages
-- (it is authenticated as admin but may not match owner_admin_id
--  if the client was pre-created with a different admin).
-- Replace with a role-based policy that allows any admin/super_admin
-- to insert messages they own.
-- ============================================================

-- Drop all conflicting admin policies on messages
DROP POLICY IF EXISTS "Admins can insert messages"        ON public.messages;
DROP POLICY IF EXISTS "Admins can insert any message"     ON public.messages;
DROP POLICY IF EXISTS "Admins can view all messages"      ON public.messages;
DROP POLICY IF EXISTS "Admins can view messages for their clients" ON public.messages;
DROP POLICY IF EXISTS "Admins can update messages (mark read)"    ON public.messages;

-- Admin SELECT: any admin can read messages they own
CREATE POLICY "Admins can view own messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    owner_admin_id = auth.uid()
    OR (
      SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
    ) = 'super_admin'
  );

-- Admin INSERT: any admin/super_admin can insert as sender_role='admin'
--   AND must set owner_admin_id = their own uid
CREATE POLICY "Admins can insert messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_role = 'admin'
    AND owner_admin_id = auth.uid()
    AND (
      SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
    ) IN ('admin', 'super_admin')
  );

-- Admin UPDATE: mark messages as read
CREATE POLICY "Admins can update own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (owner_admin_id = auth.uid());

-- ============================================================
-- Fix 2: Gallery unlock — allow lookup by access_code regardless
-- of whether the user has a linked client record yet.
-- The fetchGalleries query in the user app only returns galleries
-- where client_id matches a client row with user_id = auth.uid().
-- When a client was pre-created by phone (no user_id), the user
-- can't see their galleries until phone-linking runs.
--
-- Add a function that links a user to all client records matching
-- their phone AND returns their galleries — called after unlock.
-- ============================================================

CREATE OR REPLACE FUNCTION public.unlock_gallery_and_link(
  p_access_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   UUID;
  v_gallery   galleries%ROWTYPE;
  v_client    clients%ROWTYPE;
  v_phone     TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the gallery
  SELECT * INTO v_gallery
  FROM public.galleries
  WHERE UPPER(access_code) = UPPER(TRIM(p_access_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gallery not found for that access code');
  END IF;

  -- If the gallery has a client record, try to link the current user
  IF v_gallery.client_id IS NOT NULL THEN
    SELECT * INTO v_client FROM public.clients WHERE id = v_gallery.client_id;

    IF FOUND AND v_client.user_id IS NULL THEN
      -- Client row exists but has no user_id — link it now
      UPDATE public.clients SET user_id = v_user_id WHERE id = v_client.id;
    END IF;

    -- Also try phone-based linking for any other unlinked client rows
    SELECT phone INTO v_phone FROM public.user_profiles WHERE id = v_user_id;
    IF v_phone IS NOT NULL THEN
      UPDATE public.clients
      SET user_id = v_user_id
      WHERE user_id IS NULL
        AND owner_admin_id IS NOT NULL
        AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') =
            REGEXP_REPLACE(v_phone, '[^0-9]', '', 'g');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'gallery_id', v_gallery.id,
    'gallery_name', v_gallery.name,
    'is_locked', v_gallery.is_locked,
    'is_paid', v_gallery.is_paid,
    'price', v_gallery.price,
    'client_id', v_gallery.client_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_gallery_and_link(TEXT) TO authenticated;

-- ============================================================
-- Fix 3: User profile avatar lookup by phone
-- When an admin pre-creates a client by phone, user_id is null.
-- This function returns the user_profiles row for a phone number
-- so avatars can be shown even before formal linking.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_profile_by_phone(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE REGEXP_REPLACE(phone, '[^0-9]', '', 'g') =
        REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'name', v_profile.name,
    'avatar_url', v_profile.avatar_url,
    'phone', v_profile.phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_by_phone(TEXT) TO authenticated;
