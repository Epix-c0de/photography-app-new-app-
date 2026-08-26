-- Gallery Shares table for private gallery sharing system
CREATE TABLE IF NOT EXISTS gallery_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Share token (the public-facing token, NOT the UUID)
  share_token TEXT NOT NULL UNIQUE,
  
  -- Access security
  password_enabled BOOLEAN DEFAULT false,
  password_hash TEXT,
  
  -- Download permissions
  downloads_enabled BOOLEAN DEFAULT true,
  originals_enabled BOOLEAN DEFAULT false,
  bulk_download_enabled BOOLEAN DEFAULT false,
  watermark_downloads BOOLEAN DEFAULT false,
  
  -- Sharing permissions
  resharing_enabled BOOLEAN DEFAULT false,
  photo_sharing_enabled BOOLEAN DEFAULT true,
  gallery_sharing_enabled BOOLEAN DEFAULT true,
  
  -- Authentication
  require_authentication BOOLEAN DEFAULT false,
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  
  -- Access limits
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'disabled')),
  
  -- Gallery customization
  gallery_name TEXT,
  gallery_description TEXT,
  cover_photo_url TEXT,
  layout TEXT DEFAULT 'grid' CHECK (layout IN ('grid', 'masonry', 'large_tiles', 'magazine', 'minimal')),
  theme TEXT DEFAULT 'dark_luxury' CHECK (theme IN ('dark_luxury', 'light_elegant', 'black_gold', 'midnight_purple', 'champagne', 'minimal_white')),
  primary_color TEXT DEFAULT '#D4AF37',
  background_color TEXT DEFAULT '#141414',
  
  -- Watermark
  watermark_enabled BOOLEAN DEFAULT false,
  watermark_text TEXT DEFAULT 'Epix Visuals',
  watermark_position TEXT DEFAULT 'bottom_right' CHECK (watermark_position IN ('bottom_left', 'bottom_right', 'center', 'diagonal')),
  watermark_opacity INTEGER DEFAULT 30,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Gallery share media (for sharing selected photos only)
CREATE TABLE IF NOT EXISTS gallery_share_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id UUID NOT NULL REFERENCES gallery_shares(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES gallery_photos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(share_id, photo_id)
);

-- Gallery access logs
CREATE TABLE IF NOT EXISTS gallery_access_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id UUID NOT NULL REFERENCES gallery_shares(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID,
  device_type TEXT,
  browser TEXT,
  ip_address INET,
  event_type TEXT DEFAULT 'view' CHECK (event_type IN ('view', 'download', 'share', 'password_attempt'))
);

-- Gallery downloads tracking
CREATE TABLE IF NOT EXISTS gallery_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id UUID NOT NULL REFERENCES gallery_shares(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES gallery_photos(id) ON DELETE CASCADE,
  user_id UUID,
  downloaded_at TIMESTAMPTZ DEFAULT now(),
  download_type TEXT DEFAULT 'preview' CHECK (download_type IN ('preview', 'original', 'watermarked'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gallery_shares_token ON gallery_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_gallery_shares_gallery ON gallery_shares(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_shares_status ON gallery_shares(status);
CREATE INDEX IF NOT EXISTS idx_gallery_access_logs_share ON gallery_access_logs(share_id);
CREATE INDEX IF NOT EXISTS idx_gallery_downloads_share ON gallery_downloads(share_id);

-- RLS policies
ALTER TABLE gallery_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_share_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_downloads ENABLE ROW LEVEL SECURITY;

-- Gallery shares: creators can manage their own
CREATE POLICY "Users can view shares they created" ON gallery_shares
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create shares" ON gallery_shares
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update shares they created" ON gallery_shares
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete shares they created" ON gallery_shares
  FOR DELETE USING (auth.uid() = created_by);

-- Share media: creators can manage
CREATE POLICY "Users can manage share media" ON gallery_share_media
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM gallery_shares 
      WHERE gallery_shares.id = gallery_share_media.share_id 
      AND gallery_shares.created_by = auth.uid()
    )
  );

-- Access logs: creators can view their shares' logs
CREATE POLICY "Users can view access logs for their shares" ON gallery_access_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gallery_shares 
      WHERE gallery_shares.id = gallery_access_logs.share_id 
      AND gallery_shares.created_by = auth.uid()
    )
  );

-- Allow anonymous inserts for access logging (from landing page)
CREATE POLICY "Allow anonymous access log inserts" ON gallery_access_logs
  FOR INSERT WITH CHECK (true);

-- Downloads: creators can view downloads for their shares
CREATE POLICY "Users can view downloads for their shares" ON gallery_downloads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gallery_shares 
      WHERE gallery_shares.id = gallery_downloads.share_id 
      AND gallery_shares.created_by = auth.uid()
    )
  );

-- Allow anonymous download log inserts
CREATE POLICY "Allow anonymous download log inserts" ON gallery_downloads
  FOR INSERT WITH CHECK (true);

