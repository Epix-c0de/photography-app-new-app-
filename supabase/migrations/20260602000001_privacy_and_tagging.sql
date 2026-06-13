-- ============================================
-- MIGRATION: Privacy & Photographer Tagging
-- Created: 2026-06-02
-- ============================================

-- Feature 1: Add photographer_name to galleries for tagging in client app
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS photographer_name TEXT;
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS photographer_id UUID REFERENCES user_profiles(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_galleries_photographer_id ON galleries(photographer_id);

-- Feature 2: Update photographer_name from user_profiles when gallery is created
-- This trigger automatically populates photographer_name from the admin's profile
CREATE OR REPLACE FUNCTION set_photographer_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Get photographer name from user_profiles
  SELECT name INTO NEW.photographer_name
  FROM user_profiles
  WHERE id = NEW.owner_admin_id;
  
  -- Set photographer_id
  NEW.photographer_id := NEW.owner_admin_id;
  
  -- Fallback to email if name is null
  IF NEW.photographer_name IS NULL THEN
    SELECT email INTO NEW.photographer_name
    FROM auth.users
    WHERE id = NEW.owner_admin_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_photographer_name ON galleries;
CREATE TRIGGER trigger_set_photographer_name
  BEFORE INSERT OR UPDATE ON galleries
  FOR EACH ROW
  EXECUTE FUNCTION set_photographer_name();

-- Feature 3: Backfill existing galleries with photographer names
UPDATE galleries
SET 
  photographer_name = COALESCE(up.name, au.email),
  photographer_id = galleries.owner_admin_id
FROM user_profiles up
LEFT JOIN auth.users au ON au.id = up.id
WHERE galleries.owner_admin_id = up.id
  AND galleries.photographer_name IS NULL;

-- Feature 4: Manual payment verification table
CREATE TABLE IF NOT EXISTS manual_payment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  mpesa_code TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES user_profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manual_payments_gallery ON manual_payment_verifications(gallery_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_client ON manual_payment_verifications(client_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_admin ON manual_payment_verifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_status ON manual_payment_verifications(status);

-- RLS
ALTER TABLE manual_payment_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_manual_payments" ON manual_payment_verifications;
DROP POLICY IF EXISTS "client_view_own_payments" ON manual_payment_verifications;
DROP POLICY IF EXISTS "client_create_payments" ON manual_payment_verifications;

-- Admins can manage their own manual payments
CREATE POLICY "admin_manage_manual_payments" ON manual_payment_verifications
  FOR ALL USING (admin_id = auth.uid());

-- Clients can view and create their own payment submissions
CREATE POLICY "client_view_own_payments" ON manual_payment_verifications
  FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "client_create_payments" ON manual_payment_verifications
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_manual_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS manual_payment_updated_at ON manual_payment_verifications;
CREATE TRIGGER manual_payment_updated_at
  BEFORE UPDATE ON manual_payment_verifications
  FOR EACH ROW EXECUTE FUNCTION update_manual_payment_updated_at();

-- Feature 5: Function to verify manual payment and unlock gallery
CREATE OR REPLACE FUNCTION verify_manual_payment(
  p_payment_id UUID,
  p_admin_id UUID,
  p_verify BOOLEAN DEFAULT TRUE,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_payment manual_payment_verifications;
  v_gallery_id UUID;
BEGIN
  -- Get payment record
  SELECT * INTO v_payment
  FROM manual_payment_verifications
  WHERE id = p_payment_id AND admin_id = p_admin_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found or access denied');
  END IF;
  
  IF v_payment.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment already processed');
  END IF;
  
  -- Update payment status
  IF p_verify THEN
    UPDATE manual_payment_verifications
    SET 
      status = 'verified',
      verified_at = NOW(),
      verified_by = p_admin_id
    WHERE id = p_payment_id;
    
    -- Unlock gallery
    UPDATE galleries
    SET 
      is_paid = TRUE,
      is_locked = FALSE,
      updated_at = NOW()
    WHERE id = v_payment.gallery_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Payment verified and gallery unlocked');
  ELSE
    UPDATE manual_payment_verifications
    SET 
      status = 'rejected',
      verified_by = p_admin_id,
      rejection_reason = p_rejection_reason
    WHERE id = p_payment_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Payment rejected');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
