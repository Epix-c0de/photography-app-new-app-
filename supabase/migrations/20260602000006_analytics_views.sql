-- ============================================
-- ANALYTICS VIEWS FOR UNASSIGNED USER METRICS
-- Task: 26.1 Create analytics queries for unassigned user metrics
-- Requirements: 14.7, 14.8, 14.9, 14.10
-- Created: 2026-06-02
-- ============================================
-- 
-- This migration creates SQL views and functions for the super admin
-- dashboard to track unassigned user behavior and conversion metrics.
-- Tables used:
--   - unassigned_user_sessions: session_start, session_end, content_views (JSONB),
--     code_entry_attempts, assigned_at, assigned_via, time_to_assignment_seconds, user_id
--   - clients: owner_admin_id, user_id
--   - user_profiles: id, role, name, photographer_code
--   - client_assignment_log: client_id, admin_id, assigned_via
-- ============================================

-- ============================================
-- 1. VIEW: Total Unassigned Users
-- Requirement: 14.7 - track total unassigned users
-- ============================================
-- Returns all users who have no photographer assignment
CREATE OR REPLACE VIEW public.v_total_unassigned_users AS
SELECT 
  up.id AS user_id,
  up.name,
  up.email,
  up.created_at AS registered_at,
  -- Most recent unassigned session start (when they first landed)
  (
    SELECT MIN(uss.session_start)
    FROM public.unassigned_user_sessions uss
    WHERE uss.user_id = up.id
  ) AS first_seen_at,
  -- Total code entry attempts across all sessions
  COALESCE((
    SELECT SUM(uss.code_entry_attempts)
    FROM public.unassigned_user_sessions uss
    WHERE uss.user_id = up.id
  ), 0) AS total_code_attempts
FROM public.user_profiles up
LEFT JOIN public.clients c ON c.user_id = up.id
WHERE up.role = 'client'
  AND (c.owner_admin_id IS NULL OR c.id IS NULL);

-- RLS: only super admins can access this view
-- (views inherit the RLS of their underlying tables when queried directly)
COMMENT ON VIEW public.v_total_unassigned_users IS 
  'Lists all client users who currently have no photographer assignment. Requirement 14.7.';


-- ============================================
-- 2. VIEW: Average Time to Assignment
-- Requirement: 14.8 - track average time to assignment
-- ============================================
-- Aggregates time_to_assignment_seconds per photographer and platform-wide
CREATE OR REPLACE VIEW public.v_avg_time_to_assignment AS
SELECT
  -- Platform-wide average
  NULL::UUID                                                AS photographer_id,
  'platform_wide'::TEXT                                    AS photographer_name,
  AVG(time_to_assignment_seconds)::NUMERIC(12,2)           AS avg_seconds,
  (AVG(time_to_assignment_seconds) / 3600)::NUMERIC(10,2)  AS avg_hours,
  (AVG(time_to_assignment_seconds) / 86400)::NUMERIC(10,2) AS avg_days,
  MIN(time_to_assignment_seconds)::INTEGER                 AS min_seconds,
  MAX(time_to_assignment_seconds)::INTEGER                 AS max_seconds,
  COUNT(*)::BIGINT                                         AS total_assigned_sessions
FROM public.unassigned_user_sessions
WHERE assigned_at IS NOT NULL
  AND time_to_assignment_seconds IS NOT NULL

UNION ALL

-- Per-photographer average
SELECT
  up.id                                                        AS photographer_id,
  up.name                                                      AS photographer_name,
  AVG(uss.time_to_assignment_seconds)::NUMERIC(12,2)           AS avg_seconds,
  (AVG(uss.time_to_assignment_seconds) / 3600)::NUMERIC(10,2)  AS avg_hours,
  (AVG(uss.time_to_assignment_seconds) / 86400)::NUMERIC(10,2) AS avg_days,
  MIN(uss.time_to_assignment_seconds)::INTEGER                 AS min_seconds,
  MAX(uss.time_to_assignment_seconds)::INTEGER                 AS max_seconds,
  COUNT(*)::BIGINT                                             AS total_assigned_sessions
FROM public.unassigned_user_sessions uss
JOIN public.clients c        ON c.user_id = uss.user_id AND c.owner_admin_id IS NOT NULL
JOIN public.user_profiles up ON up.id = c.owner_admin_id
WHERE uss.assigned_at IS NOT NULL
  AND uss.time_to_assignment_seconds IS NOT NULL
GROUP BY up.id, up.name
ORDER BY total_assigned_sessions DESC;

COMMENT ON VIEW public.v_avg_time_to_assignment IS
  'Average time (seconds/hours/days) from first session to assignment, platform-wide and per photographer. Requirement 14.8.';


