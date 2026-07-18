-- Add multi-image support and package linking to portfolio_items
-- images: jsonb array of {url: string, caption?: string|null}
-- package_id: FK to packages table for "Book This Package" flow

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS package_id uuid DEFAULT NULL;

-- Add FK constraint (nullable — only set when admin links a package)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_items_package_id_fkey'
  ) THEN
    ALTER TABLE public.portfolio_items
      ADD CONSTRAINT portfolio_items_package_id_fkey
      FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_portfolio_items_package_id ON public.portfolio_items(package_id);
