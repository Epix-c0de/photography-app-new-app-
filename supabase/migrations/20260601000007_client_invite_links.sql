-- ============================================
-- CLIENT INVITE LINKS SYSTEM
-- ============================================
-- How it works:
--   1. Admin generates an invite link (with optional specific client pre-linking)
--   2. Link format: https://epixvisuals.app/join?ref=ADMIN_ID&invite=TOKEN
--   3. Client opens link → goes to app store → downloads → on first launch the
--      deep link is read by the app
--   4. On signup/login the app calls claim_invite_token(token)
--   5. The function creates/updates the clients record with owner_admin_id = admin_id

CREATE TABLE IF NOT EXISTS client_invite_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT        NOT NULL UNIQUE DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  admin_id        UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  -- Optional: pre-link to a specific existing client record
  client_id       UUID        REFERENCES clients(id) ON DELETE SET NULL,
  -- Optional: note to self about who this was sent to
  label           TEXT,
  -- Track clicks / usage
  click_count     INTEGER     NOT NULL DEFAULT 0,
  claimed_by      UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
  claimed_at      TIMESTAMPTZ,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invite_links_admin  ON client_invite_links(admin_id);
CREATE INDEX IF NOT EXISTS idx_invite_links_token  ON client_invite_links(token);
CREATE INDEX IF NOT EXISTS idx_invite_links_active ON client_invite_links(admin_id, is_active);

-- RLS: admins can manage their own invite links
ALTER TABLE client_invite_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_invites" ON client_invite_links;
DROP POLICY IF EXISTS "public_read_invite_token" ON client_invite_links;

CREATE POLICY "admin_manage_invites" ON client_invite_links
  FOR ALL USING (admin_id = auth.uid());

-- Anyone can read a token to validate it (needed during signup)
CREATE POLICY "public_read_invite_token" ON client_invite_links
  FOR SELECT USING (true);

-- ============================================
-- FUNCTION: claim_invite_token
-- Called by the user app after signup/login when
-- an invite token was captured from the deep link.
-- ============================================
CREATE OR REPLACE FUNCTION claim_invite_token(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite        client_invite_links%ROWTYPE;
  v_user_id       UUID;
  v_client_id     UUID;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the invite
  SELECT * INTO v_invite
  FROM client_invite_links
  WHERE token = p_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND claimed_by IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Token already used, expired, or invalid — still try to link if already claimed by same user
    SELECT * INTO v_invite
    FROM client_invite_links
    WHERE token = p_token AND claimed_by = v_user_id;

    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'admin_id', v_invite.admin_id, 'already_claimed', true);
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite link');
  END IF;

  -- Mark as claimed
  UPDATE client_invite_links
  SET claimed_by = v_user_id, claimed_at = NOW()
  WHERE id = v_invite.id;

  -- Get the user profile to find name/phone
  DECLARE
    v_name  TEXT;
    v_phone TEXT;
    v_email TEXT;
  BEGIN
    SELECT name, phone, email INTO v_name, v_phone, v_email
    FROM user_profiles WHERE id = v_user_id;

    -- If invite has a specific client_id, update that client's user_id
    IF v_invite.client_id IS NOT NULL THEN
      UPDATE clients
      SET user_id = v_user_id
      WHERE id = v_invite.client_id
        AND owner_admin_id = v_invite.admin_id;
      v_client_id := v_invite.client_id;
    ELSE
      -- Check if a clients record already exists for this user under this admin
      SELECT id INTO v_client_id
      FROM clients
      WHERE user_id = v_user_id AND owner_admin_id = v_invite.admin_id;

      IF NOT FOUND THEN
        -- Also check if a client record exists for this user under any admin
        -- (link them to THIS admin)
        SELECT id INTO v_client_id
        FROM clients
        WHERE user_id = v_user_id
        LIMIT 1;

        IF FOUND THEN
          -- Already has a client record under different admin — create new one for this admin
          INSERT INTO clients (owner_admin_id, user_id, name, phone, email)
          VALUES (v_invite.admin_id, v_user_id, COALESCE(v_name, 'Client'), v_phone, v_email)
          ON CONFLICT (owner_admin_id, user_id) DO NOTHING
          RETURNING id INTO v_client_id;
        ELSE
          -- No client record at all — create one
          INSERT INTO clients (owner_admin_id, user_id, name, phone, email)
          VALUES (v_invite.admin_id, v_user_id, COALESCE(v_name, 'Client'), v_phone, v_email)
          RETURNING id INTO v_client_id;
        END IF;
      END IF;
    END IF;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'admin_id', v_invite.admin_id,
    'client_id', v_client_id
  );
END;
$$;

-- ============================================
-- FUNCTION: increment_invite_click
-- Called when anyone opens the invite link
-- (can be called without auth)
-- ============================================
CREATE OR REPLACE FUNCTION increment_invite_click(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE client_invite_links
  SET click_count = click_count + 1
  WHERE token = p_token;
END;
$$;

-- Make it callable without auth
GRANT EXECUTE ON FUNCTION claim_invite_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_invite_click(TEXT) TO anon, authenticated;
