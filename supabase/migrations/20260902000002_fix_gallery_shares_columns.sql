-- Add all missing columns that ShareGalleryModal expects
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS require_password BOOLEAN DEFAULT false;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS allow_downloads BOOLEAN DEFAULT true;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS allow_original_quality BOOLEAN DEFAULT false;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS allow_bulk_download BOOLEAN DEFAULT false;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS watermarked_downloads BOOLEAN DEFAULT false;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS allow_reshare BOOLEAN DEFAULT false;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS allow_photo_sharing BOOLEAN DEFAULT true;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS max_views INTEGER;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS gallery_display_name TEXT;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS gallery_description TEXT;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark_luxury';
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS layout TEXT DEFAULT 'grid';
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS enable_watermark BOOLEAN DEFAULT false;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS watermark_text TEXT;
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS watermark_position TEXT DEFAULT 'bottom_right';
ALTER TABLE public.gallery_shares ADD COLUMN IF NOT EXISTS watermark_opacity DECIMAL(3,2) DEFAULT 0.5;

-- Make client_id nullable if it exists (modal doesn't set it, only gallery_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_shares' AND column_name = 'client_id') THEN
    ALTER TABLE public.gallery_shares ALTER COLUMN client_id DROP NOT NULL;
  END IF;
END $$;

-- Make created_by nullable (ShareGalleryModal sets it, but allow null)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_shares' AND column_name = 'created_by') THEN
    ALTER TABLE public.gallery_shares ALTER COLUMN created_by DROP NOT NULL;
  END IF;
END $$;

-- Fix RLS: allow authenticated users to insert their own shares
DROP POLICY IF EXISTS "Clients can manage their shares" ON public.gallery_shares;
DROP POLICY IF EXISTS "Authenticated users can manage gallery shares" ON public.gallery_shares;
CREATE POLICY "Authenticated users can manage gallery shares"
  ON public.gallery_shares FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
