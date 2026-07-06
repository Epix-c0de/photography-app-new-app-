-- Phase 7c: Add DELETE triggers for comment counts
-- When a comment is deleted, decrement the comments_count on the parent post

-- BTS Comments DELETE trigger
CREATE OR REPLACE FUNCTION decrement_bts_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bts_posts 
  SET comments_count = GREATEST(comments_count - 1, 0) 
  WHERE id = OLD.bts_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS on_bts_comment_delete ON bts_comments;
CREATE TRIGGER on_bts_comment_delete
  AFTER DELETE ON bts_comments
  FOR EACH ROW EXECUTE FUNCTION decrement_bts_comment_count();

-- Announcement Comments DELETE trigger
CREATE OR REPLACE FUNCTION decrement_announcement_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE announcements 
  SET comments_count = GREATEST(comments_count - 1, 0) 
  WHERE id = OLD.announcement_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_announcement_comment_delete ON announcement_comments;
CREATE TRIGGER on_announcement_comment_delete
  AFTER DELETE ON announcement_comments
  FOR EACH ROW EXECUTE FUNCTION decrement_announcement_comment_count();

-- Portfolio Comments DELETE trigger (if portfolio_comments table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'portfolio_comments') THEN
    CREATE OR REPLACE FUNCTION decrement_portfolio_comment_count()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE portfolio_items 
      SET comments_count = GREATEST(comments_count - 1, 0) 
      WHERE id = OLD.portfolio_item_id;
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_portfolio_comment_delete ON portfolio_comments;
    CREATE TRIGGER on_portfolio_comment_delete
      AFTER DELETE ON portfolio_comments
      FOR EACH ROW EXECUTE FUNCTION decrement_portfolio_comment_count();
  END IF;
END $$;
