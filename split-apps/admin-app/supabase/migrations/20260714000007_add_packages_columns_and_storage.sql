-- Add missing columns to packages table
-- cover_image_url, description, detailed_description, is_popular

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS detailed_description text,
  ADD COLUMN IF NOT EXISTS is_popular boolean not null default false;

-- Create package-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('package-images', 'package-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for package-images bucket
DROP POLICY IF EXISTS "Admins can upload package images" ON storage.objects;
CREATE POLICY "Admins can upload package images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'package-images'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Anyone can view package images" ON storage.objects;
CREATE POLICY "Anyone can view package images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'package-images');

DROP POLICY IF EXISTS "Admins can delete package images" ON storage.objects;
CREATE POLICY "Admins can delete package images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'package-images'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
