-- ============================================
-- UPGRADE SUPPORT CHAT: Message types, categories, priorities, media
-- Created: 2026-07-16
-- ============================================

-- 1. Add message_type column (text, image, file)
ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'image', 'file'));

-- 2. Add category column for issue categorization
ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
  CHECK (category IN ('general', 'billing', 'technical', 'feature_request', 'bug_report'));

-- 3. Add priority column
ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS priority TEXT
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- 4. Add media_url for image/file attachments
ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- 5. Add file_name for document attachments
ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS file_name TEXT;

-- 6. Update sender_role to allow 'admin' (admins sending from admin app)
ALTER TABLE support_messages
  DROP CONSTRAINT IF EXISTS support_messages_sender_role_check;

ALTER TABLE support_messages
  ADD CONSTRAINT support_messages_sender_role_check
  CHECK (sender_role IN ('photographer', 'admin', 'super_admin', 'master_admin'));

-- 7. Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_support_messages_category ON support_messages(category);
CREATE INDEX IF NOT EXISTS idx_support_messages_priority ON support_messages(priority) WHERE priority IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_messages_type ON support_messages(message_type);

-- 8. Enable RLS for media_url access via storage (already enabled)
-- 9. Add policy for admins to update read status on their own messages
DROP POLICY IF EXISTS "admin_own_support_messages" ON support_messages;
CREATE POLICY "admin_own_support_messages" ON support_messages
  FOR UPDATE USING (photographer_id = auth.uid());

-- 10. Create storage bucket for support attachments if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-media', 'support-media', true)
ON CONFLICT (id) DO NOTHING;

-- 11. Storage policies for support media
DROP POLICY IF EXISTS "support_media_upload" ON storage.objects;
CREATE POLICY "support_media_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'support-media'
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "support_media_read" ON storage.objects;
CREATE POLICY "support_media_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'support-media'
  );
