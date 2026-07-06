-- RPC function to get photographer info by code for the join landing page
-- Used by the web landing page at /join/{code}
CREATE OR REPLACE FUNCTION get_photographer_by_code(p_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT,
  tagline TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id,
    up.name,
    up.avatar_url,
    bs.tagline
  FROM user_profiles up
  LEFT JOIN brand_settings bs ON bs.admin_id = up.id
  WHERE up.photographer_code = UPPER(p_code)
    AND up.role IN ('admin', 'super_admin');
END;
$$;
