-- NUCLEAR FIX: Recreate platform_settings RLS + seed platform_domain
-- Run this in Supabase SQL Editor

-- 1. Drop ALL policies on platform_settings
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'platform_settings' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON platform_settings', pol.policyname);
  END LOOP;
END $$;

-- 2. Create ONE simple policy: authenticated users can read, super_admin can write
CREATE POLICY "platform_settings_select" ON platform_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "platform_settings_super_admin_all" ON platform_settings
  FOR ALL USING (
    auth.uid() IN (
      SELECT up.id FROM user_profiles up WHERE up.role = 'super_admin'
    )
  );

-- 3. Seed platform_domain (the key that ALL share links depend on)
INSERT INTO platform_settings (key, value, updated_at)
VALUES ('platform_domain', 'https://epixvisuals.co.ke', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- 4. Seed other commonly used keys
INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('platform_admin_app_android_link', '', NOW()),
  ('platform_admin_app_ios_link', '', NOW()),
  ('platform_app_android_link', '', NOW()),
  ('platform_app_ios_link', '', NOW()),
  ('platform_deep_link_scheme', 'epixvisuals', NOW()),
  ('platform_photographer_signup_url', 'https://join.epixvisuals.co', NOW())
ON CONFLICT (key) DO NOTHING;

-- 5. Verify
SELECT key, value FROM platform_settings ORDER BY key;
