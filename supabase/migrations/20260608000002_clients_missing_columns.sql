-- ============================================
-- Add missing columns to clients table
-- loyalty_level and total_paid were referenced
-- in the photographer dashboard clients page but
-- never added via a migration.
-- ============================================

-- Add loyalty_level column (Bronze/Silver/Gold/Platinum)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS loyalty_level TEXT NOT NULL DEFAULT 'Bronze'
    CHECK (loyalty_level IN ('Bronze', 'Silver', 'Gold', 'Platinum'));

-- total_paid was in the original schema but may be missing in some envs
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS total_paid NUMERIC NOT NULL DEFAULT 0;

-- avatar_url for display (optional, used in admin app)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Back-fill total_paid from gallery payments where it's 0 but galleries exist
-- (safe no-op if all values are already set)
UPDATE public.clients c
SET total_paid = COALESCE((
  SELECT SUM(g.price)
  FROM public.galleries g
  WHERE g.client_id = c.id AND g.is_paid = true
), 0)
WHERE c.total_paid = 0;