-- Function to validate share access
CREATE OR REPLACE FUNCTION validate_share_access(
  p_share_token TEXT,
  p_password TEXT DEFAULT NULL
)
RETURNS TABLE(
  share_id UUID,
  gallery_id UUID,
  gallery_name TEXT,
  gallery_description TEXT,
  cover_photo_url TEXT,
  layout TEXT,
  theme TEXT,
  primary_color TEXT,
  background_color TEXT,
  watermark_enabled BOOLEAN,
  watermark_text TEXT,
  watermark_position TEXT,
  watermark_opacity INTEGER,
  downloads_enabled BOOLEAN,
  originals_enabled BOOLEAN,
  bulk_download_enabled BOOLEAN,
  photo_sharing_enabled BOOLEAN,
  valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_share RECORD;
  v_password_hash TEXT;
BEGIN
  -- Find the share
  SELECT * INTO v_share FROM gallery_shares 
  WHERE share_token = p_share_token AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::BOOLEAN, NULL::TEXT, NULL::TEXT, NULL::INTEGER,
      NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
      FALSE, 'This gallery link is no longer available.'::TEXT;
    RETURN;
  END IF;
  
  -- Check expiration
  IF v_share.expires_at IS NOT NULL AND v_share.expires_at < now() THEN
    UPDATE gallery_shares SET status = 'expired' WHERE id = v_share.id;
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::BOOLEAN, NULL::TEXT, NULL::TEXT, NULL::INTEGER,
      NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
      FALSE, 'This private gallery has expired.'::TEXT;
    RETURN;
  END IF;
  
  -- Check view limit
  IF v_share.max_views IS NOT NULL AND v_share.view_count >= v_share.max_views THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::BOOLEAN, NULL::TEXT, NULL::TEXT, NULL::INTEGER,
      NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
      FALSE, 'This gallery has reached its access limit.'::TEXT;
    RETURN;
  END IF;
  
  -- Check password
  IF v_share.password_enabled AND v_share.password_hash IS NOT NULL THEN
    IF p_password IS NULL THEN
      RETURN QUERY SELECT 
        v_share.id, v_share.gallery_id, v_share.gallery_name, v_share.gallery_description, v_share.cover_photo_url,
        v_share.layout, v_share.theme, v_share.primary_color, v_share.background_color,
        v_share.watermark_enabled, v_share.watermark_text, v_share.watermark_position, v_share.watermark_opacity,
        v_share.downloads_enabled, v_share.originals_enabled, v_share.bulk_download_enabled, v_share.photo_sharing_enabled,
        FALSE, 'Password required.'::TEXT;
      RETURN;
    END IF;
    
    -- Simple comparison (in production use proper bcrypt)
    IF p_password != v_share.password_hash THEN
      RETURN QUERY SELECT 
        NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
        NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT,
        NULL::BOOLEAN, NULL::TEXT, NULL::TEXT, NULL::INTEGER,
        NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
        FALSE, 'Incorrect password. Please try again.'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Increment view count
  UPDATE gallery_shares SET view_count = view_count + 1 WHERE id = v_share.id;
  
  -- Return success
  RETURN QUERY SELECT 
    v_share.id, v_share.gallery_id, v_share.gallery_name, v_share.gallery_description, v_share.cover_photo_url,
    v_share.layout, v_share.theme, v_share.primary_color, v_share.background_color,
    v_share.watermark_enabled, v_share.watermark_text, v_share.watermark_position, v_share.watermark_opacity,
    v_share.downloads_enabled, v_share.originals_enabled, v_share.bulk_download_enabled, v_share.photo_sharing_enabled,
    TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get photos for a share
CREATE OR REPLACE FUNCTION get_share_photos(p_share_id UUID)
RETURNS TABLE(
  id UUID,
  photo_url TEXT,
  thumbnail_url TEXT,
  preview_url TEXT,
  caption TEXT,
  is_top_rated BOOLEAN,
  media_type TEXT,
  sort_order INTEGER
) AS $$
BEGIN
  -- If share has selected photos, return only those
  IF EXISTS (SELECT 1 FROM gallery_share_media WHERE share_id = p_share_id) THEN
    RETURN QUERY
    SELECT gp.id, gp.photo_url, gp.thumbnail_url, gp.preview_url, gp.caption, gp.is_top_rated, gp.media_type, gp.sort_order
    FROM gallery_photos gp
    INNER JOIN gallery_share_media gsm ON gsm.photo_id = gp.id
    WHERE gsm.share_id = p_share_id
    ORDER BY gp.sort_order;
  ELSE
    -- Return all photos from the gallery
    RETURN QUERY
    SELECT gp.id, gp.photo_url, gp.thumbnail_url, gp.preview_url, gp.caption, gp.is_top_rated, gp.media_type, gp.sort_order
    FROM gallery_photos gp
    INNER JOIN gallery_shares gs ON gs.gallery_id = gp.gallery_id
    WHERE gs.id = p_share_id
    ORDER BY gp.sort_order;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
