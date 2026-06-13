-- ============================================
-- AUTO ASSIGN ON LOGIN FUNCTION
-- Part of: Unassigned Users and Security Features
-- Task: 2.1 Create auto_assign_on_login RPC function
-- Requirements: 3.3, 3.4
-- ============================================

-- Create function to auto-assign user if their mobile matches an existing client record
CREATE OR REPLACE FUNCTION auto_assign_on_login(
  p_user_id UUID,
  p_mobile_number TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_client_id UUID;
  v_admin_id UUID;
  v_admin_name TEXT;
  v_photographer_code TEXT;
BEGIN
  -- Find client record by mobile number where user_id is NULL (not yet assigned to a user)
  SELECT id, owner_admin_id INTO v_client_id, v_admin_id
  FROM clients
  WHERE mobile_number = p_mobile_number
    AND user_id IS NULL
  LIMIT 1;
  
  -- If no matching client record found, return unsuccessful
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'auto_assigned', false
    );
  END IF;
  
  -- Update client record with user_id to link user to this client
  UPDATE clients
  SET user_id = p_user_id, 
      updated_at = NOW()
  WHERE id = v_client_id;
  
  -- Get admin name and photographer code for response
  SELECT name, photographer_code 
  INTO v_admin_name, v_photographer_code
  FROM user_profiles
  WHERE id = v_admin_id;
  
  -- Log assignment in client_assignment_log with assigned_via='admin_invite'
  INSERT INTO client_assignment_log (
    client_id, 
    admin_id, 
    photographer_code, 
    assigned_via
  )
  VALUES (
    p_user_id, 
    v_admin_id, 
    v_photographer_code, 
    'admin_invite'
  );
  
  -- Return success with assignment details
  RETURN jsonb_build_object(
    'success', true,
    'auto_assigned', true,
    'admin_id', v_admin_id,
    'admin_name', v_admin_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auto_assign_on_login(UUID, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION auto_assign_on_login IS 
  'Auto-assigns user to photographer when login mobile number matches a client record created by admin. 
   Returns JSONB with success, auto_assigned flags, admin_id, and admin_name.
   Logs assignment in client_assignment_log with assigned_via=''admin_invite''.';
