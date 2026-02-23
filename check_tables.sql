-- =============================================
-- DIAGNOSTIC: CHECK WHAT TABLES EXIST
-- =============================================

-- First, let's see what tables actually exist in your database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if gallery_photos exists specifically
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'gallery_photos'
);

-- Check what the current schema looks like
  