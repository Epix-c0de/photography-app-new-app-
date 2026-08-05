-- Add owner_admin_id to bookings table for multi-admin support
-- This links each booking to the admin who owns the client relationship

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS owner_admin_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Backfill from existing client-admin relationship
UPDATE bookings b
SET owner_admin_id = c.owner_admin_id
FROM clients c
WHERE b.user_id = c.user_id
AND b.owner_admin_id IS NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_bookings_owner_admin_id ON bookings(owner_admin_id);
