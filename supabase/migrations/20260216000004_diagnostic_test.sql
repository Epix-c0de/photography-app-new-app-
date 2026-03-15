-- =============================================
-- DIAGNOSTIC TEST FOR 42P17 ERROR RESOLUTION
-- =============================================

-- This is a temporary diagnostic script to test if the recursion issue is resolved
-- Run this SQL in your Supabase SQL editor to verify the fix

-- Test 1: Basic INSERT without RLS (should work)
SET session_replication_role = replica;

-- This should succeed if the basic table structure is correct
/*
INSERT INTO public.gallery_photos (
  gallery_id, 
  photo_url, 
  file_name, 
  file_size, 
  mime_type, 
  upload_order
) VALUES (
  'test-gallery-id', 
  'test/path/photo.jpg', 
  'test-photo.jpg', 
  1024, 
  'image/jpeg', 
  0
);
*/

-- Reset RLS
SET session_replication_role = DEFAULT;

-- Test 2: Check if RLS policies are working without recursion
-- This will help identify if the issue is with the policies themselves
/*
SELECT 
  policyname as policy_name,
  cmd as command,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies 
WHERE tablename = 'gallery_photos';

-- Test 3: Verify the gallery_photos table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'gallery_photos';

-- Test 4: Check for any triggers that might cause recursion
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'gallery_photos';
*/

-- =============================================
-- CLEANUP: Remove test data after verification
-- =============================================
-- DELETE FROM public.gallery_photos WHERE gallery_id = 'test-gallery-id';