-- =====================================================
-- FIX ALL SQL ERRORS — Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- FIX 1: bts_announcements → bts_posts (table name mismatch)
-- =====================================================
-- The social_shares table references bts_announcements but the actual table is bts_posts

-- Drop and recreate social_shares with correct reference
DROP TABLE IF EXISTS social_shares CASCADE;

CREATE TABLE IF NOT EXISTS social_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bts_id UUID REFERENCES bts_posts(id) ON DELETE SET NULL,
  gallery_id UUID REFERENCES galleries(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'twitter')),
  post_id TEXT,
  post_url TEXT,
  caption TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed')),
  error_message TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE social_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photographers can view their own social shares" ON social_shares
  FOR SELECT USING (auth.uid() = photographer_id);

CREATE POLICY "Photographers can create social shares" ON social_shares
  FOR INSERT WITH CHECK (auth.uid() = photographer_id);

CREATE POLICY "System can update social shares" ON social_shares
  FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_social_shares_photographer ON social_shares(photographer_id);
CREATE INDEX IF NOT EXISTS idx_social_shares_platform ON social_shares(platform);


-- =====================================================
-- FIX 2: watermark_settings — photographer_id doesn't exist on user_profiles
-- The table uses 'id' not 'photographer_id'. Also add IF NOT EXISTS for policies
-- =====================================================

-- Drop and recreate watermark_settings (column names are fine, the issue is elsewhere)
-- Actually the table definition is correct. The error is in the policies or triggers.
-- Let's just recreate it safely:

DROP TABLE IF EXISTS watermark_settings CASCADE;

CREATE TABLE IF NOT EXISTS watermark_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  watermark_text TEXT,
  watermark_position TEXT DEFAULT 'bottomRight' CHECK (watermark_position IN ('center', 'bottomRight', 'bottomLeft', 'topRight', 'topLeft', 'tiled')),
  watermark_opacity DECIMAL(3,2) DEFAULT 0.30,
  watermark_rotation INT DEFAULT 0,
  watermark_scale DECIMAL(3,2) DEFAULT 1.00,
  watermark_color TEXT DEFAULT '#FFFFFF',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE watermark_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Photographers view own watermark settings" ON watermark_settings
    FOR SELECT USING (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Photographers insert own watermark settings" ON watermark_settings
    FOR INSERT WITH CHECK (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Photographers update own watermark settings" ON watermark_settings
    FOR UPDATE USING (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_watermark_photographer ON watermark_settings(photographer_id);

-- Drop and recreate trigger safely
DROP TRIGGER IF EXISTS update_watermark_settings_updated_at ON watermark_settings;
CREATE TRIGGER update_watermark_settings_updated_at
  BEFORE UPDATE ON watermark_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- FIX 3: events/reviews — photographer_id column
-- These tables define photographer_id themselves, so the column exists.
-- The error is likely from a PREVIOUS migration that created these tables
-- with a different column name (e.g., admin_id or owner_admin_id).
-- Drop and recreate to be safe:
-- =====================================================

DROP TABLE IF EXISTS event_reminders CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('wedding', 'portrait', 'corporate', 'event', 'graduation', 'other')),
  event_date DATE NOT NULL,
  event_time TIME,
  end_time TIME,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  gallery_id UUID REFERENCES galleries(id) ON DELETE SET NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review_text TEXT,
  review_source TEXT DEFAULT 'web' CHECK (review_source IN ('web', 'sms', 'whatsapp', 'ussd')),
  is_public BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('sms', 'whatsapp', 'email', 'push')),
  reminder_date TIMESTAMPTZ NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Photographers view own events" ON events
    FOR SELECT USING (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Photographers create own events" ON events
    FOR INSERT WITH CHECK (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Photographers update own events" ON events
    FOR UPDATE USING (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Photographers delete own events" ON events
    FOR DELETE USING (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone view public reviews" ON reviews
    FOR SELECT USING (is_public = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Photographers view own reviews" ON reviews
    FOR SELECT USING (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Clients create reviews" ON reviews
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Photographers update own reviews" ON reviews
    FOR UPDATE USING (auth.uid() = photographer_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Photographers view own event reminders" ON event_reminders
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM events
        WHERE events.id = event_reminders.event_id
        AND events.photographer_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "System create event reminders" ON event_reminders
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "System update event reminders" ON event_reminders
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_photographer ON events(photographer_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_reviews_photographer ON reviews(photographer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_gallery ON reviews(gallery_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_event_reminders_event ON event_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_status ON event_reminders(status);

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- FIX 4: ussd_requests — policy already exists
-- Drop existing policies first
-- =====================================================

DROP POLICY IF EXISTS "Photographers view own USSD requests" ON ussd_requests;
DROP POLICY IF EXISTS "Service role manages USSD requests" ON ussd_requests;

-- Now create them
DO $$ BEGIN
  CREATE POLICY "Photographers view own USSD requests" ON ussd_requests
    FOR SELECT
    USING (
      gallery_id IN (
        SELECT id FROM galleries WHERE owner_admin_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages USSD requests" ON ussd_requests
    FOR ALL
    TO service_role
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =====================================================
-- FIX 5: sms_logs — photographer_id column
-- The table defines photographer_id, but a previous migration may have
-- created it with a different column name. Drop and recreate:
-- =====================================================

DROP TABLE IF EXISTS sms_templates CASCADE;
DROP TABLE IF EXISTS sms_logs CASCADE;

CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  gallery_id UUID REFERENCES galleries(id),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  provider TEXT DEFAULT 'africastalking',
  status TEXT DEFAULT 'pending',
  provider_ref TEXT,
  cost DECIMAL(10,4),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Photographers view own SMS logs" ON sms_logs
    FOR SELECT USING (photographer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages SMS logs" ON sms_logs
    FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sms_logs_photographer ON sms_logs(photographer_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_client ON sms_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at);

-- SMS credits column
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sms_credits DECIMAL(10,2) DEFAULT 0;

-- SMS templates
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Photographers manage own templates" ON sms_templates
    FOR ALL USING (photographer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO sms_templates (name, body, variables, is_default) VALUES
(
  'Gallery Ready (SMS)',
  'Hello {client_name}, your photos are ready! Direct Link: {app_link}{access_code} Use code: {access_code} to unlock. {business_name}',
  '["client_name", "gallery_name", "access_code", "app_link", "business_name"]',
  true
),
(
  'Gallery Ready (WhatsApp)',
  'Hi {client_name}! Your photos are ready! View: {app_link}{access_code} Code: {access_code}',
  '["client_name", "gallery_name", "access_code", "app_link"]',
  true
),
(
  'Payment Reminder',
  'Hi {client_name}, reminder: KES {amount} payment due for {gallery_name}. Pay here: {app_link}',
  '["client_name", "gallery_name", "amount", "app_link"]',
  true
),
(
  'Gallery Expiring',
  'Hi {client_name}, your {gallery_name} gallery will expire in {days} days. Download: {app_link}{access_code}',
  '["client_name", "gallery_name", "days", "access_code", "app_link"]',
  true
)
ON CONFLICT DO NOTHING;


-- =====================================================
-- FIX 6: See separate file 20250101000022_fix_payment_enum.sql
-- The payment_status enum issue must be run as a separate statement
-- because PostgreSQL requires new enum values to be committed before use.
-- =====================================================
