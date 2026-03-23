-- Migration: Simple Payment Parity & Chat Onboarding Fix
-- Date: 2026-03-13

-- 1. Update clients table for easier onboarding
ALTER TABLE public.clients ALTER COLUMN owner_admin_id DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN name DROP NOT NULL;

-- 2. Add RLS policy for clients to insert themselves (crucial for Chat setup)
DROP POLICY IF EXISTS "Clients can insert themselves" ON public.clients;
CREATE POLICY "Clients can insert themselves"
ON public.clients FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. Create/Update simple_payment_settings table
CREATE TABLE IF NOT EXISTS public.simple_payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT,
    mpesa_number TEXT,
    payment_mode TEXT DEFAULT 'STK_PUSH',
    currency TEXT DEFAULT 'KES',
    gallery_price_default NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(admin_id)
);

-- RLS for simple_payment_settings
ALTER TABLE public.simple_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage their own simple settings" ON public.simple_payment_settings;
CREATE POLICY "Admins can manage their own simple settings"
ON public.simple_payment_settings FOR ALL
USING (auth.uid() = admin_id)
WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Public view for payment info" ON public.simple_payment_settings;
CREATE POLICY "Public view for payment info"
ON public.simple_payment_settings FOR SELECT
USING (true);

-- 4. Update portfolio_items if needed (already mostly done in 20240428 but being thorough)
ALTER TABLE public.portfolio_items 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;

-- 5. Create portfolio_likes table if not exists
CREATE TABLE IF NOT EXISTS public.portfolio_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    portfolio_item_id UUID NOT NULL REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, portfolio_item_id)
);

ALTER TABLE public.portfolio_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view likes" ON public.portfolio_likes;
CREATE POLICY "Anyone can view likes"
ON public.portfolio_likes FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can toggle their own likes" ON public.portfolio_likes;
CREATE POLICY "Users can toggle their own likes"
ON public.portfolio_likes FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
