-- ============================================
-- WEB LOGIN APPROVAL SYSTEM
-- Admins must approve web dashboard logins from their mobile app
-- ============================================

CREATE TABLE IF NOT EXISTS web_login_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,          -- random 32-char token
  otp_verified  BOOLEAN NOT NULL DEFAULT false, -- email OTP confirmed
  status        TEXT NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected | expired
  device_info   TEXT,                           -- browser/OS info
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  approved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_web_login_requests_admin_id
  ON web_login_requests(admin_id);
CREATE INDEX IF NOT EXISTS idx_web_login_requests_token
  ON web_login_requests(token);
CREATE INDEX IF NOT EXISTS idx_web_login_requests_status
  ON web_login_requests(status);

-- RLS
ALTER TABLE web_login_requests ENABLE ROW LEVEL SECURITY;

-- Admins can see their own pending requests (for the mobile app approval screen)
DROP POLICY IF EXISTS "Admins can view own login requests" ON web_login_requests;
CREATE POLICY "Admins can view own login requests"
  ON web_login_requests FOR SELECT
  TO authenticated
  USING (admin_id = auth.uid());

-- Admins can update (approve/reject) their own requests
DROP POLICY IF EXISTS "Admins can update own login requests" ON web_login_requests;
CREATE POLICY "Admins can update own login requests"
  ON web_login_requests FOR UPDATE
  TO authenticated
  USING (admin_id = auth.uid());

-- Service role manages everything
DROP POLICY IF EXISTS "Service role manages login requests" ON web_login_requests;
CREATE POLICY "Service role manages login requests"
  ON web_login_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-expire old requests (cleanup function)
CREATE OR REPLACE FUNCTION cleanup_expired_login_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE web_login_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$;
