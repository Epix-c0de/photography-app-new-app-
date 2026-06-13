-- ============================================
-- USER PROFILES SECURITY COLUMNS
-- Adds security settings columns for authentication features
-- Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
-- Created: 2026-06-02
-- ============================================

-- 1. Add security-related columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pin_hash TEXT DEFAULT NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_password_change_reminder TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS "2fa_enabled" BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS "2fa_secret" TEXT DEFAULT NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS "2fa_backup_codes" TEXT[] DEFAULT NULL;

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_biometric ON user_profiles(biometric_enabled) WHERE biometric_enabled = true;
CREATE INDEX IF NOT EXISTS idx_user_profiles_pin ON user_profiles(id) WHERE pin_hash IS NOT NULL;

-- 3. Create function to sync password_changed_at when auth.users password changes
CREATE OR REPLACE FUNCTION sync_password_changed_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- When auth.users password changes, update user_profiles
  UPDATE user_profiles
  SET password_changed_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger on auth.users for password change tracking
DROP TRIGGER IF EXISTS trigger_sync_password_changed ON auth.users;
CREATE TRIGGER trigger_sync_password_changed
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  WHEN (OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password)
  EXECUTE FUNCTION sync_password_changed_timestamp();

-- 5. Create function to update biometric setting
CREATE OR REPLACE FUNCTION update_biometric_setting(p_enabled BOOLEAN)
RETURNS JSONB AS $$
BEGIN
  UPDATE user_profiles
  SET biometric_enabled = p_enabled
  WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Log the change
  INSERT INTO admin_audit_log (admin_id, action, description)
  VALUES (auth.uid(), 'biometric_toggle', 
          CASE WHEN p_enabled THEN 'Enabled biometric auth' ELSE 'Disabled biometric auth' END);
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create function to set PIN hash
CREATE OR REPLACE FUNCTION set_pin_hash(p_pin_hash TEXT)
RETURNS JSONB AS $$
BEGIN
  UPDATE user_profiles
  SET pin_hash = p_pin_hash
  WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Log the change
  INSERT INTO admin_audit_log (admin_id, action, description)
  VALUES (auth.uid(), 'pin_set', 'User set/updated PIN lock');
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create function to remove PIN lock
CREATE OR REPLACE FUNCTION remove_pin_lock()
RETURNS JSONB AS $$
BEGIN
  UPDATE user_profiles
  SET pin_hash = NULL
  WHERE id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  INSERT INTO admin_audit_log (admin_id, action, description)
  VALUES (auth.uid(), 'pin_removed', 'User removed PIN lock');
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update RLS policies to allow users to update their own security settings
DROP POLICY IF EXISTS "users_update_own_security_settings" ON user_profiles;
CREATE POLICY "users_update_own_security_settings" ON user_profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 9. Grant execute permissions on security functions
GRANT EXECUTE ON FUNCTION update_biometric_setting(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION set_pin_hash(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_pin_lock() TO authenticated;

-- 10. Add comment to document security columns
COMMENT ON COLUMN user_profiles.biometric_enabled IS 'Whether biometric authentication (Face ID/Fingerprint) is enabled for this user';
COMMENT ON COLUMN user_profiles.pin_hash IS 'SHA-256 hash of user 6-digit PIN for app lock';
COMMENT ON COLUMN user_profiles.password_changed_at IS 'Timestamp of last password change';
COMMENT ON COLUMN user_profiles.last_password_change_reminder IS 'Timestamp of last password change reminder sent to user';
COMMENT ON COLUMN user_profiles."2fa_enabled" IS 'Whether two-factor authentication is enabled (coming soon feature)';
COMMENT ON COLUMN user_profiles."2fa_secret" IS 'TOTP secret for two-factor authentication';
COMMENT ON COLUMN user_profiles."2fa_backup_codes" IS 'Array of backup codes for 2FA recovery';
