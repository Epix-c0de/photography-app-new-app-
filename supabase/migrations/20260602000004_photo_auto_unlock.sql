-- ============================================
-- AUTO PHOTO UNLOCK ON PAYMENT SUCCESS
-- Solves: Photos don't unlock when client pays
-- Created: 2026-06-02
-- ============================================

-- 1. Ensure gallery_photos has required columns
ALTER TABLE gallery_photos 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;

-- 2. Ensure galleries has payment tracking columns
ALTER TABLE galleries
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2);

-- Add check constraint separately (if column already exists, this won't fail)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'galleries_payment_status_check'
  ) THEN
    ALTER TABLE galleries 
    ADD CONSTRAINT galleries_payment_status_check 
    CHECK (payment_status IN ('pending', 'paid', 'refunded'));
  END IF;
END $$;

-- 3. Create function to unlock photos when payment succeeds
CREATE OR REPLACE FUNCTION unlock_photos_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_gallery_id UUID;
  v_client_id UUID;
  v_photo_count INTEGER;
BEGIN
  -- Only process if payment status changed to 'success'
  IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
    
    v_gallery_id := NEW.gallery_id;
    v_client_id := NEW.client_id;
    
    -- Unlock all photos in the gallery for this client
    UPDATE gallery_photos
    SET 
      is_locked = FALSE, 
      unlocked_at = NOW()
    WHERE gallery_id = v_gallery_id
      AND is_locked = TRUE;
    
    GET DIAGNOSTICS v_photo_count = ROW_COUNT;
    
    -- Update gallery payment status
    UPDATE galleries
    SET 
      payment_status = 'paid',
      paid_at = NOW(),
      payment_amount = NEW.amount
    WHERE id = v_gallery_id;
    
    -- Log the unlock event
    INSERT INTO admin_audit_log (
      admin_id,
      action,
      description,
      metadata
    )
    SELECT 
      g.owner_admin_id,
      'photos_unlocked',
      'Photos automatically unlocked after payment',
      jsonb_build_object(
        'gallery_id', v_gallery_id,
        'client_id', v_client_id,
        'payment_id', NEW.id,
        'amount', NEW.amount,
        'photos_unlocked', v_photo_count,
        'mpesa_code', NEW.mpesa_code
      )
    FROM galleries g
    WHERE g.id = v_gallery_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger on payments table
DROP TRIGGER IF EXISTS trigger_unlock_photos ON payments;
CREATE TRIGGER trigger_unlock_photos
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'success')
  EXECUTE FUNCTION unlock_photos_on_payment();

-- 5. Create function to check gallery unlock status
CREATE OR REPLACE FUNCTION get_gallery_unlock_status(p_gallery_id UUID, p_client_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_photos INTEGER;
  v_unlocked_photos INTEGER;
  v_payment_status TEXT;
  v_amount_paid DECIMAL;
BEGIN
  -- Get photo counts
  SELECT 
    COUNT(*),
    SUM(CASE WHEN is_locked = FALSE THEN 1 ELSE 0 END)
  INTO v_total_photos, v_unlocked_photos
  FROM gallery_photos
  WHERE gallery_id = p_gallery_id;
  
  -- Get payment info
  SELECT 
    payment_status,
    payment_amount
  INTO v_payment_status, v_amount_paid
  FROM galleries
  WHERE id = p_gallery_id;
  
  RETURN jsonb_build_object(
    'gallery_id', p_gallery_id,
    'total_photos', COALESCE(v_total_photos, 0),
    'unlocked_photos', COALESCE(v_unlocked_photos, 0),
    'locked_photos', COALESCE(v_total_photos - v_unlocked_photos, 0),
    'is_fully_unlocked', (v_unlocked_photos = v_total_photos),
    'payment_status', v_payment_status,
    'amount_paid', v_amount_paid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create function to manually unlock photos (for admin or refunds)
CREATE OR REPLACE FUNCTION manually_unlock_gallery(
  p_gallery_id UUID,
  p_admin_id UUID,
  p_reason TEXT DEFAULT 'manual_unlock'
)
RETURNS JSONB AS $$
DECLARE
  v_photo_count INTEGER;
  v_is_owner BOOLEAN;
BEGIN
  -- Verify admin owns this gallery
  SELECT EXISTS (
    SELECT 1 FROM galleries
    WHERE id = p_gallery_id
    AND owner_admin_id = p_admin_id
  ) INTO v_is_owner;
  
  IF NOT v_is_owner THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: You do not own this gallery'
    );
  END IF;
  
  -- Unlock all photos
  UPDATE gallery_photos
  SET 
    is_locked = FALSE,
    unlocked_at = NOW()
  WHERE gallery_id = p_gallery_id
    AND is_locked = TRUE;
  
  GET DIAGNOSTICS v_photo_count = ROW_COUNT;
  
  -- Update gallery status
  UPDATE galleries
  SET 
    payment_status = 'paid',
    paid_at = NOW()
  WHERE id = p_gallery_id;
  
  -- Log the action
  INSERT INTO admin_audit_log (
    admin_id,
    action,
    description,
    metadata
  ) VALUES (
    p_admin_id,
    'manual_unlock',
    p_reason,
    jsonb_build_object(
      'gallery_id', p_gallery_id,
      'photos_unlocked', v_photo_count
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'photos_unlocked', v_photo_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create function to lock photos (for refunds)
CREATE OR REPLACE FUNCTION lock_gallery_on_refund(p_payment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_gallery_id UUID;
BEGIN
  -- Get gallery_id from payment
  SELECT gallery_id INTO v_gallery_id
  FROM payments
  WHERE id = p_payment_id;
  
  IF v_gallery_id IS NOT NULL THEN
    -- Lock all photos again
    UPDATE gallery_photos
    SET 
      is_locked = TRUE,
      unlocked_at = NULL
    WHERE gallery_id = v_gallery_id;
    
    -- Update gallery status
    UPDATE galleries
    SET 
      payment_status = 'refunded',
      paid_at = NULL
    WHERE id = v_gallery_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for refunds
CREATE OR REPLACE FUNCTION handle_payment_refund()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'refunded' AND OLD.status = 'success' THEN
    PERFORM lock_gallery_on_refund(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_refund ON payments;
CREATE TRIGGER trigger_payment_refund
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'refunded')
  EXECUTE FUNCTION handle_payment_refund();

-- 9. Grant permissions
GRANT EXECUTE ON FUNCTION get_gallery_unlock_status(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION manually_unlock_gallery(UUID, UUID, TEXT) TO authenticated;

-- 10. Update existing galleries to set initial lock state
UPDATE gallery_photos
SET is_locked = TRUE
WHERE is_locked IS NULL;

UPDATE galleries
SET payment_status = 'pending'
WHERE payment_status IS NULL;
