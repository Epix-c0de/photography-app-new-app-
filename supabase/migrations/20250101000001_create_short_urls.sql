-- Short URLs for branded shareable links
CREATE TABLE IF NOT EXISTS short_urls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  short_code TEXT NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  brand_slug TEXT NOT NULL DEFAULT 'default',
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_short_urls_code ON short_urls(short_code);
CREATE INDEX IF NOT EXISTS idx_short_urls_brand ON short_urls(brand_slug);

-- RLS policies
ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;

-- Public can read active short URLs
CREATE POLICY "Public can view active short URLs" ON short_urls
  FOR SELECT
  TO public
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Service role can insert/update
CREATE POLICY "Service role can manage short URLs" ON short_urls
  FOR ALL
  TO service_role
  USING (true);

-- Function to increment click count
CREATE OR REPLACE FUNCTION increment_short_url_clicks()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE short_urls SET click_count = click_count + 1 WHERE short_code = NEW.short_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
