-- Add review categories to reviews table
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS quality_rating INT CHECK (quality_rating >= 1 AND quality_rating <= 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS speed_rating INT CHECK (speed_rating >= 1 AND speed_rating <= 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS professionalism_rating INT CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS communication_rating INT CHECK (communication_rating >= 1 AND communication_rating <= 5);

-- Add review moderation columns
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_response TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_responded_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_quality ON public.reviews(quality_rating);
CREATE INDEX IF NOT EXISTS idx_reviews_speed ON public.reviews(speed_rating);
CREATE INDEX IF NOT EXISTS idx_reviews_professionalism ON public.reviews(professionalism_rating);
CREATE INDEX IF NOT EXISTS idx_reviews_communication ON public.reviews(communication_rating);
