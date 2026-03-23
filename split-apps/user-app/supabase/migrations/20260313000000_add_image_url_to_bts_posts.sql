-- Add image_url column to bts_posts table for video thumbnails
ALTER TABLE public.bts_posts
ADD COLUMN IF NOT EXISTS image_url text;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_bts_posts_image_url ON public.bts_posts(image_url);
