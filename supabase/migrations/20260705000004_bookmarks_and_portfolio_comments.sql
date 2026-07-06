-- Phase 8: Create missing bookmark tables and portfolio_comments

-- BTS Bookmarks
CREATE TABLE IF NOT EXISTS bts_bookmarks (
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  bts_id UUID REFERENCES bts_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, bts_id)
);

-- Enable RLS on bts_bookmarks
ALTER TABLE bts_bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can view their own bookmarks
CREATE POLICY "Users can view own bts bookmarks"
  ON bts_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can bookmark/unbookmark BTS posts
CREATE POLICY "Users can insert own bts bookmarks"
  ON bts_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bts bookmarks"
  ON bts_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- Announcement Bookmarks
CREATE TABLE IF NOT EXISTS announcement_bookmarks (
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

-- Enable RLS on announcement_bookmarks
ALTER TABLE announcement_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own announcement bookmarks"
  ON announcement_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own announcement bookmarks"
  ON announcement_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own announcement bookmarks"
  ON announcement_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- Portfolio Bookmarks
CREATE TABLE IF NOT EXISTS portfolio_bookmarks (
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  portfolio_item_id UUID REFERENCES portfolio_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, portfolio_item_id)
);

-- Enable RLS on portfolio_bookmarks
ALTER TABLE portfolio_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolio bookmarks"
  ON portfolio_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio bookmarks"
  ON portfolio_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio bookmarks"
  ON portfolio_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- Portfolio Comments (if not exists)
CREATE TABLE IF NOT EXISTS portfolio_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_item_id UUID REFERENCES portfolio_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on portfolio_comments
ALTER TABLE portfolio_comments ENABLE ROW LEVEL SECURITY;

-- Everyone can view comments
CREATE POLICY "Users can view portfolio comments"
  ON portfolio_comments FOR SELECT
  USING (true);

-- Authenticated users can insert comments
CREATE POLICY "Users can insert portfolio comments"
  ON portfolio_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update own comments
CREATE POLICY "Users can update own portfolio comments"
  ON portfolio_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete own comments
CREATE POLICY "Users can delete own portfolio comments"
  ON portfolio_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments_count column to portfolio_items if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'portfolio_items' 
    AND column_name = 'comments_count'
  ) THEN
    ALTER TABLE portfolio_items ADD COLUMN comments_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add bookmarks_count column to bts_posts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'bts_posts' 
    AND column_name = 'bookmarks_count'
  ) THEN
    ALTER TABLE bts_posts ADD COLUMN bookmarks_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add bookmarks_count column to announcements if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'announcements' 
    AND column_name = 'bookmarks_count'
  ) THEN
    ALTER TABLE announcements ADD COLUMN bookmarks_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add bookmarks_count column to portfolio_items if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'portfolio_items' 
    AND column_name = 'bookmarks_count'
  ) THEN
    ALTER TABLE portfolio_items ADD COLUMN bookmarks_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bts_bookmarks_user ON bts_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bts_bookmarks_bts ON bts_bookmarks(bts_id);
CREATE INDEX IF NOT EXISTS idx_announcement_bookmarks_user ON announcement_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_bookmarks_announcement ON announcement_bookmarks(announcement_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_bookmarks_user ON portfolio_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_bookmarks_item ON portfolio_bookmarks(portfolio_item_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_comments_item ON portfolio_comments(portfolio_item_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_comments_user ON portfolio_comments(user_id);
