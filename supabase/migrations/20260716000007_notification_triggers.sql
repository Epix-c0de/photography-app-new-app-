-- Notification Engine Triggers
-- Automatically create notifications when key events happen

-- 1. Gallery Published: Notify client when gallery is created
CREATE OR REPLACE FUNCTION notify_gallery_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, client_id, title, body, type, data)
    SELECT 
      c.user_id,
      NEW.client_id,
      'Gallery Ready! 📸',
      'Your ' || COALESCE(NEW.shoot_type, 'photo') || ' gallery "' || COALESCE(NEW.name, 'Gallery') || '" is ready to view.',
      'gallery',
      jsonb_build_object('galleryId', NEW.id, 'accessCode', NEW.access_code)
    FROM clients c WHERE c.id = NEW.client_id AND c.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on gallery insert
DROP TRIGGER IF EXISTS trg_gallery_published ON galleries;
CREATE TRIGGER trg_gallery_published
  AFTER INSERT ON galleries
  FOR EACH ROW
  EXECUTE FUNCTION notify_gallery_published();

-- 2. Gallery Unlocked (Payment Received): Notify admin
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_paid = true AND (OLD.is_paid IS NULL OR OLD.is_paid = false) THEN
    INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (
      NEW.owner_admin_id,
      'Payment Received! 💰',
      'Client has paid KES ' || COALESCE(NEW.price::text, '0') || ' for gallery "' || COALESCE(NEW.name, 'Gallery') || '".',
      'payment',
      jsonb_build_object('galleryId', NEW.id, 'amount', NEW.price)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on gallery update
DROP TRIGGER IF EXISTS trg_payment_received ON galleries;
CREATE TRIGGER trg_payment_received
  AFTER UPDATE ON galleries
  FOR EACH ROW
  WHEN (NEW.is_paid = true AND (OLD.is_paid IS NULL OR OLD.is_paid = false))
  EXECUTE FUNCTION notify_payment_received();

-- 3. Review Received: Notify admin when review is inserted
CREATE OR REPLACE FUNCTION notify_review_received()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT 
    NEW.photographer_id,
    'New Review ⭐',
    'You received a ' || NEW.rating || '-star review' || 
    CASE WHEN NEW.review_text IS NOT NULL THEN ': "' || LEFT(NEW.review_text, 80) || '"' ELSE '' END || '.',
    'system',
    jsonb_build_object('reviewId', NEW.id, 'rating', NEW.rating)
  WHERE NEW.photographer_id IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on review insert
DROP TRIGGER IF EXISTS trg_review_received ON reviews;
CREATE TRIGGER trg_review_received
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_received();

-- 4. Support Reply: Notify admin when support message is received
CREATE OR REPLACE FUNCTION notify_support_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_role = 'super_admin' THEN
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT 
      sc.photographer_id,
      'Support Reply 💬',
      'You have a new reply from support.',
      'system',
      jsonb_build_object('channelId', NEW.channel_id)
    FROM support_channels sc WHERE sc.id = NEW.channel_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on support message insert
DROP TRIGGER IF EXISTS trg_support_reply ON support_messages;
CREATE TRIGGER trg_support_reply
  AFTER INSERT ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_support_reply();

-- 5. SMS Low Balance Warning: Notify when credits drop below 10
CREATE OR REPLACE FUNCTION notify_sms_low_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance < 10 AND (OLD.balance IS NULL OR OLD.balance >= 10) THEN
    INSERT INTO notifications (user_id, title, body, type, data)
    VALUES (
      NEW.admin_id,
      'SMS Credits Low ⚠️',
      'You have only ' || NEW.balance || ' SMS credits remaining. Purchase more to continue sending.',
      'system',
      jsonb_build_object('balance', NEW.balance)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on sms_credits update
DROP TRIGGER IF EXISTS trg_sms_low_balance ON sms_credits;
CREATE TRIGGER trg_sms_low_balance
  AFTER UPDATE ON sms_credits
  FOR EACH ROW
  WHEN (NEW.balance < 10 AND (OLD.balance IS NULL OR OLD.balance >= 10))
  EXECUTE FUNCTION notify_sms_low_balance();
