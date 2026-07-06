-- Grant free lifetime access to epixshots001@gmail.com
-- This allows the admin to use all features including posting without paying

-- Option 1: Set lifetime access (recommended)
UPDATE user_profiles 
SET 
  is_lifetime = true,
  subscription_status = 'active',
  subscription_expires_at = NULL,
  updated_at = NOW()
WHERE email = 'epixshots001@gmail.com';

-- Option 2: If the above doesn't match, try by user_id from auth.users
-- UPDATE user_profiles 
-- SET 
--   is_lifetime = true,
--   subscription_status = 'active',
--   subscription_expires_at = NULL,
--   updated_at = NOW()
-- WHERE id = (
--   SELECT id FROM auth.users WHERE email = 'epixshots001@gmail.com' LIMIT 1
-- );

-- Verify the update
SELECT 
  id,
  email,
  name,
  role,
  is_lifetime,
  subscription_status,
  subscription_expires_at
FROM user_profiles 
WHERE email = 'epixshots001@gmail.com';

-- Also ensure the admin can post BTS/announcements without payment checks
-- This function bypasses payment verification for lifetime users
CREATE OR REPLACE FUNCTION check_admin_post_access(p_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_lifetime BOOLEAN;
  v_subscription_status TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT 
    is_lifetime, 
    subscription_status,
    subscription_expires_at
  INTO v_is_lifetime, v_subscription_status, v_expires_at
  FROM user_profiles
  WHERE id = p_admin_id;
  
  -- Lifetime users can always post
  IF v_is_lifetime = true THEN
    RETURN TRUE;
  END IF;
  
  -- Active subscription users can post
  IF v_subscription_status = 'active' AND 
     (v_expires_at IS NULL OR v_expires_at > NOW()) THEN
    RETURN TRUE;
  END IF;
  
  -- Super admins can always post
  IF EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = p_admin_id AND role = 'super_admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;