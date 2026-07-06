-- Fix: Status mismatch between payment callback and auto-unlock trigger
-- The callback sets status='paid' but trigger fires on status='success'
-- This migration fixes the trigger to fire on BOTH 'success' AND 'paid'

-- 1. Update the trigger condition to fire on 'paid' as well as 'success'
DROP TRIGGER IF EXISTS trigger_unlock_photos ON payments;

CREATE TRIGGER trigger_unlock_photos
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.status IN ('success', 'paid'))
  EXECUTE FUNCTION unlock_photos_on_payment();

-- 2. Update the function to handle both status values
CREATE OR REPLACE FUNCTION unlock_photos_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_gallery_id UUID;
  v_client_id UUID;
  v_photo_count INTEGER;
BEGIN
  -- Process if payment status changed to 'success' OR 'paid'
  IF NEW.status IN ('success', 'paid') AND (OLD.status IS NULL OR OLD.status NOT IN ('success', 'paid')) THEN
    
    v_gallery_id := NEW.gallery_id;
    v_client_id := NEW.client_id;
    
    -- Unlock all photos in the gallery
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
      is_paid = TRUE,
      is_locked = FALSE,
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
        'mpesa_code', COALESCE(NEW.mpesa_receipt_number, NEW.mpesa_code)
      )
    FROM galleries g
    WHERE g.id = v_gallery_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
