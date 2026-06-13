-- ============================================
-- PHOTOGRAPHER CODES & CLIENT ASSIGNMENT
-- Solves: Unassociated client problem
-- Created: 2026-06-02
-- ============================================

-- 1. Add photographer_code to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS photographer_code TEXT UNIQUE;

-- 2. Generate unique codes for existing admins
UPDATE user_profiles 
SET photographer_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT), 1, 8))
WHERE role IN ('admin', 'super_admin') 
AND photographer_code IS NULL;

-- 3. Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_photographer_code ON user_profiles(photographer_code);

-- 4. Create function to validate photographer code
CREATE OR REPLACE FUNCTION validate_photographer_code(p_code TEXT)
RETURNS TABLE (
  admin_id UUID,
  admin_name TEXT,
  admin_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id as admin_id,
    name as admin_name,
    email as admin_email
  FROM user_profiles
  WHERE photographer_code = UPPER(p_code)
    AND role IN ('admin', 'super_admin')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to assign client to photographer
CREATE OR REPLACE FUNCTION assign_client_to_photographer(
  p_client_id UUID,
  p_photographer_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_admin_name TEXT;
BEGIN
  -- Validate photographer code
  SELECT admin_id, admin_name INTO v_admin_id, v_admin_name
  FROM validate_photographer_code(p_photographer_code);
  
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid photographer code'
    );
  END IF;
  
  -- Update client record in clients table
  UPDATE clients
  SET owner_admin_id = v_admin_id
  WHERE user_id = p_client_id;
  
  -- If no client record exists, create one
  IF NOT FOUND THEN
    INSERT INTO clients (user_id, owner_admin_id)
    VALUES (p_client_id, v_admin_id)
    ON CONFLICT (user_id) DO UPDATE
    SET owner_admin_id = v_admin_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'admin_id', v_admin_id,
    'admin_name', v_admin_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create client_assignment_log table for tracking
CREATE TABLE IF NOT EXISTS client_assignment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  photographer_code TEXT NOT NULL,
  assigned_via TEXT CHECK (assigned_via IN ('code_entry', 'qr_scan', 'invite_link', 'admin_invite')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_assignment_client ON client_assignment_log(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assignment_admin ON client_assignment_log(admin_id);

-- 7. RLS for client_assignment_log
ALTER TABLE client_assignment_log ENABLE ROW LEVEL SECURITY;

-- Admins can see their own assignments
DROP POLICY IF EXISTS "admins_view_own_assignments" ON client_assignment_log;
CREATE POLICY "admins_view_own_assignments" ON client_assignment_log
  FOR SELECT USING (
    admin_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- 8. Function to check if client needs assignment
CREATE OR REPLACE FUNCTION client_needs_assignment(p_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM clients
    WHERE user_id = p_client_id
    AND owner_admin_id IS NOT NULL
  ) INTO v_has_admin;
  
  RETURN NOT v_has_admin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Add trigger to log assignments
CREATE OR REPLACE FUNCTION log_client_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_admin_id IS NOT NULL AND (OLD.owner_admin_id IS NULL OR OLD.owner_admin_id != NEW.owner_admin_id) THEN
    INSERT INTO client_assignment_log (client_id, admin_id, photographer_code, assigned_via)
    SELECT 
      NEW.user_id,
      NEW.owner_admin_id,
      up.photographer_code,
      'code_entry'
    FROM user_profiles up
    WHERE up.id = NEW.owner_admin_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_client_assignment ON clients;
CREATE TRIGGER trigger_log_client_assignment
  AFTER UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION log_client_assignment();

-- 10. Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_photographer_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_client_to_photographer(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION client_needs_assignment(UUID) TO authenticated;
