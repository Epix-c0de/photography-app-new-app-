-- Nuclear option: drop ALL policies on platform_settings and recreate cleanly
-- This ensures no conflicting/duplicate policies exist

-- Drop all existing policies
DROP POLICY IF EXISTS "super_admin_manage_platform_settings" ON platform_settings;
DROP POLICY IF EXISTS "authenticated_read_platform_settings" ON platform_settings;
DROP POLICY IF EXISTS "Super admins can manage platform settings" ON platform_settings;
DROP POLICY IF EXISTS "Authenticated users can read platform settings" ON platform_settings;
DROP POLICY IF EXISTS "platform_settings_all_policy" ON platform_settings;

-- Recreate: super_admin can do everything
CREATE POLICY "super_admin_manage_platform_settings" ON platform_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Recreate: all authenticated users can read
CREATE POLICY "authenticated_read_platform_settings" ON platform_settings
  FOR SELECT
  USING (auth.role() = 'authenticated');
