-- Fix missing columns for photographer dashboard portfolio and announcements
-- The photographer dashboard expects owner_admin_id on portfolio_items and announcements,
-- but the actual DB tables use created_by instead. This migration adds the missing columns.

-- 1. Add missing columns to portfolio_items
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS owner_admin_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS display_order int DEFAULT 0;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Backfill owner_admin_id from created_by where possible
UPDATE public.portfolio_items SET owner_admin_id = created_by WHERE owner_admin_id IS NULL AND created_by IS NOT NULL;
UPDATE public.portfolio_items SET created_by = owner_admin_id WHERE created_by IS NULL AND owner_admin_id IS NOT NULL;

-- 2. Add missing columns to announcements
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS owner_admin_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- Backfill owner_admin_id from created_by where possible
UPDATE public.announcements SET owner_admin_id = created_by WHERE owner_admin_id IS NULL AND created_by IS NOT NULL;
UPDATE public.announcements SET created_by = owner_admin_id WHERE created_by IS NULL AND owner_admin_id IS NOT NULL;

-- 3. Create updated_at trigger for portfolio_items if missing
CREATE OR REPLACE FUNCTION update_portfolio_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_portfolio_items_updated_at ON public.portfolio_items;
CREATE TRIGGER update_portfolio_items_updated_at
  BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION update_portfolio_items_updated_at();

-- 4. Create updated_at trigger for announcements if missing
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_announcements_updated_at ON public.announcements;
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION update_announcements_updated_at();

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
