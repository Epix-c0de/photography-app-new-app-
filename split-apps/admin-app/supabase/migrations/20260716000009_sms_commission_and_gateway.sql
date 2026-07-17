-- Migration: Add SMS commission setting to platform_settings
-- Run this in Supabase SQL Editor

-- Seed sms_commission_percent setting (default 5%)
INSERT INTO platform_settings (key, value)
VALUES ('sms_commission_percent', '5')
ON CONFLICT (key) DO NOTHING;

-- Seed africastalking_username if not set
INSERT INTO platform_settings (key, value)
VALUES ('africastalking_username', 'epixvisuals')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE platform_settings IS 'Platform-wide settings including SMS gateway config and super admin commission rate';
