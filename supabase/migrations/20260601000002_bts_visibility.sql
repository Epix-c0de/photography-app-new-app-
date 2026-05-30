-- ============================================
-- PHASE 3: BTS VISIBILITY + MULTI-ADMIN CHAT
-- ============================================

-- 1. Add visibility column to bts_posts
ALTER TABLE bts_posts
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'global';
-- 'global'     = all clients can see it (default)
-- 'admin_only' = only clients of this photographer can see it

-- Add check constraint
ALTER TABLE bts_posts
  DROP CONSTRAINT IF EXISTS bts_posts_visibility_check;
ALTER TABLE bts_posts
  ADD CONSTRAINT bts_posts_visibility_check
  CHECK (visibility IN ('global', 'admin_only'));

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_bts_posts_visibility
  ON bts_posts(visibility);

-- Fix: bts_posts uses 'created_by' not 'owner_admin_id'
CREATE INDEX IF NOT EXISTS idx_bts_posts_created_by_visibility
  ON bts_posts(created_by, visibility);

-- 2. Update existing posts to 'global' (safe default)
UPDATE bts_posts SET visibility = 'global' WHERE visibility IS NULL;

-- 3. messages.owner_admin_id already exists (created in 20260214000002)
-- Just ensure the indexes exist for multi-photographer chat thread queries
CREATE INDEX IF NOT EXISTS idx_messages_owner_admin_id
  ON messages(owner_admin_id);

CREATE INDEX IF NOT EXISTS idx_messages_client_owner
  ON messages(client_id, owner_admin_id);
