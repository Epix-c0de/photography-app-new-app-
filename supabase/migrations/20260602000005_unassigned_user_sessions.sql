-- Migration: Create unassigned_user_sessions table for tracking unassigned user analytics
-- Purpose: Track behavior and session data for users who haven't been assigned to a photographer yet
-- Requirement: 14.6 - Unassigned User Analytics and Tracking

-- Create unassigned_user_sessions table
CREATE TABLE IF NOT EXISTS unassigned_user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  content_views JSONB DEFAULT '{"bts": [], "announcements": []}'::jsonb,
  code_entry_attempts INTEGER DEFAULT 0,
  assigned_at TIMESTAMPTZ,
  assigned_via TEXT,
  time_to_assignment_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance (as specified in task)
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_user_id 
  ON unassigned_user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_session_start 
  ON unassigned_user_sessions(session_start);

-- Additional useful index for querying active sessions
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_active 
  ON unassigned_user_sessions(user_id, session_start DESC) 
  WHERE session_end IS NULL;

-- Enable Row Level Security
ALTER TABLE unassigned_user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view only their own sessions
CREATE POLICY "Users can view their own unassigned sessions"
  ON unassigned_user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: System can insert sessions (via service role)
CREATE POLICY "System can insert unassigned sessions"
  ON unassigned_user_sessions
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: System can update sessions (via service role)
CREATE POLICY "System can update unassigned sessions"
  ON unassigned_user_sessions
  FOR UPDATE
  USING (true);

-- RLS Policy: Super admins can view all sessions for analytics
CREATE POLICY "Super admins can view all unassigned sessions"
  ON unassigned_user_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Add comment to table for documentation
COMMENT ON TABLE unassigned_user_sessions IS 'Tracks analytics and session data for users before they are assigned to a photographer';

-- Add comments to key columns
COMMENT ON COLUMN unassigned_user_sessions.session_start IS 'Timestamp when unassigned user first opened the app in this session';
COMMENT ON COLUMN unassigned_user_sessions.session_end IS 'Timestamp when session ended (user closed app or got assigned)';
COMMENT ON COLUMN unassigned_user_sessions.content_views IS 'JSON array tracking which BTS posts and announcements the user viewed';
COMMENT ON COLUMN unassigned_user_sessions.code_entry_attempts IS 'Number of times user attempted to enter a photographer code';
COMMENT ON COLUMN unassigned_user_sessions.assigned_at IS 'Timestamp when user successfully got assigned to a photographer';
COMMENT ON COLUMN unassigned_user_sessions.assigned_via IS 'Method of assignment: code_entry, qr_scan, invite_link, or admin_invite';
COMMENT ON COLUMN unassigned_user_sessions.time_to_assignment_seconds IS 'Total seconds from session_start to assigned_at';
