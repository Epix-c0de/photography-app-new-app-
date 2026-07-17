-- Add category column to packages table to link packages with portfolio categories
-- This enables "Wedding Portfolio → Wedding Package" flow

ALTER TABLE packages ADD COLUMN IF NOT EXISTS category text;

-- Create an index for fast category filtering
CREATE INDEX IF NOT EXISTS idx_packages_category ON packages(category) WHERE is_active = true;

-- Backfill: set category based on package name patterns (optional heuristic)
-- Admins can manually update afterwards
UPDATE packages SET category = 'Wedding' WHERE LOWER(name) LIKE '%wedding%' AND category IS NULL;
UPDATE packages SET category = 'Portrait' WHERE LOWER(name) LIKE '%portrait%' AND category IS NULL;
UPDATE packages SET category = 'Corporate' WHERE LOWER(name) LIKE '%corporate%' AND category IS NULL;
UPDATE packages SET category = 'Event' WHERE LOWER(name) LIKE '%event%' AND category IS NULL;
UPDATE packages SET category = 'Maternity' WHERE LOWER(name) LIKE '%maternity%' AND category IS NULL;
UPDATE packages SET category = 'Newborn' WHERE LOWER(name) LIKE '%newborn%' AND category IS NULL;
UPDATE packages SET category = 'Fashion' WHERE LOWER(name) LIKE '%fashion%' AND category IS NULL;