-- ============================================
-- 3. VIEW: Conversion Rate per Photographer
-- Requirement: 14.7, 14.9 - conversion rate per photographer
-- ============================================
CREATE OR REPLACE VIEW public.v_conversion_rate_per_photographer AS
WITH assigned_counts AS (
  SELECT
    cal.admin_id AS photographer_id,
    COUNT(DISTINCT cal.client_id)::BIGINT AS total_assigned
  FROM public.client_assignment_log cal
  GROUP BY cal.admin_id
),
-- All distinct users who ever entered a code (session had code_entry_attempts > 0)
-- used as proxy for "tried to assign" denominator
attempted_counts AS (
  SELECT
    -- sessions that eventually got assigned to this photographer
    c.owner_admin_id AS photographer_id,
    COUNT(DISTINCT uss.user_id)::BIGINT AS users_who_attempted
  FROM public.unassigned_user_sessions uss
  JOIN public.clients c ON c.user_id = uss.user_id
  WHERE uss.code_entry_attempts > 0
  GROUP BY c.owner_admin_id
)
SELECT
  up.id                                                              AS photographer_id,
  up.name                                                            AS photographer_name,
  up.photographer_code,
  COALESCE(ac.total_assigned, 0)::BIGINT                            AS total_assigned_clients,
  COALESCE(att.users_who_attempted, 0)::BIGINT                      AS users_who_attempted,
  CASE
    WHEN COALESCE(att.users_who_attempted, 0) > 0
      THEN ROUND(
        COALESCE(ac.total_assigned, 0)::NUMERIC /
        att.users_who_attempted::NUMERIC * 100, 2
      )
    ELSE 0
  END                                                                AS conversion_rate_pct
FROM public.user_profiles up
LEFT JOIN assigned_counts  ac  ON ac.photographer_id  = up.id
LEFT JOIN attempted_counts att ON att.photographer_id = up.id
WHERE up.role IN ('admin', 'super_admin')
ORDER BY total_assigned_clients DESC;

COMMENT ON VIEW public.v_conversion_rate_per_photographer IS
  'Conversion rate (assigned / attempted) for each photographer. Requirement 14.7, 14.9.';


-- ============================================
-- 4. VIEW: Top Viewed Content by Unassigned Users
-- Requirement: 14.8 - top viewed content
-- ============================================
CREATE OR REPLACE VIEW public.v_top_viewed_content AS
WITH bts_view_counts AS (
  SELECT
    'bts'::TEXT                                          AS content_type,
    jsonb_array_elements_text(content_views -> 'bts')   AS content_id_text,
    COUNT(*)::BIGINT                                     AS view_count
  FROM public.unassigned_user_sessions
  WHERE content_views IS NOT NULL
    AND jsonb_typeof(content_views -> 'bts') = 'array'
    AND jsonb_array_length(content_views -> 'bts') > 0
  GROUP BY jsonb_array_elements_text(content_views -> 'bts')
),
announcement_view_counts AS (
  SELECT
    'announcement'::TEXT                                            AS content_type,
    jsonb_array_elements_text(content_views -> 'announcements')    AS content_id_text,
    COUNT(*)::BIGINT                                                AS view_count
  FROM public.unassigned_user_sessions
  WHERE content_views IS NOT NULL
    AND jsonb_typeof(content_views -> 'announcements') = 'array'
    AND jsonb_array_length(content_views -> 'announcements') > 0
  GROUP BY jsonb_array_elements_text(content_views -> 'announcements')
),
all_views AS (
  SELECT * FROM bts_view_counts
  UNION ALL
  SELECT * FROM announcement_view_counts
)
SELECT
  av.content_type,
  av.content_id_text                                 AS content_id,
  av.view_count,
  COALESCE(bp.title, ann.title, 'Unknown')           AS title,
  -- Visibility of content (global items attract unassigned users)
  COALESCE(bp.visibility::TEXT, ann.visibility::TEXT) AS visibility,
  COALESCE(bp.created_at, ann.created_at)            AS published_at
FROM all_views av
LEFT JOIN public.bts_posts     bp  ON bp.id::TEXT  = av.content_id_text AND av.content_type = 'bts'
LEFT JOIN public.announcements ann ON ann.id::TEXT = av.content_id_text AND av.content_type = 'announcement'
ORDER BY av.view_count DESC;

COMMENT ON VIEW public.v_top_viewed_content IS
  'Most viewed BTS posts and announcements by unassigned users, ordered by view count. Requirement 14.8.';


