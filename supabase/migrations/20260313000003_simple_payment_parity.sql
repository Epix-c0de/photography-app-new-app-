-- Simple Payment Parity & Chat Onboarding Fix

-- Allow clients.owner_admin_id and name to be nullable for self-onboarding
ALTER TABLE public.clients ALTER COLUMN owner_admin_id DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN name DROP NOT NULL;

-- RLS: clients can insert themselves
DROP POLICY IF EXISTS "Clients can insert themselves" ON public.clients;
CREATE POLICY "Clients can insert themselves"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- simple_payment_settings: add extra columns if missing
ALTER TABLE public.simple_payment_settings
  ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'STK_PUSH',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS gallery_price_default NUMERIC DEFAULT 0;

-- Drop old policy name variants and recreate cleanly
DROP POLICY IF EXISTS "Public/Clients can view simple settings for payments" ON public.simple_payment_settings;
DROP POLICY IF EXISTS "Public view for payment info" ON public.simple_payment_settings;
CREATE POLICY "Public view for payment info"
  ON public.simple_payment_settings FOR SELECT
  USING (true);

-- portfolio_items engagement columns (already added in feed_schema_additions, guard here)
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS likes_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;

-- portfolio_likes table
CREATE TABLE IF NOT EXISTS public.portfolio_likes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_item_id UUID NOT NULL REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, portfolio_item_id)
);

ALTER TABLE public.portfolio_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view likes" ON public.portfolio_likes;
CREATE POLICY "Anyone can view likes"
  ON public.portfolio_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can toggle their own likes" ON public.portfolio_likes;
CREATE POLICY "Users can toggle their own likes"
  ON public.portfolio_likes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
