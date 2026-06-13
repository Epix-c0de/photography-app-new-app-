-- Migration: Create analytics queries for unassigned user metrics
-- Task: 26.1 Create analytics queries for unassigned user metrics
-- Requirements: 14.7, 14.8, 14.9, 14.10

-- ============================================
-- UNASSIGNED USER ANALYTICS FUNCTIONS
-- ============================================

-- 1. Query total unassigned users
-- Returns count of users who currently have no photographer assignment
CREATE OR REPLACE FUNCTION public.get_total_unassigned_users()
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT up.id)
    FROM public.user_profiles up
    LEFT JOIN public.clients c ON c.user_id = up.id
    WHERE up.role = 'client'
      AND (c.owner_admin_id IS NULL OR c.id IS NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Query average time_to_assignment
-- Returns average time in seconds from first app open to successful assignment
CREATE OR REPLACE FUNCTION public.get_average_time_to_assignment()
RETURNS TABLE (
  avg_time_seconds NUMERIC,
  avg_time_hours NUMERIC,
  avg_time_days NUMERIC,
  total_assigned_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    AVG(time_to_assignment_seconds)::NUMERIC as avg_time_seconds,
    (AVG(time_to_assignment_seconds) / 3600)::NUMERIC as avg_time_hours,
    (AVG(time_to_assignment_seconds) / 86400)::NUMERIC as avg_time_days,
    COUNT(*)::BIGINT as total_assigned_count
  FROM public.unassigned_user_sessions
  WHERE assigned_at IS NOT NULL
    AND time_to_assignment_seconds IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Query conversion rate per photographer
-- Returns conversion metrics for each photographer showing assignment success
CREATE OR REPLACE FUNCTION public.get_conversion_rate_per_photographer()
RETURNS TABLE (
  photographer_id UUID,
  photographer_name TEXT,
  photographer_code TEXT,
  total_assignments BIGINT,
  successful_assignments BIGINT,
  failed_attempts BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id as photographer_id,
    up.name as photographer_name,
    up.photographer_code,
    COUNT(DISTINCT cal.client_id)::BIGINT as total_assignments,
    COUNT(DISTINCT cal.client_id)::BIGINT as successful_assignments,
    -- Failed attempts tracked in unassigned_user_sessions
    COALESCE((
      SELECT SUM(code_entry_attempts)::BIGINT
      FROM public.unassigned_user_sessions uss
      WHERE uss.assigned_via IS NULL
    ), 0) as failed_attempts,
    -- Conversion rate: successful assignments / total attempts
    CASE 
      WHEN COUNT(DISTINCT cal.client_id) > 0 THEN
        (COUNT(DISTINCT cal.client_id)::NUMERIC / 
         GREATEST(COUNT(DISTINCT cal.client_id)::NUMERIC + COALESCE((
           SELECT SUM(code_entry_attempts)::NUMERIC
           FROM public.unassigned_user_sessions uss2
           WHERE uss2.assigned_via IS NULL
         ), 0), 1)) * 100
      ELSE 0
    END as conversion_rate
  FROM public.user_profiles up
  LEFT JOIN public.client_assignment_log cal ON cal.admin_id = up.id
  WHERE up.role IN ('admin', 'super_admin')
    AND up.photographer_code IS NOT NULL
  GROUP BY up.id, up.name, up.photographer_code
  ORDER BY total_assignments DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Query top viewed content
-- Returns most viewed BTS posts and announcements by unassigned users
CREATE OR REPLACE FUNCTION public.get_top_viewed_content(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  content_type TEXT,
  content_id TEXT,
  view_count BIGINT,
  title TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  -- Get BTS post views
  WITH bts_views AS (
    SELECT 
      'bts' as content_type,
      jsonb_array_elements_text(content_views->'bts') as content_id,
      COUNT(*) as view_count
    FROM public.unassigned_user_sessions
    WHERE content_views->'bts' IS NOT NULL
    GROUP BY jsonb_array_elements_text(content_views->'bts')
  ),
  announcement_views AS (
    SELECT 
      'announcement' as content_type,
      jsonb_array_elements_text(content_views->'announcements') as content_id,
      COUNT(*) as view_count
    FROM public.unassigned_user_sessions
    WHERE content_views->'announcements' IS NOT NULL
    GROUP BY jsonb_array_elements_text(content_views->'announcements')
  ),
  combined_views AS (
    SELECT * FROM bts_views
    UNION ALL
    SELECT * FROM announcement_views
  )
  SELECT 
    cv.content_type,
    cv.content_id,
    cv.view_count::BIGINT,
    COALESCE(bp.title, ann.title, 'Unknown') as title,
    COALESCE(bp.created_at, ann.created_at) as created_at
  FROM combined_views cv
  LEFT JOIN public.bts_posts bp ON cv.content_id = bp.id::TEXT AND cv.content_type = 'bts'
  LEFT JOIN public.announcements ann ON cv.content_id = ann.id::TEXT AND cv.content_type = 'announcement'
  ORDER BY cv.view_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Query assignment source distribution
-- Returns breakdown of how users are getting assigned (code_entry, qr_scan, invite_link, admin_invite)
CREATE OR REPLACE FUNCTION public.get_assignment_source_distribution()
RETURNS TABLE (
  assigned_via TEXT,
  assignment_count BIGINT,
  percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH assignment_totals AS (
    SELECT 
      uss.assigned_via,
      COUNT(*)::BIGINT as assignment_count
    FROM public.unassigned_user_sessions uss
    WHERE uss.assigned_via IS NOT NULL
    GROUP BY uss.assigned_via
  ),
  total_assignments AS (
    SELECT SUM(assignment_count) as total FROM assignment_totals
  )
  SELECT 
    at.assigned_via,
    at.assignment_count,
    CASE 
      WHEN ta.total > 0 THEN (at.assignment_count::NUMERIC / ta.total::NUMERIC * 100)
      ELSE 0
    END as percentage
  FROM assignment_totals at
  CROSS JOIN total_assignments ta
  ORDER BY at.assignment_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Query failed attempt counts
-- Returns statistics about failed photographer code entry attempts
CREATE OR REPLACE FUNCTION public.get_failed_attempt_statistics()
RETURNS TABLE (
  total_failed_sessions BIGINT,
  total_failed_attempts BIGINT,
  avg_attempts_per_session NUMERIC,
  sessions_with_1_attempt BIGINT,
  sessions_with_2_3_attempts BIGINT,
  sessions_with_4_plus_attempts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total sessions that never got assigned (failed)
    COUNT(*)::BIGINT as total_failed_sessions,
    -- Total code entry attempts across all failed sessions
    SUM(code_entry_attempts)::BIGINT as total_failed_attempts,
    -- Average attempts per failed session
    AVG(code_entry_attempts)::NUMERIC as avg_attempts_per_session,
    -- Sessions with exactly 1 attempt
    COUNT(CASE WHEN code_entry_attempts = 1 THEN 1 END)::BIGINT as sessions_with_1_attempt,
    -- Sessions with 2-3 attempts
    COUNT(CASE WHEN code_entry_attempts BETWEEN 2 AND 3 THEN 1 END)::BIGINT as sessions_with_2_3_attempts,
    -- Sessions with 4 or more attempts
    COUNT(CASE WHEN code_entry_attempts >= 4 THEN 1 END)::BIGINT as sessions_with_4_plus_attempts
  FROM public.unassigned_user_sessions
  WHERE assigned_at IS NULL
    AND code_entry_attempts > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Comprehensive analytics dashboard query
-- Returns all key metrics in one call for dashboard display
CREATE OR REPLACE FUNCTION public.get_unassigned_user_analytics_summary()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total_unassigned BIGINT;
  v_avg_time_record RECORD;
  v_source_distribution JSONB;
  v_failed_stats RECORD;
BEGIN
  -- Get total unassigned users
  SELECT public.get_total_unassigned_users() INTO v_total_unassigned;
  
  -- Get average time to assignment
  SELECT * INTO v_avg_time_record FROM public.get_average_time_to_assignment();
  
  -- Get assignment source distribution as JSON
  SELECT jsonb_agg(row_to_json(t)) INTO v_source_distribution
  FROM public.get_assignment_source_distribution() t;
  
  -- Get failed attempt statistics
  SELECT * INTO v_failed_stats FROM public.get_failed_attempt_statistics();
  
  -- Build comprehensive result
  v_result := jsonb_build_object(
    'total_unassigned_users', v_total_unassigned,
    'average_time_to_assignment', jsonb_build_object(
      'seconds', v_avg_time_record.avg_time_seconds,
      'hours', v_avg_time_record.avg_time_hours,
      'days', v_avg_time_record.avg_time_days,
      'total_assigned', v_avg_time_record.total_assigned_count
    ),
    'assignment_source_distribution', COALESCE(v_source_distribution, '[]'::jsonb),
    'failed_attempts', jsonb_build_object(
      'total_failed_sessions', v_failed_stats.total_failed_sessions,
      'total_failed_attempts', v_failed_stats.total_failed_attempts,
      'avg_attempts_per_session', v_failed_stats.avg_attempts_per_session,
      'sessions_with_1_attempt', v_failed_stats.sessions_with_1_attempt,
      'sessions_with_2_3_attempts', v_failed_stats.sessions_with_2_3_attempts,
      'sessions_with_4_plus_attempts', v_failed_stats.sessions_with_4_plus_attempts
    )
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant execute permissions to authenticated users (will be restricted by RLS)
GRANT EXECUTE ON FUNCTION public.get_total_unassigned_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_average_time_to_assignment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversion_rate_per_photographer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_viewed_content(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_source_distribution() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_failed_attempt_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unassigned_user_analytics_summary() TO authenticated;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION public.get_total_unassigned_users() IS 
  'Returns the count of users who currently have no photographer assignment';

COMMENT ON FUNCTION public.get_average_time_to_assignment() IS 
  'Returns average time from first app open to successful photographer assignment';

COMMENT ON FUNCTION public.get_conversion_rate_per_photographer() IS 
  'Returns conversion metrics for each photographer showing assignment success rates';

COMMENT ON FUNCTION public.get_top_viewed_content(INTEGER) IS 
  'Returns most viewed BTS posts and announcements by unassigned users';

COMMENT ON FUNCTION public.get_assignment_source_distribution() IS 
  'Returns breakdown of assignment methods (code_entry, qr_scan, invite_link, admin_invite)';

COMMENT ON FUNCTION public.get_failed_attempt_statistics() IS 
  'Returns statistics about failed photographer code entry attempts';

COMMENT ON FUNCTION public.get_unassigned_user_analytics_summary() IS 
  'Returns comprehensive analytics summary combining all key metrics for dashboard display';
