-- ============================================================================
-- UNIFIED TRANSACTIONS TABLE
-- Single source of truth for all M-Pesa payment transactions
-- ============================================================================

-- Create enum type for transaction status
DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending', 'success', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum type for transaction type
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('stk_push', 'c2b');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TRANSACTIONS TABLE
-- Stores all M-Pesa transactions (STK Push and C2B)
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  gateway_id UUID REFERENCES payment_gateways(id) ON DELETE SET NULL,
  checkout_request_id TEXT UNIQUE, -- Daraja CheckoutRequestID (STK Push)
  merchant_request_id TEXT, -- Daraja MerchantRequestID (STK Push)
  trans_id TEXT, -- Safaricom TransID (C2B)
  phone_number TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status transaction_status NOT NULL DEFAULT 'pending',
  mpesa_receipt_number TEXT,
  result_code INTEGER,
  result_desc TEXT,
  transaction_type transaction_type NOT NULL DEFAULT 'stk_push',
  account_reference TEXT, -- For Paybill C2B
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Lookup by CheckoutRequestID (most common query from callbacks)
CREATE INDEX IF NOT EXISTS idx_transactions_checkout_request
  ON transactions (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

-- Lookup by TransID (for C2B callbacks)
CREATE INDEX IF NOT EXISTS idx_transactions_trans_id
  ON transactions (trans_id)
  WHERE trans_id IS NOT NULL;

-- Client transaction history
CREATE INDEX IF NOT EXISTS idx_transactions_client_history
  ON transactions (client_id, created_at DESC);

-- Pending transactions (for polling)
CREATE INDEX IF NOT EXISTS idx_transactions_pending
  ON transactions (created_at DESC)
  WHERE status = 'pending';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Admin role: full read/write access to ALL transactions
DROP POLICY IF EXISTS "Admin full access to transactions" ON transactions;
CREATE POLICY "Admin full access to transactions"
  ON transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- Client role: can only read their own transactions
DROP POLICY IF EXISTS "Client read own transactions" ON transactions;
CREATE POLICY "Client read own transactions"
  ON transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = transactions.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_transaction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_transaction_updated ON transactions;
CREATE TRIGGER on_transaction_updated
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_timestamp();

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT ON transactions TO authenticated;
GRANT INSERT, UPDATE ON transactions TO authenticated;