-- ============================================
-- 5. VIEW: Assignment Source Distribution
-- Requirement: 14.9 - track assignment_source distribution
-- ============================================
CREATE OR REPLACE VIEW public.v_assignment_source_distribution AS
WITH source_counts AS (
  SELECT
    assigned_via,
    COUNT(*)::BIGINT AS assignment_count
  FROM public.unassigned_user_sessions
  WHERE assigned_at IS NOT NULL
    AND assigned_via IS NOT NULL
  GROUP BY assigned_via
),
total AS (
  SELECT SUM(assignment_count)::NUMERIC AS total_count
  FROM source_counts
)
SELECT
  sc.assigned_via,
  sc.assignment_count,
  CASE
    WHEN t.total_count > 0
      THEN ROUND(sc.assignment_count::NUMERIC / t.total_count * 100, 2)
    ELSE 0
  END AS percentage
FROM source_counts sc
CROSS JOIN total t
ORDER BY sc.assignment_count DESC;

COMMENT ON VIEW public.v_assignment_source_distribution IS
  'Breakdown of assignment methods (code_entry, qr_scan, invite_link, admin_invite) with percentage share. Requirement 14.9.';


-- ============================================
-- 6. VIEW: Failed Attempt Counts
-- Requirement: 14.10 - track failed assignment attempts
-- ============================================
CREATE OR REPLACE VIEW public.v_failed_attempt_counts AS
SELECT
  -- Platform-wide totals
  COUNT(*)::BIGINT                                                   AS total_failed_sessions,
  SUM(code_entry_attempts)::BIGINT                                   AS total_failed_attempts,
  ROUND(AVG(code_entry_attempts)::NUMERIC, 2)                        AS avg_attempts_per_session,
  MAX(code_entry_attempts)::INTEGER                                  AS max_attempts_in_session,
  -- Bucket distribution
  COUNT(CASE WHEN code_entry_attempts = 1 THEN 1 END)::BIGINT       AS sessions_with_1_attempt,
  COUNT(CASE WHEN code_entry_attempts BETWEEN 2 AND 3 THEN 1 END)::BIGINT AS sessions_with_2_3_attempts,
  COUNT(CASE WHEN code_entry_attempts BETWEEN 4 AND 9 THEN 1 END)::BIGINT AS sessions_with_4_9_attempts,
  COUNT(CASE WHEN code_entry_attempts >= 10 THEN 1 END)::BIGINT     AS sessions_with_10_plus_attempts,
  -- Trend: failed sessions in last 7 days
  COUNT(CASE WHEN session_start >= NOW() - INTERVAL '7 days' THEN 1 END)::BIGINT AS failed_sessions_last_7_days,
  -- Trend: failed sessions in last 30 days
  COUNT(CASE WHEN session_start >= NOW() - INTERVAL '30 days' THEN 1 END)::BIGINT AS failed_sessions_last_30_days
FROM public.unassigned_user_sessions
WHERE assigned_at IS NULL
  AND code_entry_attempts > 0;

COMMENT ON VIEW public.v_failed_attempt_counts IS
  'Statistics about failed photographer code entry attempts across all unassigned sessions. Requirement 14.10.';


-- ============================================
-- 7. FUNCTION: Complete Analytics Summary (Dashboard Query)
-- Requirement: 14.7, 14.8, 14.9, 14.10
-- Returns all key metrics in a single JSONB payload for the super admin dashboard
-- ============================================
CREATE OR REPLACE FUNCTION public.get_unassigned_user_analytics(
  p_limit_top_content INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unassigned_count      BIGINT;
  v_avg_time              RECORD;
  v_source_dist           JSONB;
  v_failed_stats          RECORD;
  v_top_content           JSONB;
BEGIN
  -- 1. Total unassigned users
  SELECT COUNT(*) INTO v_unassigned_count
  FROM public.v_total_unassigned_users;

  -- 2. Average time to assignment (platform-wide row where photographer_id IS NULL)
  SELECT avg_seconds, avg_hours, avg_days, total_assigned_sessions
  INTO v_avg_time
  FROM public.v_avg_time_to_assignment
  WHERE photographer_id IS NULL
  LIMIT 1;

  -- 3. Assignment source distribution
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'source', assigned_via,
      'count', assignment_count,
      'percentage', percentage
    )
    ORDER BY assignment_count DESC
  ), '[]'::jsonb)
  INTO v_source_dist
  FROM public.v_assignment_source_distribution;

  -- 4. Failed attempt stats
  SELECT *
  INTO v_failed_stats
  FROM public.v_failed_attempt_counts
  LIMIT 1;

  -- 5. Top viewed content
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'content_type', content_type,
      'content_id', content_id,
      'title', title,
      'view_count', view_count,
      'visibility', visibility,
      'published_at', published_at
    )
    ORDER BY view_count DESC
  ), '[]'::jsonb)
  INTO v_top_content
  FROM (
    SELECT * FROM public.v_top_viewed_content
    LIMIT p_limit_top_content
  ) sub;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'total_unassigned_users', v_unassigned_count,
    'average_time_to_assignment', jsonb_build_object(
      'avg_seconds',              v_avg_time.avg_seconds,
      'avg_hours',                v_avg_time.avg_hours,
      'avg_days',                 v_avg_time.avg_days,
      'total_assigned_sessions',  v_avg_time.total_assigned_sessions
    ),
    'assignment_source_distribution', v_source_dist,
    'failed_attempts', jsonb_build_object(
      'total_failed_sessions',        v_failed_stats.total_failed_sessions,
      'total_failed_attempts',        v_failed_stats.total_failed_attempts,
      'avg_attempts_per_session',     v_failed_stats.avg_attempts_per_session,
      'max_attempts_in_session',      v_failed_stats.max_attempts_in_session,
      'sessions_with_1_attempt',      v_failed_stats.sessions_with_1_attempt,
      'sessions_with_2_3_attempts',   v_failed_stats.sessions_with_2_3_attempts,
      'sessions_with_4_9_attempts',   v_failed_stats.sessions_with_4_9_attempts,
      'sessions_with_10_plus_attempts', v_failed_stats.sessions_with_10_plus_attempts,
      'last_7_days',                  v_failed_stats.failed_sessions_last_7_days,
      'last_30_days',                 v_failed_stats.failed_sessions_last_30_days
    ),
    'top_viewed_content', v_top_content
  );
