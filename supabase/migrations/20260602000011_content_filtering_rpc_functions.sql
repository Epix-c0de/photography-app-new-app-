-- Migration: Create content filtering and analytics RPC functions
-- Tasks: 4.1, 4.2
-- Requirements: 4.3, 4.4, 13.3, 13.4, 13.5, 13.10, 14.1, 14.2, 14.3, 14.4

-- Task 4.1: Create get_visible_content_for_user RPC function
CREATE OR REPLACE FUNCTION public.get_visible_content_for_user(
  p_user_id UUID,
  p_content_type TEXT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  image_url TEXT,
  admin_id UUID,
  visibility TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  admin_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_photographer_id UUID;
BEGIN
  -- Get user's assigned photographer
  SELECT c.owner_admin_id INTO v_photographer_id
  FROM public.clients c
  WHERE c.user_id = p_user_id
  LIMIT 1;

  -- Return content based on type
  IF p_content_type = 'bts' THEN
    RETURN QUERY
    SELECT 
      bp.id,
      bp.title,
      bp.content,
      bp.image_url,
      bp.admin_id,
      bp.visibility,
      bp.created_at,
      bp.updated_at,
      up.name as admin_name
    FROM public.bts_posts bp
    LEFT JOIN public.user_profiles up ON bp.admin_id = up.id
    WHERE 
      bp.visibility = 'global'
      OR (bp.visibility = 'assigned_only' AND bp.admin_id = v_photographer_id)
    ORDER BY bp.created_at DESC;
    
  ELSIF p_content_type = 'announcements' THEN
    RETURN QUERY
    SELECT 
      a.id,
      a.title,
      a.content,
      a.image_url,
      a.admin_id,
      a.visibility,
      a.created_at,
      a.updated_at,
      up.name as admin_name
    FROM public.announcements a
    LEFT JOIN public.user_profiles up ON a.admin_id = up.id
    WHERE 
      a.visibility = 'global'
      OR (a.visibility = 'assigned_only' AND a.admin_id = v_photographer_id)
    ORDER BY a.created_at DESC;
    
  ELSE
    -- Invalid content type
    RAISE EXCEPTION 'Invalid content_type. Must be "bts" or "announcements"';
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error fetching visible content: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_visible_content_for_user(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_visible_content_for_user IS 'Returns BTS posts or announcements visible to user based on assignment status';


-- Task 4.2: Create log_unassigned_user_event RPC function
CREATE OR REPLACE FUNCTION public.log_unassigned_user_event(
  p_event_type TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_session_id UUID;
  v_session_start TIMESTAMPTZ;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Validate event_type
  IF p_event_type NOT IN ('landed', 'code_entered', 'viewed_bts', 'viewed_announcement') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid event_type'
    );
  END IF;

  -- Get or create active session
  SELECT id, session_start INTO v_session_id, v_session_start
  FROM public.unassigned_user_sessions
  WHERE user_id = v_user_id
    AND session_end IS NULL
    AND assigned_at IS NULL
  ORDER BY session_start DESC
  LIMIT 1;

  -- Create new session if none exists
  IF v_session_id IS NULL THEN
    INSERT INTO public.unassigned_user_sessions (
      user_id,
      session_start,
      content_views,
      code_entry_attempts,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      NOW(),
      '{}'::JSONB,
      0,
      NOW(),
      NOW()
    )
    RETURNING id, session_start INTO v_session_id, v_session_start;
  END IF;

  -- Update session based on event type
  CASE p_event_type
    WHEN 'landed' THEN
      -- Just update the timestamp
      UPDATE public.unassigned_user_sessions
      SET updated_at = NOW()
      WHERE id = v_session_id;
      
    WHEN 'code_entered' THEN
      -- Increment code entry attempts
      UPDATE public.unassigned_user_sessions
      SET 
        code_entry_attempts = code_entry_attempts + 1,
        updated_at = NOW()
      WHERE id = v_session_id;
      
    WHEN 'viewed_bts' THEN
      -- Add BTS post to content_views
      UPDATE public.unassigned_user_sessions
      SET 
        content_views = jsonb_set(
          COALESCE(content_views, '{}'::JSONB),
          '{bts}',
          COALESCE(content_views->'bts', '[]'::JSONB) || 
            jsonb_build_array(p_metadata->>'post_id'),
          true
        ),
        updated_at = NOW()
      WHERE id = v_session_id;
      
    WHEN 'viewed_announcement' THEN
      -- Add announcement to content_views
      UPDATE public.unassigned_user_sessions
      SET 
        content_views = jsonb_set(
          COALESCE(content_views, '{}'::JSONB),
          '{announcements}',
          COALESCE(content_views->'announcements', '[]'::JSONB) || 
            jsonb_build_array(p_metadata->>'announcement_id'),
          true
        ),
        updated_at = NOW()
      WHERE id = v_session_id;
  END CASE;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'event_type', p_event_type
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.log_unassigned_user_event(TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.log_unassigned_user_event IS 'Logs unassigned user events for analytics tracking';
