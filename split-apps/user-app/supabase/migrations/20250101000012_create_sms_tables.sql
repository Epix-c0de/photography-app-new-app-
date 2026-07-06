-- SMS and WhatsApp message logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  gallery_id UUID REFERENCES galleries(id),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  provider TEXT DEFAULT 'africastalking', -- africastalking, whatsapp, native
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
  provider_ref TEXT,
  cost DECIMAL(10,4),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sms_logs_photographer ON sms_logs(photographer_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_client ON sms_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at);

-- RLS policies
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Photographers can view their own SMS logs
CREATE POLICY "Photographers view own SMS logs" ON sms_logs
  FOR SELECT
  USING (photographer_id = auth.uid());

-- Service role can insert/update
CREATE POLICY "Service role manages SMS logs" ON sms_logs
  FOR ALL
  TO service_role
  USING (true);


-- SMS credits for photographers
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS sms_credits DECIMAL(10,2) DEFAULT 0;

-- Function to deduct SMS credits
CREATE OR REPLACE FUNCTION deduct_sms_credits(p_photographer_id UUID, p_amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET sms_credits = GREATEST(0, COALESCE(sms_credits, 0) - p_amount)
  WHERE id = p_photographer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add SMS credits
CREATE OR REPLACE FUNCTION add_sms_credits(p_photographer_id UUID, p_amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET sms_credits = COALESCE(sms_credits, 0) + p_amount
  WHERE id = p_photographer_id;
END;
$$ LANGUAGE plpgsql;


-- SMS templates for common messages
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- e.g. ["client_name", "gallery_name", "access_code"]
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;

-- Photographers can manage their own templates
CREATE POLICY "Photographers manage own templates" ON sms_templates
  FOR ALL
  USING (photographer_id = auth.uid());

-- Insert default templates
INSERT INTO sms_templates (name, body, variables, is_default) VALUES
(
  'Gallery Ready (SMS)',
  'Hello {client_name}, your photos are ready!\n\nDirect Link: {app_link}{access_code}\n\nUse code: {access_code} to unlock if the link doesn''t open.\n\n{business_name}',
  '["client_name", "gallery_name", "access_code", "app_link", "business_name"]',
  true
),
(
  'Gallery Ready (WhatsApp)',
  '📸 *{gallery_name}*\n\nHi {client_name}! Your photos are ready to view and download.\n\n🔗 View Gallery: {app_link}{access_code}\n🔑 Access Code: {access_code}\n\nThank you! 📷',
  '["client_name", "gallery_name", "access_code", "app_link"]',
  true
),
(
  'Payment Reminder',
  'Hi {client_name}, reminder: KES {amount} payment due for {gallery_name}.\n\nPay here: {app_link}',
  '["client_name", "gallery_name", "amount", "app_link"]',
  true
),
(
  'Gallery Expiring',
  'Hi {client_name}, your {gallery_name} gallery will expire in {days} days.\n\nDownload your photos: {app_link}{access_code}',
  '["client_name", "gallery_name", "days", "access_code", "app_link"]',
  true
)
ON CONFLICT DO NOTHING;
