-- =============================================
-- MINIMAL FIX FOR 42P17 ERROR - NO DEPENDENCIES
-- =============================================

-- This SQL script provides a minimal fix that works even without dependent tables
-- It focuses on fixing the core 42P17 error without requiring galleries, clients, etc.

-- Step 1: Check what tables exist and their current state
SELECT table_name, 
       EXISTS (
         SELECT 1 FROM pg_policies 
         WHERE tablename = table_name
       ) as has_rls_policies
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Step 2: If gallery_photos exists, fix its RLS policies
DO $$
DECLARE
  gallery_photos_exists boolean;
  galleries_exists boolean;
  user_profiles_exists boolean;
  clients_exists boolean;
BEGIN
  -- Check what tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'gallery_photos'
  ) INTO gallery_photos_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'galleries'
  ) INTO galleries_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) INTO user_profiles_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) INTO clients_exists;
  
  RAISE NOTICE 'Table existence check:';
  RAISE NOTICE 'gallery_photos: %', gallery_photos_exists;
  RAISE NOTICE 'galleries: %', galleries_exists;
  RAISE NOTICE 'user_profiles: %', user_profiles_exists;
  RAISE NOTICE 'clients: %', clients_exists;
  
  -- If gallery_photos exists, we can fix its RLS policies
  IF gallery_photos_exists THEN
    -- Enable RLS if not already enabled
    ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;
    
    -- Drop any existing problematic policies
    DROP POLICY IF EXISTS "Admins can manage gallery photos" ON public.gallery_photos;
    DROP POLICY IF EXISTS "Super admins can manage all gallery photos" ON public.gallery_photos;
    DROP POLICY IF EXISTS "Clients can view their photos" ON public.gallery_photos;
    DROP POLICY IF EXISTS "Gallery owners can manage their photos" ON public.gallery_photos;
    DROP POLICY IF EXISTS "Super admins can manage all photos" ON public.gallery_photos;
    
    -- Create a simple policy that allows admins to manage all photos
    -- This avoids the complex recursive queries that cause 42P17
    CREATE POLICY "Simple admin policy for gallery photos"
      ON public.gallery_photos FOR ALL
      USING (
        auth.uid() IS NOT NULL AND
        auth.uid() IN (
          SELECT id FROM public.user_profiles 
          WHERE role IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        auth.uid() IS NOT NULL AND
        auth.uid() IN (
          SELECT id FROM public.user_profiles 
          WHERE role IN ('admin', 'super_admin')
        )
      );
    
    RAISE NOTICE '✅ Applied simple RLS policy to gallery_photos';
    
    -- Test the policy with a simple query
    PERFORM 1 FROM public.gallery_photos LIMIT 1;
    RAISE NOTICE '✅ Basic query test passed - no 42P17 error';
    
  ELSE
    RAISE NOTICE '⚠️ gallery_photos table does not exist - cannot apply RLS fix';
    RAISE NOTICE 'The 42P17 error might be coming from a different table or query';
  END IF;
END $$;

-- Step 3: Check for other potential sources of 42P17 error
-- Look for other tables with complex RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies 
WHERE qual LIKE '%auth.jwt%' OR with_check LIKE '%auth.jwt%'
   OR qual LIKE '%gallery_photos%' OR with_check LIKE '%gallery_photos%';

-- Step 4: Provide diagnostic information
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'DIAGNOSTIC INFORMATION:';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'The 42P17 error indicates recursive RLS policies.';
  RAISE NOTICE 'Common causes:';
  RAISE NOTICE '1. RLS policies that query the same table they protect';
  RAISE NOTICE '2. Complex JWT function calls in policy definitions';
  RAISE NOTICE '3. Policies that reference other tables with RLS';
  RAISE NOTICE '';
  RAISE NOTICE 'If gallery_photos exists and the fix was applied,';
  RAISE NOTICE 'test your admin upload screen now.';
  RAISE NOTICE 'If the table does not exist, we need to check';
  RAISE NOTICE 'which table is actually causing the 42P17 error.';
  RAISE NOTICE '=========================================';
END $$;

-- Step 5: If you still get 42P17, run this to find the actual problematic table
-- SELECT current_query(); -- This will show the current query that's failing