-- Migration: Create unassigned_user_sessions table for analytics tracking
-- Task: 1.2 Create migration for unassigned_user_sessions table
-- Requirements: 14.6

-- Create unassigned_user_sessions table
CREATE TABLE IF NOT EXISTS public.unassigned_user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  content_views JSONB DEFAULT '{}', -- Stores {bts: [post_ids], announcements: [announcement_ids]}
  code_entry_attempts INTEGER DEFAULT 0,
  assigned_at TIMESTAMPTZ,
  assigned_via TEXT CHECK (assigned_via IN ('code_entry', 'qr_scan', 'invite_link', 'admin_invite')),
  time_to_assignment_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_user_id ON public.unassigned_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_session_start ON public.unassigned_user_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_assigned_at ON public.unassigned_user_sessions(assigned_at);

-- Add RLS policies
ALTER TABLE public.unassigned_user_sessions ENABLE ROW LEVEL SECURITY;

-- Super admins can view all sessions
CREATE POLICY "Super admins can view all unassigned sessions"
  ON public.unassigned_user_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Users can view their own sessions
CREATE POLICY "Users can view own unassigned sessions"
  ON public.unassigned_user_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- System can insert session records
CREATE POLICY "System can insert unassigned sessions"
  ON public.unassigned_user_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- System can update session records
CREATE POLICY "System can update unassigned sessions"
  ON public.unassigned_user_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_unassigned_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_unassigned_sessions_updated_at
  BEFORE UPDATE ON public.unassigned_user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_unassigned_sessions_updated_at();

-- Add comment
COMMENT ON TABLE public.unassigned_user_sessions IS 'Tracks unassigned user sessions for analytics and conversion tracking';
