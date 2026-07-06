-- Phase 2.1: M-Pesa Till Number Integration
-- Photographer Till Numbers
CREATE TABLE IF NOT EXISTS photographer_till_numbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  till_number TEXT NOT NULL,
  business_name TEXT NOT NULL,
  phone_number TEXT,
  is_primary BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  mpesa_short_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_photographer_till_numbers_photographer ON photographer_till_numbers(photographer_id);

-- RLS policies
ALTER TABLE photographer_till_numbers ENABLE ROW LEVEL SECURITY;

-- Photographers can manage their own till numbers
CREATE POLICY "Photographers manage own tills" ON photographer_till_numbers
  FOR ALL
  USING (photographer_id = auth.uid());

-- Super admins can view all
CREATE POLICY "Super admins view all tills" ON photographer_till_numbers
  FOR SELECT
  TO service_role
  USING (true);


-- Payment Receipts
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  gallery_id UUID REFERENCES galleries(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  transaction_id TEXT,
  phone_number TEXT,
  receipt_number TEXT UNIQUE,
  payment_method TEXT DEFAULT 'mpesa',
  till_number TEXT,
  status TEXT DEFAULT 'pending', -- pending, completed, failed, refunded
  receipt_html TEXT,
  receipt_pdf_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_receipts_photographer ON payment_receipts(photographer_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_gallery ON payment_receipts(gallery_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_client ON payment_receipts(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status ON payment_receipts(status);

-- RLS policies
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- Photographers can view receipts for their galleries
CREATE POLICY "Photographers view own receipts" ON payment_receipts
  FOR SELECT
  USING (photographer_id = auth.uid());

-- Service role can manage all receipts
CREATE POLICY "Service role manages receipts" ON payment_receipts
  FOR ALL
  TO service_role
  USING (true);


-- M-Pesa Transactions log
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID REFERENCES payment_receipts(id),
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  phone_number TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  till_number TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  result_code INTEGER,
  result_description TEXT,
  callback_received BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_status ON mpesa_transactions(status);

-- RLS policies
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Only service role can access (via Edge Functions)
CREATE POLICY "Service role only" ON mpesa_transactions
  FOR ALL
  TO service_role
  USING (true);


-- Installment Plans
CREATE TABLE IF NOT EXISTS installment_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  total_amount DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_amount DECIMAL(10,2) NOT NULL,
  number_of_installments INT NOT NULL DEFAULT 2,
  installment_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'active', -- active, completed, defaulted, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_installment_plans_gallery ON installment_plans(gallery_id);
CREATE INDEX IF NOT EXISTS idx_installment_plans_photographer ON installment_plans(photographer_id);
CREATE INDEX IF NOT EXISTS idx_installment_plans_client ON installment_plans(client_id);

-- RLS policies
ALTER TABLE installment_plans ENABLE ROW LEVEL SECURITY;

-- Photographers can manage their own plans
CREATE POLICY "Photographers manage own plans" ON installment_plans
  FOR ALL
  USING (photographer_id = auth.uid());


-- Installment Payments (individual payments)
CREATE TABLE IF NOT EXISTS installment_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  transaction_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, paid, overdue, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_installment_payments_plan ON installment_payments(plan_id);
CREATE INDEX IF NOT EXISTS idx_installment_payments_status ON installment_payments(status);

-- RLS policies
ALTER TABLE installment_payments ENABLE ROW LEVEL SECURITY;

-- Photographers can view payments for their plans
CREATE POLICY "Photographers view own plan payments" ON installment_payments
  FOR SELECT
  USING (
    plan_id IN (
      SELECT id FROM installment_plans WHERE photographer_id = auth.uid()
    )
  );

-- Service role can manage all
CREATE POLICY "Service role manages payments" ON installment_payments
  FOR ALL
  TO service_role
  USING (true);
