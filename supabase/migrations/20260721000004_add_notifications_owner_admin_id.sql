-- Add owner_admin_id to notifications so client app can show which admin sent the notification
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS owner_admin_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_owner_admin_id ON notifications(owner_admin_id);

-- Backfill owner_admin_id from data.from_admin where available
UPDATE notifications
SET owner_admin_id = (data->>'from_admin')::uuid
WHERE owner_admin_id IS NULL
  AND data ? 'from_admin'
  AND (data->>'from_admin') IS NOT NULL;
