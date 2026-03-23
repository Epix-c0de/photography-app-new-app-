-- =============================================
-- COMPLETE FIX FOR 42P17 ERROR - INCLUDES TABLE CREATION
-- =============================================

-- This SQL script creates the gallery_photos table (if needed) and fixes the RLS policies
-- Copy and paste this into your Supabase SQL editor to apply the complete fix

-- Step 1: Create gallery_photos table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'gallery_photos'
  ) THEN
    CREATE TABLE public.gallery_photos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      gallery_id uuid NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
      photo_url text NOT NULL,
      file_name text NOT NULL,
      file_size bigint NOT NULL,
      mime_type text NOT NULL,
      width integer,
      height integer,
      is_watermarked boolean NOT NULL DEFAULT false,
      upload_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Create index for faster gallery queries
    CREATE INDEX gallery_photos_gallery_id_idx ON public.gallery_photos(gallery_id);
    CREATE INDEX gallery_photos_upload_order_idx ON public.gallery_photos(upload_order);
    
    RAISE NOTICE 'Created gallery_photos table';
  ELSE
    RAISE NOTICE 'gallery_photos table already exists';
  END IF;
END $$;

-- Step 2: Enable RLS on gallery_photos table
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop any existing problematic policies
DROP POLICY IF EXISTS "Admins can manage gallery photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Super admins can manage all gallery photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Clients can view their photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Gallery owners can manage their photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Super admins can manage all photos" ON public.gallery_photos;

-- Step 4: Create simplified, non-recursive policies for gallery_photos
-- Policy 1: Gallery owners can manage their photos (non-recursive)
CREATE POLICY "Gallery owners can manage their photos"
  ON public.gallery_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = gallery_photos.gallery_id
      AND g.owner_admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = gallery_photos.gallery_id
      AND g.owner_admin_id = auth.uid()
    )
  );

-- Policy 2: Super admins can manage all photos (non-recursive)
CREATE POLICY "Super admins can manage all photos"
  ON public.gallery_photos FOR ALL
  USING (
    auth.uid() IN (
      SELECT up.id FROM public.user_profiles up
      WHERE up.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT up.id FROM public.user_profiles up
      WHERE up.role IN ('admin', 'super_admin')
    )
  );

-- Policy 3: Clients can view their photos (non-recursive)
CREATE POLICY "Clients can view their photos"
  ON public.gallery_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = gallery_photos.gallery_id
      AND g.client_id IN (
        SELECT c.id FROM public.clients c
        WHERE c.user_id = auth.uid()
      )
    )
  );

-- Step 5: Fix storage policies for client-photos bucket
DROP POLICY IF EXISTS "Admins can upload client photos" ON storage.objects;
DROP POLICY IF EXISTS "Clients can view their photos" ON storage.objects;

-- Non-recursive storage upload policy
CREATE POLICY "Admins can upload client photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-photos'
    AND (storage.foldername(name))[1] = 'clients'
    AND auth.uid() IN (
      SELECT up.id FROM public.user_profiles up
      WHERE up.role IN ('admin', 'super_admin')
    )
  );

-- Non-recursive storage view policy
CREATE POLICY "Clients can view their photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-photos'
    AND EXISTS (
      SELECT 1 FROM public.gallery_photos gp
      JOIN public.galleries g ON gp.gallery_id = g.id
      JOIN public.clients c ON g.client_id = c.id
      WHERE c.user_id = auth.uid()
      AND gp.photo_url LIKE '%' || storage.objects.name
    )
  );

-- Step 6: Test the fix
DO $$
BEGIN
  RAISE NOTICE 'Testing gallery_photos RLS policies...';
  
  -- Check if policies were created successfully
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gallery_photos' 
    AND polname = 'Gallery owners can manage their photos'
  ) THEN
    RAISE NOTICE '✅ Gallery owners policy created successfully';
  ELSE
    RAISE NOTICE '❌ Gallery owners policy creation failed';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gallery_photos' 
    AND polname = 'Super admins can manage all photos'
  ) THEN
    RAISE NOTICE '✅ Super admins policy created successfully';
  ELSE
    RAISE NOTICE '❌ Super admins policy creation failed';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gallery_photos' 
    AND polname = 'Clients can view their photos'
  ) THEN
    RAISE NOTICE '✅ Clients view policy created successfully';
  ELSE
    RAISE NOTICE '❌ Clients view policy creation failed';
  END IF;
  
  RAISE NOTICE 'Fix applied successfully! Test your admin upload screen now.';
END $$;

-- =============================================
-- COMPLETE FIX APPLIED - TEST YOUR UPLOAD SCREEN
-- =============================================