-- Migration: Create Package Images Storage Bucket
-- Date: 2026-04-22
-- Purpose: Create storage bucket for package cover images and example photos

-- 1. Create the package-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('package-images', 'package-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create policies for package-images bucket

-- Allow admins to upload package images
CREATE POLICY "Admins can upload package images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'package-images' 
  AND (
    SELECT role FROM public.user_profiles 
    WHERE id = auth.uid() LIMIT 1
  ) IN ('admin', 'super_admin', 'master_admin')
  AND (storage.foldername(name))[1] = 'package-covers'
);

-- Allow admins to update package images
CREATE POLICY "Admins can update package images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'package-images' 
  AND (
    SELECT role FROM public.user_profiles 
    WHERE id = auth.uid() LIMIT 1
  ) IN ('admin', 'super_admin', 'master_admin')
);

-- Allow admins to delete their own package images
CREATE POLICY "Admins can delete package images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'package-images' 
  AND (
    SELECT role FROM public.user_profiles 
    WHERE id = auth.uid() LIMIT 1
  ) IN ('admin', 'super_admin', 'master_admin')
);

-- Allow everyone to view package images (public bucket)
CREATE POLICY "Package images are public"
ON storage.objects FOR SELECT
USING (bucket_id = 'package-images');

-- 3. Create a function to generate signed URLs for package images
CREATE OR REPLACE FUNCTION public.get_package_image_url(image_path text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  signed_url text;
BEGIN
  -- Generate signed URL for the package image (valid for 1 hour)
  SELECT signed_url INTO signed_url
  FROM storage.get_presigned_url(
    'package-images',
    image_path,
    3600 -- 1 hour expiration
  );
  
  RETURN COALESCE(signed_url, '');
END;
$$;

-- Grant execute permission for the function
GRANT EXECUTE ON FUNCTION public.get_package_image_url TO authenticated;

-- 4. Create a function to upload package image
CREATE OR REPLACE FUNCTION public.upload_package_image(
  package_id uuid,
  image_data bytea,
  file_name text,
  content_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  file_path text;
  admin_id uuid;
BEGIN
  -- Verify current user is an admin
  SELECT id INTO admin_id
  FROM public.user_profiles
  WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'master_admin');
  
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can upload package images';
  END IF;
  
  -- Construct file path
  file_path := 'package-covers/' || package_id || '/' || file_name;
  
  -- Insert the image into storage
  INSERT INTO storage.objects (
    bucket_id,
    name,
    file_size,
    content_type,
    created_at,
    updated_at,
    owner
  ) VALUES (
    'package-images',
    file_path,
    octet_length(image_data),
    content_type,
    now(),
    now(),
    admin_id
  );
  
  -- Return the public URL
  RETURN 'https://ujunohfpcmjywsblsoel.supabase.co/storage/v1/object/public/package-images/' || file_path;
END;
$$;

-- Grant execute permission for the upload function
GRANT EXECUTE ON FUNCTION public.upload_package_image TO authenticated;

-- 5. Create a view for package images with URLs
CREATE OR REPLACE VIEW public.package_images_view AS
SELECT 
  p.id as package_id,
  p.name as package_name,
  p.cover_image_url,
  CASE 
    WHEN p.cover_image_url IS NOT NULL THEN
      'https://ujunohfpcmjywsblsoel.supabase.co/storage/v1/object/public/package-images/' || p.cover_image_url
    ELSE NULL
  END as full_image_url
FROM public.packages p
WHERE p.cover_image_url IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public.package_images_view TO authenticated;

-- 6. Add example photos to packages functionality
CREATE TABLE IF NOT EXISTS public.package_example_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  photo_order integer DEFAULT 0,
  caption text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_package_example_photos_package_id ON public.package_example_photos(package_id);
CREATE INDEX IF NOT EXISTS idx_package_example_photos_order ON public.package_example_photos(package_id, photo_order);

-- Grant permissions
GRANT ALL ON public.package_example_photos TO authenticated;

-- 7. Create view for packages with example photos
CREATE OR REPLACE VIEW public.packages_with_examples_view AS
SELECT 
  p.*,
  COUNT(pep.id) as example_photo_count,
  ARRAY_AGG(pep.photo_url ORDER BY pep.photo_order) FILTER (WHERE pep.photo_url IS NOT NULL) as example_photos
FROM public.packages p
LEFT JOIN public.package_example_photos pep ON p.id = pep.package_id
GROUP BY p.id, p.name, p.price, p.sms_included, p.storage_limit_gb, p.features, p.is_active, p.description, p.detailed_description, p.is_popular, p.cover_image_url, p.created_at, p.updated_at, p.owner_admin_id;

-- Grant access to the view
GRANT SELECT ON public.packages_with_examples_view TO authenticated;

-- 8. Create function to add example photo to package
CREATE OR REPLACE FUNCTION public.add_package_example_photo(
  package_id uuid,
  photo_url text,
  photo_order integer DEFAULT NULL,
  caption text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_id uuid;
  new_photo_id uuid;
  max_order integer;
BEGIN
  -- Verify current user is an admin
  SELECT id INTO admin_id
  FROM public.user_profiles
  WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'master_admin');
  
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can add package example photos';
  END IF;
  
  -- If photo_order is not provided, get the next available order
  IF photo_order IS NULL THEN
    SELECT COALESCE(MAX(photo_order), 0) + 1 INTO max_order
    FROM public.package_example_photos
    WHERE package_id = package_id;
    
    photo_order := max_order;
  END IF;
  
  -- Insert the example photo
  INSERT INTO public.package_example_photos (
    package_id,
    photo_url,
    photo_order,
    caption
  ) VALUES (
    package_id,
    photo_url,
    photo_order,
    caption
  ) RETURNING id INTO new_photo_id;
  
  RETURN new_photo_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.add_package_example_photo TO authenticated;

-- 9. Create function to remove package example photo
CREATE OR REPLACE FUNCTION public.remove_package_example_photo(photo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_id uuid;
  package_id uuid;
BEGIN
  -- Verify current user is an admin
  SELECT id INTO admin_id
  FROM public.user_profiles
  WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'master_admin');
  
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can remove package example photos';
  END IF;
  
  -- Get package_id for logging
  SELECT package_id INTO package_id
  FROM public.package_example_photos
  WHERE id = photo_id;
  
  -- Delete the photo
  DELETE FROM public.package_example_photos
  WHERE id = photo_id;
  
  -- Return success
  RETURN FOUND;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.remove_package_example_photo TO authenticated;

COMMIT;

-- Usage Instructions:
-- 1. Run this migration to create the storage bucket and policies
-- 2. Package cover images should be uploaded to: package-images/package-covers/{package_id}/{filename}
-- 3. Example photos can be added using the add_package_example_photo function
-- 4. All package images are publicly accessible
-- 5. Use the packages_with_examples_view to get packages with their example photos
