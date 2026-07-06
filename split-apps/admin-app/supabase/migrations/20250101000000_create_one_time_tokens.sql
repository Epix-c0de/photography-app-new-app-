-- One-time tokens for seamless login redirect from web onboarding
CREATE TABLE IF NOT EXISTS one_time_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_one_time_tokens_hash ON one_time_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_one_time_tokens_user ON one_time_tokens(user_id);

-- Auto-cleanup expired tokens (run via pg_cron or edge function)
-- Delete tokens older than 1 hour
DELETE FROM one_time_tokens WHERE expires_at < NOW() - INTERVAL '1 hour';

-- RLS policies
ALTER TABLE one_time_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access (via edge functions)
CREATE POLICY "Service role only" ON one_time_tokens
  FOR ALL
  TO service_role
  USING (true);
