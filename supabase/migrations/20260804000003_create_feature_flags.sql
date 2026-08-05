-- Feature flags table for toggling platform features
-- Super admins can enable/disable features across the platform

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: anyone authenticated can read, only super_admin can write
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON feature_flags FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Super admin can manage feature flags"
  ON feature_flags FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Seed default flags
INSERT INTO feature_flags (key, enabled, label, description, category) VALUES
  ('bts_posts', true, 'BTS Posts', 'Behind-the-scenes content from photographers', 'content'),
  ('announcements', true, 'Announcements', 'Platform and photographer announcements', 'content'),
  ('portfolio', true, 'Portfolio', 'Photographer portfolio showcase', 'content'),
  ('galleries', true, 'Galleries', 'Client photo galleries', 'content'),
  ('messaging', true, 'Messaging', 'Client-admin messaging system', 'communication'),
  ('sms_notifications', true, 'SMS Notifications', 'SMS alerts for bookings and updates', 'communication'),
  ('whatsapp', false, 'WhatsApp Integration', 'WhatsApp Business messaging', 'communication'),
  ('bookings', true, 'Bookings', 'Photography session bookings', 'commerce'),
  ('payments', true, 'Payments', 'M-Pesa payment processing', 'commerce'),
  ('packages', true, 'Packages', 'Photography service packages', 'commerce'),
  ('cloud_storage', true, 'Cloud Storage', 'Cloud-based photo storage and delivery', 'infrastructure'),
  ('social_sharing', true, 'Social Sharing', 'Share content to social platforms', 'social'),
  ('referrals', false, 'Referral System', 'Client referral program', 'growth'),
  ('analytics', true, 'Analytics', 'Platform usage analytics', 'insights')
ON CONFLICT (key) DO NOTHING;
