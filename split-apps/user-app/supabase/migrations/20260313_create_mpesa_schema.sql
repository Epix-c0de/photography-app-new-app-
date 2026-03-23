-- Migration: Create M-PESA Daraja tables based on Master Prompt
-- 1. payment_settings table
CREATE TABLE IF NOT EXISTS public.payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.user_profiles(id) NOT NULL UNIQUE,
    environment TEXT DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    consumer_key TEXT,
    consumer_secret TEXT,
    shortcode TEXT,
    passkey TEXT,
    callback_url TEXT,
    confirmation_url TEXT,
    validation_url TEXT,
    initiator_name TEXT,
    initiator_password TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. mpesa_transactions table
CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gallery_id UUID REFERENCES public.galleries(id),
    client_id UUID REFERENCES public.user_profiles(id), -- Referencing user_profiles as clients are also users
    phone_number TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    mpesa_receipt TEXT UNIQUE,
    merchant_request_id TEXT UNIQUE,
    checkout_request_id TEXT UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. mpesa_logs table
CREATE TABLE IF NOT EXISTS public.mpesa_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_logs ENABLE ROW LEVEL SECURITY;

-- 5. Policies for payment_settings
DROP POLICY IF EXISTS "Admins manage their own payment settings" ON public.payment_settings;
CREATE POLICY "Admins manage their own payment settings" ON public.payment_settings
    FOR ALL USING (auth.uid() = admin_id);

-- 6. Policies for mpesa_transactions
DROP POLICY IF EXISTS "Admins view all transactions" ON public.mpesa_transactions;
CREATE POLICY "Admins view all transactions" ON public.mpesa_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Clients view their own transactions" ON public.mpesa_transactions;
CREATE POLICY "Clients view their own transactions" ON public.mpesa_transactions
    FOR SELECT USING (auth.uid() = client_id);

-- 7. Policies for mpesa_logs (Admin only)
DROP POLICY IF EXISTS "Admins view logs" ON public.mpesa_logs;
CREATE POLICY "Admins view logs" ON public.mpesa_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

-- 8. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_settings_updated_at BEFORE UPDATE ON public.payment_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_mpesa_transactions_updated_at BEFORE UPDATE ON public.mpesa_transactions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
