-- Migration: Add Package Cover Image and Description Columns
-- Date: 2026-04-22
-- Purpose: Add missing columns to packages table for enhanced package features

-- 1. Add missing columns to packages table
ALTER TABLE public.packages 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS detailed_description text,
ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cover_image_url text;

-- 2. Update the packages view in TypeScript types if needed
-- (This will be handled in the TypeScript files)

-- 3. Create index for cover_image_url for better performance
CREATE INDEX IF NOT EXISTS idx_packages_cover_image_url ON public.packages(cover_image_url) WHERE cover_image_url IS NOT NULL;

-- 4. Create index for is_popular for better performance
CREATE INDEX IF NOT EXISTS idx_packages_is_popular ON public.packages(is_popular) WHERE is_popular = true;

-- 5. Add comments to the new columns
COMMENT ON COLUMN public.packages.description IS 'Brief description of the package for quick overview';
COMMENT ON COLUMN public.packages.detailed_description IS 'Detailed description with full package details';
COMMENT ON COLUMN public.packages.is_popular IS 'Flag to highlight popular packages to clients';
COMMENT ON COLUMN public.packages.cover_image_url IS 'URL to the package cover image stored in package-images bucket';

COMMIT;

-- Usage Instructions:
-- 1. Run this migration to add the missing columns
-- 2. The package editor will now be able to save cover images and descriptions
-- 3. Popular packages can be highlighted to clients
-- 4. Package images will display properly in the user interface
