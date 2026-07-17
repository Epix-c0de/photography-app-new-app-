-- SMS Credit Packages (set by super admin)
CREATE TABLE IF NOT EXISTS public.sms_credit_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sms_count int not null,
  price numeric not null,
  currency text not null default 'KES',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add description for the package
ALTER TABLE public.sms_credit_packages ADD COLUMN IF NOT EXISTS description text;

-- Add bonus_sms for promotional packages
ALTER TABLE public.sms_credit_packages ADD COLUMN IF NOT EXISTS bonus_sms int not null default 0;

ALTER TABLE public.sms_credit_packages ENABLE ROW LEVEL SECURITY;

-- Everyone can read active packages
CREATE POLICY "Anyone can view active sms packages"
  ON public.sms_credit_packages FOR SELECT
  USING (is_active = true);

-- Super admin can manage packages
CREATE POLICY "Super admin manages sms packages"
  ON public.sms_credit_packages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Insert default packages
INSERT INTO public.sms_credit_packages (name, sms_count, price, description, sort_order) VALUES
  ('Starter', 100, 200, '100 SMS credits', 1),
  ('Growth', 250, 450, '250 SMS credits + 10 bonus', 2),
  ('Professional', 500, 800, '500 SMS credits + 50 bonus', 3),
  ('Enterprise', 1000, 1500, '1000 SMS credits + 100 bonus', 4)
ON CONFLICT DO NOTHING;

-- Update bonus_sms for packages with bonuses
UPDATE public.sms_credit_packages SET bonus_sms = 10 WHERE name = 'Growth';
UPDATE public.sms_credit_packages SET bonus_sms = 50 WHERE name = 'Professional';
UPDATE public.sms_credit_packages SET bonus_sms = 100 WHERE name = 'Enterprise';

-- SMS Purchase Transactions (for M-Pesa payments)
CREATE TABLE IF NOT EXISTS public.sms_purchase_transactions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.user_profiles(id),
  package_id uuid not null references public.sms_credit_packages(id),
  sms_amount int not null,
  bonus_sms int not null default 0,
  total_sms int not null,
  amount numeric not null,
  currency text not null default 'KES',
  payment_method text not null default 'mpesa',
  payment_reference text,
  checkout_request_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.sms_purchase_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can view their own transactions
CREATE POLICY "Admins view own sms transactions"
  ON public.sms_purchase_transactions FOR SELECT
  USING (auth.uid() = admin_id);

-- Super admin can view all transactions
CREATE POLICY "Super admin views all sms transactions"
  ON public.sms_purchase_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sms_packages_active ON public.sms_credit_packages(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_sms_transactions_admin ON public.sms_purchase_transactions(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_transactions_status ON public.sms_purchase_transactions(status);

-- Function to complete SMS purchase (called after M-Pesa confirmation)
CREATE OR REPLACE FUNCTION public.complete_sms_purchase(
  p_transaction_id uuid,
  p_payment_reference text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid;
  v_total_sms int;
  v_new_balance int;
  v_transaction sms_purchase_transactions%ROWTYPE;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction
  FROM public.sms_purchase_transactions
  WHERE id = p_transaction_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or already processed';
  END IF;

  v_admin_id := v_transaction.admin_id;
  v_total_sms := v_transaction.total_sms;

  -- Update transaction status
  UPDATE public.sms_purchase_transactions
  SET status = 'completed',
      payment_reference = p_payment_reference,
      updated_at = now()
  WHERE id = p_transaction_id;

  -- Add credits to admin balance
  v_new_balance := public.increment_sms_balance(v_admin_id, v_total_sms);

  RETURN v_new_balance;
END;
$$;

-- Function to check admin SMS balance
CREATE OR REPLACE FUNCTION public.get_sms_balance(p_admin_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance int;
BEGIN
  SELECT COALESCE(sms_balance, 0) INTO v_balance
  FROM public.admin_resources
  WHERE admin_id = p_admin_id;

  RETURN COALESCE(v_balance, 0);
END;
$$;