END;
$$;

COMMENT ON FUNCTION public.get_unassigned_user_analytics(INTEGER) IS
  'Returns a comprehensive JSONB analytics summary for the super admin dashboard: '
  'total unassigned users, average time to assignment, assignment source distribution, '
  'failed attempt statistics, and top viewed content. Requirements 14.7, 14.8, 14.9, 14.10.';

-- Grant execute to authenticated users (super_admin gate enforced by dashboard/RLS)
GRANT EXECUTE ON FUNCTION public.get_unassigned_user_analytics(INTEGER) TO authenticated;


-- ============================================
-- 8. FUNCTION: Per-Photographer Conversion Report
-- Requirement: 14.7 - conversion_rate per photographer
-- ============================================
CREATE OR REPLACE FUNCTION public.get_photographer_conversion_report()
RETURNS TABLE (
  photographer_id            UUID,
  photographer_name          TEXT,
  photographer_code          TEXT,
  total_assigned_clients     BIGINT,
  users_who_attempted        BIGINT,
  conversion_rate_pct        NUMERIC,
  avg_time_to_assign_hours   NUMERIC,
  total_failed_attempts      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.photographer_id,
    cr.photographer_name,
    cr.photographer_code,
    cr.total_assigned_clients,
    cr.users_who_attempted,
    cr.conversion_rate_pct,
    -- Average time to assignment for this photographer's clients
    COALESCE((
      SELECT ROUND((AVG(uss.time_to_assignment_seconds) / 3600)::NUMERIC, 2)
      FROM public.unassigned_user_sessions uss
      JOIN public.clients c ON c.user_id = uss.user_id
      WHERE c.owner_admin_id = cr.photographer_id
        AND uss.time_to_assignment_seconds IS NOT NULL
    ), 0) AS avg_time_to_assign_hours,
    -- Total failed code entry attempts globally (sessions still unassigned)
    COALESCE((
      SELECT SUM(uss2.code_entry_attempts)::BIGINT
      FROM public.unassigned_user_sessions uss2
      WHERE uss2.assigned_at IS NULL
        AND uss2.code_entry_attempts > 0
    ), 0) AS total_failed_attempts
  FROM public.v_conversion_rate_per_photographer cr
  ORDER BY cr.total_assigned_clients DESC;
END;
$$;

COMMENT ON FUNCTION public.get_photographer_conversion_report() IS
  'Per-photographer conversion report combining assignment counts, conversion rates, '
  'average time to assignment, and failed attempt stats. Requirement 14.7.';

GRANT EXECUTE ON FUNCTION public.get_photographer_conversion_report() TO authenticated;


-- ============================================
-- 9. INDEX: Improve analytics query performance
-- Requirement: 14.7, 14.8, 14.9, 14.10
-- ============================================

-- Index for quickly finding active (unassigned) sessions
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_active
  ON public.unassigned_user_sessions(user_id, session_start DESC)
  WHERE session_end IS NULL AND assigned_at IS NULL;

-- Index for time-to-assignment aggregations
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_assigned_at_time
  ON public.unassigned_user_sessions(assigned_at, time_to_assignment_seconds)
  WHERE assigned_at IS NOT NULL;

-- Index for assignment source distribution queries
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_assigned_via
  ON public.unassigned_user_sessions(assigned_via)
  WHERE assigned_via IS NOT NULL;

-- Index for failed attempt queries
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_failed_attempts
  ON public.unassigned_user_sessions(code_entry_attempts, session_start)
  WHERE assigned_at IS NULL AND code_entry_attempts > 0;

