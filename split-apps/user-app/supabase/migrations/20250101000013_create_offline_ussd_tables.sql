-- Phase 4: Offline Gallery Mode + USSD Access Codes

-- Add offline cache settings to galleries
ALTER TABLE galleries
ADD COLUMN IF NOT EXISTS allow_offline BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS offline_photo_limit INT DEFAULT 50;

-- Add USSD code to galleries (separate from access code)
ALTER TABLE galleries
ADD COLUMN IF NOT EXISTS ussd_code TEXT;

-- Generate USSD codes for existing galleries
UPDATE galleries 
SET ussd_code = UPPER(
  SUBSTRING(access_code FROM 1 FOR 3) || '-' || 
  FLOOR(RANDOM() * 9000 + 1000)::TEXT
)
WHERE ussd_code IS NULL;

-- Create index for USSD code lookups
CREATE INDEX IF NOT EXISTS idx_galleries_ussd_code ON galleries(ussd_code) WHERE ussd_code IS NOT NULL;

-- Create table for USSD requests (for logging and analytics)
CREATE TABLE IF NOT EXISTS ussd_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  access_code TEXT NOT NULL,
  gallery_id UUID REFERENCES galleries(id),
  client_id UUID REFERENCES clients(id),
  status TEXT DEFAULT 'sent', -- sent, delivered, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ussd_requests_phone ON ussd_requests(phone_number);
CREATE INDEX IF NOT EXISTS idx_ussd_requests_gallery ON ussd_requests(gallery_id);

-- RLS policies
ALTER TABLE ussd_requests ENABLE ROW LEVEL SECURITY;

-- Photographers can view USSD requests for their galleries
CREATE POLICY "Photographers view own USSD requests" ON ussd_requests
  FOR SELECT
  USING (
    gallery_id IN (
      SELECT id FROM galleries WHERE owner_admin_id = auth.uid()
    )
  );

-- Service role can manage all
CREATE POLICY "Service role manages USSD requests" ON ussd_requests
  FOR ALL
  TO service_role
  USING (true);


-- Offline cache tracking
CREATE TABLE IF NOT EXISTS offline_cache_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  gallery_id UUID REFERENCES galleries(id),
  photos_cached INT DEFAULT 0,
  cache_size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE offline_cache_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own cache logs
CREATE POLICY "Users view own cache logs" ON offline_cache_log
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own cache logs
CREATE POLICY "Users insert own cache logs" ON offline_cache_log
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
