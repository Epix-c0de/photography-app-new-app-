-- ============================================
-- FIX: Add missing columns to bookings and packages
-- ============================================

-- Add shoot_type to bookings (used by admin app booking cards)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS shoot_type TEXT;

-- Add notes to bookings (used by admin app booking cards)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add deposit_paid to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT false;

-- Add shoot_type to packages for future use (optional, not required by current queries)
-- packages already has: name, price, sms_included, storage_limit_gb, features, is_active
-- No shoot_type needed — bookings.shoot_type is the source of truth

-- Ensure packages has description column
ALTER TABLE packages ADD COLUMN IF NOT EXISTS description TEXT;

-- Index for faster booking lookups by admin
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
