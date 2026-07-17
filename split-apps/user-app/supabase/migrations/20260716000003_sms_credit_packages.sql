-- SMS Credit Packages table (set by super admin)
CREATE TABLE IF NOT EXISTS public.sms_credit_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    sms_count INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sms_credit_packages ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all packages
DROP POLICY IF EXISTS "Super admin manages credit packages" ON public.sms_credit_packages;
CREATE POLICY "Super admin manages credit packages"
    ON public.sms_credit_packages FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Everyone can view active packages
DROP POLICY IF EXISTS "Anyone can view active credit packages" ON public.sms_credit_packages;
CREATE POLICY "Anyone can view active credit packages"
    ON public.sms_credit_packages FOR SELECT
    USING (is_active = true);

-- SMS Purchase Transactions
CREATE TABLE IF NOT EXISTS public.sms_purchase_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES public.user_profiles(id),
    package_id UUID REFERENCES public.sms_credit_packages(id),
    sms_count INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    mpesa_receipt TEXT,
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE public.sms_purchase_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view own purchases" ON public.sms_purchase_transactions;
CREATE POLICY "Admins view own purchases"
    ON public.sms_purchase_transactions FOR SELECT
    USING (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins insert own purchases" ON public.sms_purchase_transactions;
CREATE POLICY "Admins insert own purchases"
    ON public.sms_purchase_transactions FOR INSERT
    WITH CHECK (auth.uid() = admin_id);

-- SMS Credits balance table
CREATE TABLE IF NOT EXISTS public.sms_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES public.user_profiles(id) UNIQUE,
    balance INTEGER DEFAULT 0,
    total_purchased INTEGER DEFAULT 0,
    total_used INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sms_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view own credits" ON public.sms_credits;
CREATE POLICY "Admins view own credits"
    ON public.sms_credits FOR SELECT
    USING (auth.uid() = admin_id);

-- Function to complete SMS purchase
CREATE OR REPLACE FUNCTION complete_sms_purchase(
    p_admin_id UUID,
    p_package_id UUID,
    p_sms_count INTEGER,
    p_amount NUMERIC,
    p_receipt TEXT,
    p_phone TEXT
)
RETURNS void AS $$
BEGIN
    -- Insert purchase record
    INSERT INTO public.sms_purchase_transactions (admin_id, package_id, sms_count, amount, status, mpesa_receipt, phone_number, completed_at)
    VALUES (p_admin_id, p_package_id, p_sms_count, p_amount, 'completed', p_receipt, p_phone, now());
    
    -- Upsert credits balance
    INSERT INTO public.sms_credits (admin_id, balance, total_purchased, updated_at)
    VALUES (p_admin_id, p_sms_count, p_sms_count, now())
    ON CONFLICT (admin_id) DO UPDATE SET
        balance = sms_credits.balance + p_sms_count,
        total_purchased = sms_credits.total_purchased + p_sms_count,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Default credit packages
INSERT INTO public.sms_credit_packages (name, sms_count, price) VALUES
    ('Starter', 100, 200),
    ('Growth', 250, 450),
    ('Professional', 500, 800),
    ('Enterprise', 1000, 1500)
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sms_purchases_admin ON public.sms_purchase_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sms_credits_admin ON public.sms_credits(admin_id);
