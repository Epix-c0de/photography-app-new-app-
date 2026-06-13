-- ============================================
-- SUPER ADMIN FEATURES MIGRATION
-- Created: 2026-06-02
-- ============================================

-- 1. Fraud Flags Table
CREATE TABLE IF NOT EXISTS fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES user_profiles(id),
  flag_type TEXT NOT NULL CHECK (flag_type IN ('suspicious_activity', 'payment_fraud', 'content_violation', 'spam', 'impersonation', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES user_profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_user ON fraud_flags(flagged_user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_status ON fraud_flags(status);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_severity ON fraud_flags(severity);

ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_manage_flags" ON fraud_flags;
CREATE POLICY "super_admin_manage_flags" ON fraud_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- 2. Platform Payment Settings Table
CREATE TABLE IF NOT EXISTS platform_payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mpesa_consumer_key TEXT,
  mpesa_consumer_secret TEXT,
  mpesa_passkey TEXT,
  mpesa_shortcode TEXT,
  mpesa_type TEXT CHECK (mpesa_type IN ('paybill', 'till')),
  mpesa_account_reference TEXT,
  subscription_monthly_price DECIMAL(10,2) NOT NULL DEFAULT 500.00,
  subscription_quarterly_price DECIMAL(10,2) NOT NULL DEFAULT 1350.00,
  subscription_annual_price DECIMAL(10,2) NOT NULL DEFAULT 4800.00,
  lifetime_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  platform_commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  payment_gateway TEXT DEFAULT 'mpesa' CHECK (payment_gateway IN ('mpesa', 'stripe', 'paystack')),
  test_mode BOOLEAN NOT NULL DEFAULT TRUE,
  payment_success_webhook_url TEXT,
  payment_failed_webhook_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES user_profiles(id)
);

-- Insert default settings
INSERT INTO platform_payment_settings (id) 
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

ALTER TABLE platform_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_manage_payment_settings" ON platform_payment_settings;
CREATE POLICY "super_admin_manage_payment_settings" ON platform_payment_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- 3. Add Links to Platform Settings
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS admin_app_url TEXT DEFAULT 'https://admin.epixvisuals.app';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS client_app_url TEXT DEFAULT 'https://app.epixvisuals.app';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS admin_onboarding_url TEXT DEFAULT 'https://join.epixvisuals.app';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS deep_link_scheme TEXT DEFAULT 'epix-visuals';

-- 4. Storage Metrics Function
CREATE OR REPLACE FUNCTION get_photographer_storage_metrics(p_admin_id UUID)
RETURNS TABLE (
  total_photos BIGINT,
  total_storage_bytes BIGINT,
  gallery_count BIGINT,
  avg_photo_size_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(gp.id)::BIGINT as total_photos,
    COALESCE(SUM(gp.file_size), 0)::BIGINT as total_storage_bytes,
    COUNT(DISTINCT g.id)::BIGINT as gallery_count,
    CASE WHEN COUNT(gp.id) > 0 
      THEN (COALESCE(SUM(gp.file_size), 0) / COUNT(gp.id))::BIGINT
      ELSE 0 
    END as avg_photo_size_bytes
  FROM galleries g
  LEFT JOIN gallery_photos gp ON gp.gallery_id = g.id
  WHERE g.owner_admin_id = p_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fraud Detection Function
CREATE OR REPLACE FUNCTION detect_fraud_patterns()
RETURNS TABLE (
  user_id UUID,
  pattern_type TEXT,
  severity TEXT,
  details JSONB
) AS $$
BEGIN
  -- Pattern 1: Multiple failed payment attempts
  RETURN QUERY
  SELECT 
    up.id as user_id,
    'multiple_failed_payments'::TEXT as pattern_type,
    'medium'::TEXT as severity,
    jsonb_build_object(
      'failed_count', COUNT(*),
      'last_attempt', MAX(subs.created_at)
    ) as details
  FROM user_profiles up
  JOIN admin_subscriptions subs ON subs.admin_id = up.id
  WHERE subs.status = 'failed'
    AND subs.created_at > NOW() - INTERVAL '7 days'
  GROUP BY up.id
  HAVING COUNT(*) >= 3;

  -- Pattern 2: Excessive storage usage without payment
  RETURN QUERY
  SELECT 
    g.owner_admin_id as user_id,
    'excessive_storage_no_payment'::TEXT as pattern_type,
    'high'::TEXT as severity,
    jsonb_build_object(
      'storage_gb', SUM(gp.file_size) / 1024.0 / 1024.0 / 1024.0,
      'gallery_count', COUNT(DISTINCT g.id)
    ) as details
  FROM galleries g
  JOIN gallery_photos gp ON gp.gallery_id = g.id
  JOIN user_profiles up ON up.id = g.owner_admin_id
  WHERE up.subscription_status != 'active'
    AND up.is_lifetime = FALSE
  GROUP BY g.owner_admin_id
  HAVING SUM(gp.file_size) > 5368709120; -- 5GB

  -- Pattern 3: Suspicious upload patterns
  RETURN QUERY
  SELECT 
    g.owner_admin_id as user_id,
    'suspicious_uploads'::TEXT as pattern_type,
    'medium'::TEXT as severity,
    jsonb_build_object(
      'galleries_24h', COUNT(DISTINCT g.id),
      'photos_24h', COUNT(gp.id)
    ) as details
  FROM galleries g
  JOIN gallery_photos gp ON gp.gallery_id = g.id
  WHERE g.created_at > NOW() - INTERVAL '24 hours'
  GROUP BY g.owner_admin_id
  HAVING COUNT(DISTINCT g.id) > 20 OR COUNT(gp.id) > 500;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Revenue Pipeline View
CREATE OR REPLACE VIEW revenue_pipeline AS
SELECT 
  DATE_TRUNC('month', subs.created_at) as month,
  'subscription' as revenue_type,
  COUNT(DISTINCT subs.admin_id) as transaction_count,
  SUM(subs.amount) as gross_revenue,
  SUM(subs.amount) as net_revenue,
  NULL::TEXT as payment_method  -- placeholder; admin_subscriptions has no payment_method column
FROM admin_subscriptions subs
WHERE subs.status = 'success'
GROUP BY month;

-- 7. Revenue Metrics Function
CREATE OR REPLACE FUNCTION get_revenue_metrics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '12 months',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_revenue DECIMAL,
  subscription_revenue DECIMAL,
  commission_revenue DECIMAL,
  transaction_count BIGINT,
  avg_transaction_value DECIMAL,
  month_over_month_growth DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT 
      COALESCE(SUM(net_revenue), 0) as total_rev,
      COALESCE(SUM(CASE WHEN revenue_type = 'subscription' THEN net_revenue ELSE 0 END), 0) as sub_rev,
      0::DECIMAL as comm_rev,
      COUNT(*) as txn_count
    FROM revenue_pipeline
    WHERE month BETWEEN p_start_date AND p_end_date
  ),
  previous_period AS (
    SELECT COALESCE(SUM(net_revenue), 0) as total_rev
    FROM revenue_pipeline
    WHERE month BETWEEN p_start_date - (p_end_date - p_start_date) AND p_start_date
  )
  SELECT 
    cp.total_rev::DECIMAL,
    cp.sub_rev::DECIMAL,
    cp.comm_rev::DECIMAL,
    cp.txn_count::BIGINT,
    CASE WHEN cp.txn_count > 0 THEN (cp.total_rev / cp.txn_count)::DECIMAL ELSE 0 END,
    CASE WHEN pp.total_rev > 0 THEN ((cp.total_rev - pp.total_rev) / pp.total_rev * 100)::DECIMAL ELSE 0 END
  FROM current_period cp, previous_period pp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
