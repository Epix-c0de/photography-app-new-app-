-- Create the 'portfolio' storage bucket if it doesn't exist
-- Admin uploads use this bucket but no migration ever created it or added read policies

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('portfolio', 'portfolio', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read: anyone can view portfolio files
DROP POLICY IF EXISTS "Anyone can view portfolio files" ON storage.objects;
CREATE POLICY "Anyone can view portfolio files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio');

-- Admins can upload portfolio files
DROP POLICY IF EXISTS "Admins can upload portfolio files" ON storage.objects;
CREATE POLICY "Admins can upload portfolio files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'portfolio'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can delete their own portfolio files
DROP POLICY IF EXISTS "Admins can delete portfolio files" ON storage.objects;
CREATE POLICY "Admins can delete portfolio files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'portfolio'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
