-- ============================================
-- FIX PAYMENT STATUS ENUM
-- Solves: Photo auto-unlock migration fails due to invalid payment status values
-- Requirements: 5.2, 5.3, 5.6, 5.7
-- Created: 2026-06-02
-- ============================================

-- 1. Drop the existing check constraint on payments.status
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_status_check;

-- 2. Add the new check constraint with 'refunded' included
-- Valid values: 'pending', 'paid', 'failed', 'cancelled', 'refunded'
ALTER TABLE payments
ADD CONSTRAINT payments_status_check
CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded'));

-- 3. Update the handle_payment_refund function to handle both 'refunded' and 'cancelled'
CREATE OR REPLACE FUNCTION handle_payment_refund()
RETURNS TRIGGER AS $$
BEGIN
  -- Lock gallery on both 'refunded' and 'cancelled' status changes from 'paid'
  IF (NEW.status = 'refunded' OR NEW.status = 'cancelled') 
     AND OLD.status = 'paid' THEN
    PERFORM lock_gallery_on_refund(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Drop and recreate the trigger to handle both 'refunded' AND 'cancelled'
DROP TRIGGER IF EXISTS trigger_payment_refund ON payments;
CREATE TRIGGER trigger_payment_refund
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.status IN ('refunded', 'cancelled'))
  EXECUTE FUNCTION handle_payment_refund();

-- 5. Add comment documenting the status mapping
COMMENT ON COLUMN payments.status IS 
'Payment status values: pending, paid, failed, cancelled, refunded. 
Note: galleries.payment_status uses different values (pending, paid, refunded). 
When payments.status changes to ''refunded'' or ''cancelled'', the gallery is locked.';

COMMENT ON COLUMN galleries.payment_status IS
'Gallery payment status values: pending, paid, refunded.
Maps from payments.status where both ''refunded'' and ''cancelled'' trigger gallery locking.';
