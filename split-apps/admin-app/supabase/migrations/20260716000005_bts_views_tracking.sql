-- Create RPC function to increment BTS post views
CREATE OR REPLACE FUNCTION increment_views_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE bts_posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
