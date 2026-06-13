-- Migration: Add visibility columns to bts_posts and announcements tables
-- Task: 1.3 Create migration for content visibility columns
-- Requirements: 13.1, 13.2, 13.7, 13.8

-- Add visibility column to bts_posts table
ALTER TABLE public.bts_posts 
ADD COLUMN IF NOT EXISTS visibility TEXT 
CHECK (visibility IN ('global', 'assigned_only', 'private'))
DEFAULT 'assigned_only';

-- Add visibility column to announcements table
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS visibility TEXT 
CHECK (visibility IN ('global', 'assigned_only', 'private'))
DEFAULT 'assigned_only';

-- Create indexes on visibility columns for performance
CREATE INDEX IF NOT EXISTS idx_bts_posts_visibility ON public.bts_posts(visibility);
CREATE INDEX IF NOT EXISTS idx_announcements_visibility ON public.announcements(visibility);

-- Create composite indexes for efficient filtering
-- bts_posts uses 'created_by', announcements uses 'created_by' (or owner_admin_id depending on migration order)
CREATE INDEX IF NOT EXISTS idx_bts_posts_visibility_created_by ON public.bts_posts(visibility, created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_visibility_created_by ON public.announcements(visibility, created_by);

-- Update existing records to have default visibility
UPDATE public.bts_posts SET visibility = 'assigned_only' WHERE visibility IS NULL;
UPDATE public.announcements SET visibility = 'assigned_only' WHERE visibility IS NULL;

-- Add comments
COMMENT ON COLUMN public.bts_posts.visibility IS 'Controls content visibility: global (all users), assigned_only (only assigned clients), private (photographer only)';
COMMENT ON COLUMN public.announcements.visibility IS 'Controls content visibility: global (all users), assigned_only (only assigned clients), private (photographer only)';
