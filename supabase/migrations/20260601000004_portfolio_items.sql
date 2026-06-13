-- ============================================
-- PHASE 6: PORTFOLIO ITEMS TABLE
-- ============================================

-- Drop and recreate cleanly to fix any partial/broken prior run.
-- Safe because portfolio_items is new — no existing data to lose.
DROP TABLE IF EXISTS portfolio_items CASCADE;

CREATE TABLE portfolio_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  photo_url     TEXT        NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'Other',
  is_featured   BOOLEAN     NOT NULL DEFAULT false,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_portfolio_items_admin_id  ON portfolio_items(admin_id);
CREATE INDEX idx_portfolio_items_featured  ON portfolio_items(admin_id, is_featured);
CREATE INDEX idx_portfolio_items_category  ON portfolio_items(admin_id, category);
CREATE INDEX idx_portfolio_items_order     ON portfolio_items(admin_id, display_order);

-- RLS
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_portfolio" ON portfolio_items
  FOR ALL USING (admin_id = auth.uid());

CREATE POLICY "public_view_portfolio" ON portfolio_items
  FOR SELECT USING (true);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_portfolio_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portfolio_items_updated_at ON portfolio_items;
CREATE TRIGGER portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION update_portfolio_items_updated_at();

-- ============================================
-- STORAGE BUCKET FOR PORTFOLIO PHOTOS
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio',
  'portfolio',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

DROP POLICY IF EXISTS "admin_upload_portfolio"  ON storage.objects;
DROP POLICY IF EXISTS "admin_read_portfolio"    ON storage.objects;
DROP POLICY IF EXISTS "admin_update_portfolio"  ON storage.objects;
DROP POLICY IF EXISTS "admin_delete_portfolio"  ON storage.objects;

CREATE POLICY "admin_upload_portfolio" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'portfolio'
    AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );

CREATE POLICY "admin_read_portfolio" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'portfolio'
    AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );

CREATE POLICY "admin_update_portfolio" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'portfolio'
    AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );

CREATE POLICY "admin_delete_portfolio" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'portfolio'
    AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  );

-- ============================================
-- MESSAGES: is_read column for inbox tracking
-- ============================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_is_read
  ON messages(client_id, sender_role, is_read);
