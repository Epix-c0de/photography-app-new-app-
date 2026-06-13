-- ============================================
-- STORAGE BUCKETS SETUP
-- ============================================

-- 1. Client photos (private — signed URLs only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-photos',
  'client-photos',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Thumbnails (private — signed URLs only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails',
  'thumbnails',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Avatars (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 4. BTS / portfolio media (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bts-media',
  'bts-media',
  true,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Brand assets (public — logos, watermark images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- Drop existing policies first to avoid conflicts
-- ============================================

DROP POLICY IF EXISTS "Admins can upload client photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read their client photos" ON storage.objects;
DROP POLICY IF EXISTS "Clients can read their own gallery photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload BTS media" ON storage.objects;
DROP POLICY IF EXISTS "BTS media is publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Brand assets are publicly readable" ON storage.objects;

-- ============================================
-- client-photos policies
-- Fix: qualify 'name' as storage.objects.name to avoid ambiguity
-- when JOINing with tables that also have a 'name' column
-- ============================================

CREATE POLICY "Admins can upload client photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-photos'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can read their client photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-photos'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

-- Fix: use storage.objects.name explicitly to resolve ambiguity
-- (galleries and clients tables also have a 'name' column)
CREATE POLICY "Clients can read their own gallery photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-photos'
  AND (
    -- Allow if the user owns a client record linked to this gallery
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN galleries g ON g.client_id = c.id
      WHERE c.user_id = auth.uid()
        AND (storage.foldername(storage.objects.name))[2] = g.id::text
    )
    OR
    -- Allow if the user has an unlocked gallery entry
    EXISTS (
      SELECT 1
      FROM unlocked_galleries ug
      JOIN galleries g ON g.id = ug.gallery_id
      WHERE ug.user_id = auth.uid()
        AND (storage.foldername(storage.objects.name))[2] = g.id::text
    )
  )
);

-- ============================================
-- avatars policies
-- ============================================

-- Fix: qualify name as storage.objects.name
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
);

CREATE POLICY "Avatars are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================
-- bts-media policies
-- ============================================

CREATE POLICY "Admins can upload BTS media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bts-media'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "BTS media is publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bts-media');

-- ============================================
-- brand-assets policies
-- ============================================

CREATE POLICY "Admins can upload brand assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'brand-assets'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Brand assets are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'brand-assets');

-- ============================================
-- thumbnails policies (same as client-photos)
-- ============================================

DROP POLICY IF EXISTS "Admins can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Clients can read their own thumbnails" ON storage.objects;

CREATE POLICY "Admins can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'thumbnails'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Clients can read their own thumbnails"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'thumbnails'
  AND (
    EXISTS (
      SELECT 1
      FROM clients c
      JOIN galleries g ON g.client_id = c.id
      WHERE c.user_id = auth.uid()
        AND (storage.foldername(storage.objects.name))[2] = g.id::text
    )
    OR
    EXISTS (
      SELECT 1
      FROM unlocked_galleries ug
      JOIN galleries g ON g.id = ug.gallery_id
      WHERE ug.user_id = auth.uid()
        AND (storage.foldername(storage.objects.name))[2] = g.id::text
    )
  )
);
