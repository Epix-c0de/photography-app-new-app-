-- ============================================
-- PHASE 2: ADMIN SUBSCRIPTION SYSTEM
-- ============================================

-- 1. Add subscription columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_lifetime BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- 2. Admin subscriptions payment history table
CREATE TABLE IF NOT EXISTS admin_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id              UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount                INTEGER NOT NULL DEFAULT 500,
  currency              TEXT NOT NULL DEFAULT 'KES',
  mpesa_transaction_id  TEXT,
  checkout_request_id   TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',
  -- pending | success | failed | cancelled
  period_start          TIMESTAMPTZ,
  period_end            TIMESTAMPTZ,
  phone_number          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_admin_id
  ON admin_subscriptions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_checkout_request_id
  ON admin_subscriptions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_status
  ON admin_subscriptions(status);

-- 3. Admin audit log table (referenced by settings screen)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  metadata      JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id
  ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON admin_audit_log(created_at DESC);

-- 4. RLS policies for admin_subscriptions
ALTER TABLE admin_subscriptions ENABLE ROW LEVEL SECURITY;

-- Admins can only see their own subscription records
DROP POLICY IF EXISTS "Admins can view own subscriptions" ON admin_subscriptions;
CREATE POLICY "Admins can view own subscriptions"
  ON admin_subscriptions FOR SELECT
  TO authenticated
  USING (admin_id = auth.uid());

-- Only service role (Edge Functions) can insert/update subscriptions
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON admin_subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON admin_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. RLS policies for admin_audit_log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view own audit log" ON admin_audit_log;
CREATE POLICY "Admins can view own audit log"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage audit log" ON admin_audit_log;
CREATE POLICY "Service role can manage audit log"
  ON admin_audit_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow admins to insert their own audit entries
DROP POLICY IF EXISTS "Admins can insert own audit entries" ON admin_audit_log;
CREATE POLICY "Admins can insert own audit entries"
  ON admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (admin_id = auth.uid());

-- 6. Helper function: check if an admin's subscription is active
CREATE OR REPLACE FUNCTION is_admin_subscription_active(p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_is_lifetime BOOLEAN;
  v_status TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT role, is_lifetime, subscription_status, subscription_expires_at
  INTO v_role, v_is_lifetime, v_status, v_expires_at
  FROM user_profiles
  WHERE id = p_admin_id;

  -- super_admin is always active
  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- lifetime accounts never expire
  IF v_is_lifetime = true THEN
    RETURN true;
  END IF;

  -- check active status and expiry
  IF v_status = 'active' AND v_expires_at > NOW() THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 7. Function: activate subscription after successful payment
CREATE OR REPLACE FUNCTION activate_admin_subscription(
  p_admin_id UUID,
  p_checkout_request_id TEXT,
  p_mpesa_transaction_id TEXT,
  p_amount INTEGER DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end   TIMESTAMPTZ;
  v_sub_id       UUID;
BEGIN
  v_period_start := NOW();
  v_period_end   := NOW() + INTERVAL '30 days';

  -- Update the pending subscription record
  UPDATE admin_subscriptions
  SET
    status               = 'success',
    mpesa_transaction_id = p_mpesa_transaction_id,
    period_start         = v_period_start,
    period_end           = v_period_end,
    updated_at           = NOW()
  WHERE checkout_request_id = p_checkout_request_id
    AND admin_id = p_admin_id
    AND status = 'pending'
  RETURNING id INTO v_sub_id;

  -- Activate the admin's account
  UPDATE user_profiles
  SET
    subscription_status     = 'active',
    subscription_expires_at = v_period_end
  WHERE id = p_admin_id;

  -- Log the activation
  INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, metadata)
  VALUES (
    p_admin_id,
    'subscription_activated',
    'admin_subscriptions',
    v_sub_id::text,
    jsonb_build_object(
      'amount', p_amount,
      'period_start', v_period_start,
      'period_end', v_period_end,
      'mpesa_transaction_id', p_mpesa_transaction_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'expires_at', v_period_end
  );
END;
$$;

-- 8. Set super admin as lifetime (run after migration)
-- Replace with your actual super admin email if different
UPDATE user_profiles
SET
  role                    = 'super_admin',
  subscription_status     = 'active',
  subscription_expires_at = '2099-12-31 23:59:59+00',
  is_lifetime             = true
WHERE email = 'epixshots002@gmail.com';

-- 9. Set all existing admins to active with 30-day grace period
-- (so existing admins aren't immediately locked out)
UPDATE user_profiles
SET
  subscription_status     = 'active',
  subscription_expires_at = NOW() + INTERVAL '30 days'
WHERE role IN ('admin', 'super_admin')
  AND subscription_status = 'inactive';
