-- ============================================
-- PHASE 6: PLATFORM SETTINGS + SUPPORT CHAT
-- ============================================

-- 1. Platform settings table (super admin configures M-Pesa till, WhatsApp, etc.)
CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default values (won't overwrite existing)
INSERT INTO platform_settings (key, value) VALUES
  ('platform_mpesa_till',          ''),
  ('platform_mpesa_account_ref',   'EPIX'),
  ('platform_whatsapp_number',     ''),
  ('platform_subscription_amount', '500'),
  ('platform_app_name',            'Epix Visuals Studios'),
  ('platform_support_email',       'epixshots002@gmail.com'),
  ('platform_app_android_link',    ''),
  ('platform_app_ios_link',        '')
ON CONFLICT (key) DO NOTHING;

-- RLS: super_admin can read/write, authenticated can read
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_manage_platform_settings" ON platform_settings;
DROP POLICY IF EXISTS "authenticated_read_platform_settings" ON platform_settings;

CREATE POLICY "super_admin_manage_platform_settings" ON platform_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "authenticated_read_platform_settings" ON platform_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Support messages table (super admin <-> photographer chat)
CREATE TABLE IF NOT EXISTS support_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id  UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  super_admin_id   UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
  content          TEXT        NOT NULL,
  sender_role      TEXT        NOT NULL CHECK (sender_role IN ('photographer', 'super_admin')),
  is_read          BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_photographer ON support_messages(photographer_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_unread ON support_messages(photographer_id, sender_role, is_read);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON support_messages(created_at DESC);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photographer_own_support_messages" ON support_messages;
DROP POLICY IF EXISTS "super_admin_all_support_messages" ON support_messages;

-- Photographers can read/write their own messages
CREATE POLICY "photographer_own_support_messages" ON support_messages
  FOR ALL USING (photographer_id = auth.uid());

-- Super admin can read/write all messages
CREATE POLICY "super_admin_all_support_messages" ON support_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Enable realtime for support_messages
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
