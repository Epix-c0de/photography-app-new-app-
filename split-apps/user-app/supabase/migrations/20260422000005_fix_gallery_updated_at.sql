-- Migration: Fix Galleries Table Missing updated_at Column
-- Date: 2026-04-22
-- Purpose: Add missing updated_at column to galleries table for admin deletion functionality

-- 1. Add updated_at column to galleries table if it doesn't exist
ALTER TABLE public.galleries 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_galleries_updated_at ON public.galleries(updated_at);

-- 3. Update existing galleries to have updated_at set to their created_at
UPDATE public.galleries 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 4. Set default value for future inserts
ALTER TABLE public.galleries 
ALTER COLUMN updated_at SET DEFAULT now();

-- 5. Create trigger to automatically update updated_at on gallery changes
CREATE OR REPLACE FUNCTION public.update_gallery_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_gallery_updated_at_trigger ON public.galleries;

-- Create the trigger
CREATE TRIGGER update_gallery_updated_at_trigger
BEFORE UPDATE ON public.galleries
FOR EACH ROW
EXECUTE FUNCTION public.update_gallery_updated_at();

-- 6. Verify the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'galleries' 
AND table_schema = 'public'
ORDER BY ordinal_position;

COMMIT;

-- Usage Instructions:
-- 1. Run this migration to fix the admin deletion error
-- 2. The galleries table will now have the updated_at column
-- 3. Admin deletion should work properly without errors
-- 4. Existing galleries will have their updated_at set to created_at
