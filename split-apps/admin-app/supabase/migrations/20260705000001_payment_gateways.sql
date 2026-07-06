-- ============================================================================
-- M-PESA PAYMENT GATEWAYS TABLE
-- Multi-tenant gateway configuration with encrypted credentials
-- ============================================================================

-- Create enum type for gateway type
DO $$ BEGIN
  CREATE TYPE gateway_type AS ENUM ('till', 'paybill');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum type for environment
DO $$ BEGIN
  CREATE TYPE gateway_environment AS ENUM ('sandbox', 'production');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PAYMENT GATEWAYS TABLE
-- Stores Daraja API credentials per client (multi-tenant)
-- Secrets are encrypted at app layer before storage
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  gateway_type gateway_type NOT NULL,
  shortcode TEXT NOT NULL, -- Paybill business number or Till number
  account_reference TEXT, -- Only relevant for Paybill, null for Till
  consumer_key TEXT NOT NULL, -- Encrypted at app layer (AES-256-GCM)
  consumer_secret TEXT NOT NULL, -- Encrypted at app layer (AES-256-GCM)
  passkey TEXT NOT NULL, -- Encrypted at app layer (AES-256-GCM) - Lipa Na M-Pesa online passkey
  environment gateway_environment NOT NULL DEFAULT 'sandbox',
  callback_url TEXT NOT NULL, -- Auto-generated, not user-editable
  confirmation_url TEXT NOT NULL, -- Auto-generated - for C2B
  validation_url TEXT NOT NULL, -- Auto-generated - for C2B
  is_active BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ, -- Set only after successful test connection
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Only one active gateway per client (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_gateway_per_client
  ON payment_gateways (client_id)
  WHERE is_active = true;

-- Fast lookup by client
CREATE INDEX IF NOT EXISTS idx_payment_gateways_client
  ON payment_gateways (client_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

-- Admin role: full read/write access to ALL client gateways
DROP POLICY IF EXISTS "Admin full access to gateways" ON payment_gateways;
CREATE POLICY "Admin full access to gateways"
  ON payment_gateways
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- Client role: can only read their own gateways (masked fields handled at app layer)
DROP POLICY IF EXISTS "Client read own gateways" ON payment_gateways;
CREATE POLICY "Client read own gateways"
  ON payment_gateways
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = payment_gateways.client_id
      AND clients.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_payment_gateway_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_gateway_updated ON payment_gateways;
CREATE TRIGGER on_payment_gateway_updated
  BEFORE UPDATE ON payment_gateways
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_gateway_timestamp();

-- ============================================================================
-- TRIGGER: Auto-deactivate other gateways when one is activated
-- ============================================================================
CREATE OR REPLACE FUNCTION deactivate_other_gateways()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE payment_gateways
    SET is_active = false
    WHERE client_id = NEW.client_id
    AND id != NEW.id
    AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_gateway_activated ON payment_gateways;
CREATE TRIGGER on_gateway_activated
  AFTER INSERT OR UPDATE OF is_active ON payment_gateways
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION deactivate_other_gateways();

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT ON payment_gateways TO authenticated;
GRANT INSERT, UPDATE, DELETE ON payment_gateways TO authenticated;
