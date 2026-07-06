-- =====================================================
-- FIX 6: payments trigger — replace enum with CHECK constraint
-- =====================================================

-- Step 1: Drop everything that depends on the enum
DROP TRIGGER IF EXISTS trigger_unlock_photos ON payments;
DROP FUNCTION IF EXISTS unlock_photos_on_payment();

-- Drop the function that depends on the enum type
DROP FUNCTION IF EXISTS handle_mpesa_callback(text, text, integer, text, timestamptz, text, jsonb);

-- Step 2: Convert column to TEXT, then drop enum with CASCADE
ALTER TABLE payments ALTER COLUMN status TYPE TEXT;

DROP TYPE IF EXISTS payment_status CASCADE;

-- Step 3: Add CHECK constraint
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'success', 'paid', 'failed', 'cancelled', 'expired'));

-- Step 4: Recreate the unlock function
CREATE OR REPLACE FUNCTION unlock_photos_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_gallery_id UUID;
  v_client_id UUID;
  v_photo_count INTEGER;
BEGIN
  IF NEW.status IN ('success', 'paid') AND (OLD IS NULL OR OLD.status NOT IN ('success', 'paid')) THEN

    v_gallery_id := NEW.gallery_id;
    v_client_id := NEW.client_id;

    UPDATE gallery_photos
    SET is_locked = FALSE, unlocked_at = NOW()
    WHERE gallery_id = v_gallery_id AND is_locked = TRUE;

    GET DIAGNOSTICS v_photo_count = ROW_COUNT;

    UPDATE galleries
    SET is_paid = TRUE, is_locked = FALSE, payment_status = 'paid', paid_at = NOW(), payment_amount = NEW.amount
    WHERE id = v_gallery_id;

    INSERT INTO admin_audit_log (admin_id, action, description, metadata)
    SELECT g.owner_admin_id, 'photos_unlocked', 'Photos automatically unlocked after payment',
      jsonb_build_object(
        'gallery_id', v_gallery_id, 'client_id', v_client_id, 'payment_id', NEW.id,
        'amount', NEW.amount, 'photos_unlocked', v_photo_count,
        'mpesa_code', COALESCE(NEW.mpesa_receipt_number, NEW.mpesa_code)
      )
    FROM galleries g WHERE g.id = v_gallery_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Recreate the trigger
CREATE TRIGGER trigger_unlock_photos
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.status IN ('success', 'paid'))
  EXECUTE FUNCTION unlock_photos_on_payment();

-- Step 6: Recreate handle_mpesa_callback without enum dependency
CREATE OR REPLACE FUNCTION handle_mpesa_callback(
  p_mpesa_receipt TEXT,
  p_phone_number TEXT,
  p_amount INTEGER,
  p_result_code TEXT,
  p_result_timestamp TIMESTAMPTZ,
  p_account_reference TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_gallery RECORD;
  v_client RECORD;
BEGIN
  -- Find the payment by account reference or receipt
  SELECT * INTO v_payment
  FROM payments
  WHERE mpesa_receipt_number = p_mpesa_receipt
     OR mpesa_code = p_mpesa_receipt
     OR id::text = p_account_reference
  LIMIT 1;

  IF NOT FOUND THEN
    -- Try to find by gallery access code in account reference
    SELECT p.* INTO v_payment
    FROM payments p
    JOIN galleries g ON p.gallery_id = g.id
    WHERE g.access_code = p_account_reference
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  -- Update payment status to 'paid'
  UPDATE payments
  SET status = 'paid',
      mpesa_receipt_number = COALESCE(p_mpesa_receipt, mpesa_receipt_number),
      paid_at = p_result_timestamp,
      callback_data = p_metadata,
      updated_at = now()
  WHERE id = v_payment.id;

  -- Get gallery and client info
  SELECT * INTO v_gallery FROM galleries WHERE id = v_payment.gallery_id;
  SELECT * INTO v_client FROM clients WHERE id = v_payment.client_id;

  -- Unlock gallery
  IF v_gallery IS NOT NULL THEN
    UPDATE galleries
    SET is_paid = TRUE, is_locked = FALSE, payment_status = 'paid', paid_at = now()
    WHERE id = v_gallery.id;

    UPDATE gallery_photos
    SET is_locked = FALSE, unlocked_at = now()
    WHERE gallery_id = v_gallery.id AND is_locked = TRUE;
  END IF;

  -- Send SMS notification if client has phone
  IF v_client IS NOT NULL AND v_client.phone IS NOT NULL THEN
    BEGIN
      PERFORM supabase.functions.invoke('send-sms', jsonb_build_object(
        'body', jsonb_build_object(
          'phoneNumber', v_client.phone,
          'message', 'Payment of KES ' || p_amount || ' received! Your gallery is now unlocked. Check your app.'
        )
      ));
    EXCEPTION WHEN OTHERS THEN
      -- Don't fail the callback if SMS fails
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment.id);
END;
$$;

GRANT EXECUTE ON FUNCTION handle_mpesa_callback(text, text, integer, text, timestamptz, text, jsonb) TO service_role;
