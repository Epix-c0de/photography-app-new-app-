-- Enable pgcrypto for gen_random_uuid and gen_random_bytes
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add referral_token column to referrals table
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_token TEXT UNIQUE;

-- Backfill existing rows with unique 12-char URL-safe tokens
UPDATE referrals
SET referral_token = (
  SELECT string_agg(c, '')
  FROM (
    SELECT substr(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
      (abs(hashtext(id::text || clock_timestamp()::text)) % 64) + 1,
      1
    ) AS c
    FROM generate_series(1, 12)
  ) sub
)
WHERE referral_token IS NULL;

-- Create index for fast token lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referral_token ON referrals(referral_token);

-- Create referral_clicks table for analytics
CREATE TABLE IF NOT EXISTS referral_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_token TEXT NOT NULL REFERENCES referrals(referral_token) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  converted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_token ON referral_clicks(referral_token);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_admin ON referral_clicks(admin_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked_at ON referral_clicks(clicked_at);

-- Function to generate a unique 12-char referral token
CREATE OR REPLACE FUNCTION generate_referral_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  result TEXT := '';
  i INT;
  rand_bytes BYTEA;
BEGIN
  rand_bytes := gen_random_bytes(12);
  FOR i IN 0..11 LOOP
    result := result || substr(chars, (get_byte(rand_bytes, i) % 64) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- RPC to mark a referral_click as converted
CREATE OR REPLACE FUNCTION mark_referral_converted(p_referral_token TEXT, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE referral_clicks
  SET converted = true
  WHERE referral_token = p_referral_token
    AND converted = false
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- RPC to get referral analytics for super admin
CREATE OR REPLACE FUNCTION get_referral_analytics()
RETURNS TABLE (
  referral_token TEXT,
  admin_id UUID,
  admin_name TEXT,
  referral_code TEXT,
  total_clicks BIGINT,
  conversions BIGINT,
  conversion_rate NUMERIC,
  first_click_at TIMESTAMPTZ,
  last_click_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.referral_token,
    r.admin_id,
    COALESCE(up.name, 'Unknown') AS admin_name,
    r.referral_code,
    COUNT(rc.id) AS total_clicks,
    COUNT(rc.id) FILTER (WHERE rc.converted = true) AS conversions,
    CASE WHEN COUNT(rc.id) > 0
      THEN ROUND(COUNT(rc.id) FILTER (WHERE rc.converted = true)::NUMERIC / COUNT(rc.id) * 100, 1)
      ELSE 0
    END AS conversion_rate,
    MIN(rc.clicked_at) AS first_click_at,
    MAX(rc.clicked_at) AS last_click_at
  FROM referrals r
  LEFT JOIN referral_clicks rc ON rc.referral_token = r.referral_token
  LEFT JOIN user_profiles up ON up.id = r.admin_id
  GROUP BY r.referral_token, r.admin_id, up.name, r.referral_code
  ORDER BY total_clicks DESC;
END;
$$ LANGUAGE plpgsql;
