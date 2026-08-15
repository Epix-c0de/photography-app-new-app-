-- Add master admin toggle column
-- Run this in Supabase SQL Editor

-- Add is_master_admin column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_master_admin BOOLEAN DEFAULT FALSE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_master_admin ON user_profiles(is_master_admin) WHERE is_master_admin = TRUE;

-- RLS policy: only super_admins can toggle master admin
-- (Service role bypasses RLS, so this is for dashboard API access)

COMMENT ON COLUMN user_profiles.is_master_admin IS 'Temporary master admin toggle. When true, this admin can see all clients across all photographers. Should be toggled off when not needed.';

-- Optional: Create a function to get all clients for a master admin
CREATE OR REPLACE FUNCTION get_master_admin_clients(master_admin_id UUID)
RETURNS TABLE (
  id UUID,
  phone_number TEXT,
  temporary_name TEXT,
  owner_admin_id UUID,
  registration_status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Check if the admin is a master admin
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = master_admin_id AND is_master_admin = TRUE) THEN
    -- Return all clients
    RETURN QUERY SELECT c.id, c.phone_number, c.temporary_name, c.owner_admin_id, c.registration_status, c.created_at
    FROM clients c;
  ELSE
    -- Return only their own clients
    RETURN QUERY SELECT c.id, c.phone_number, c.temporary_name, c.owner_admin_id, c.registration_status, c.created_at
    FROM clients c WHERE c.owner_admin_id = master_admin_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
