-- Reviews table upgrade: add is_featured, response, response_at columns
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS response_at TIMESTAMPTZ;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_reviews_is_featured ON public.reviews(is_featured);
CREATE INDEX IF NOT EXISTS idx_reviews_response_at ON public.reviews(response_at);
