-- Ensure media bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Note: We cannot enable RLS on storage.objects table as it requires owner permissions
-- The storage bucket public access setting is sufficient for uploads

-- Policy for admins to manage media bucket
DROP POLICY IF EXISTS "Admins manage media bucket" ON storage.objects;
CREATE POLICY "Admins manage media bucket"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Policy for public read (since it's a public bucket, this might be redundant for public access via URL, but good for SELECT via SDK)
DROP POLICY IF EXISTS "Public read media bucket" ON storage.objects;
CREATE POLICY "Public read media bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');
