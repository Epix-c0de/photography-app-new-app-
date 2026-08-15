-- ============================================================
-- FIX: Announcements visibility constraint + Notification triggers
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. FIX ANNOUNCEMENTS VISIBILITY CHECK CONSTRAINT
-- Drop the old constraint and add the correct one
DO $$
BEGIN
  -- Drop existing check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'announcements_visibility_check'
    AND conrelid = 'public.announcements'::regclass
  ) THEN
    ALTER TABLE public.announcements DROP CONSTRAINT announcements_visibility_check;
  END IF;
END $$;

-- Add the correct check constraint
ALTER TABLE public.announcements
ADD CONSTRAINT announcements_visibility_check
CHECK (visibility IN ('global', 'assigned_only', 'private'));

-- Do the same for bts_posts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bts_posts_visibility_check'
    AND conrelid = 'public.bts_posts'::regclass
  ) THEN
    ALTER TABLE public.bts_posts DROP CONSTRAINT bts_posts_visibility_check;
  END IF;
END $$;

ALTER TABLE public.bts_posts
ADD CONSTRAINT bts_posts_visibility_check
CHECK (visibility IN ('global', 'assigned_only', 'private'));

-- 2. FIX NOTIFICATIONS TABLE - ensure it has the right columns
-- The trigger functions use 'body' but some tables use 'message'
DO $$
BEGIN
  -- Add body column if it doesn't exist (some tables use 'message' instead)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'body'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN body text;
  END IF;

  -- Add client_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN client_id uuid;
  END IF;
END $$;

-- 3. DROP OLD TRIGGER FUNCTIONS AND RECREATE WITH CORRECT COLUMN NAMES
-- Package notification trigger
DROP TRIGGER IF EXISTS trigger_package_notification ON public.packages;
DROP FUNCTION IF EXISTS notify_package_update() CASCADE;

CREATE OR REPLACE FUNCTION notify_package_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_active != NEW.is_active AND NEW.is_active = true) THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
    SELECT
      up.id,
      CASE WHEN TG_OP = 'INSERT' THEN 'New Package Available!' ELSE 'Package Updated!' END,
      CASE WHEN TG_OP = 'INSERT'
        THEN 'A new photography package "' || NEW.name || '" is now available.'
        ELSE 'The package "' || NEW.name || '" has been updated.'
      END,
      'package_update',
      jsonb_build_object('package_id', NEW.id, 'package_name', NEW.name, 'price', NEW.price)
    FROM public.user_profiles up
    WHERE up.role IN ('client', 'user');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_package_notification
  AFTER INSERT OR UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION notify_package_update();

-- 4. GALLERY NOTIFICATION TRIGGER
DROP TRIGGER IF EXISTS trg_gallery_published ON public.galleries;
DROP FUNCTION IF EXISTS notify_gallery_published() CASCADE;

CREATE OR REPLACE FUNCTION notify_gallery_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, client_id, title, body, type, data)
    SELECT
      c.user_id,
      NEW.client_id,
      'Gallery Ready!',
      'Your ' || COALESCE(NEW.shoot_type, 'photo') || ' gallery "' || COALESCE(NEW.name, 'Gallery') || '" is ready to view.',
      'gallery',
      jsonb_build_object('galleryId', NEW.id, 'accessCode', NEW.access_code)
    FROM public.clients c WHERE c.id = NEW.client_id AND c.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_gallery_published
  AFTER INSERT ON public.galleries
  FOR EACH ROW
  EXECUTE FUNCTION notify_gallery_published();

-- 5. BTS POST NOTIFICATION TRIGGER
DROP TRIGGER IF EXISTS trg_bts_post_created ON public.bts_posts;
DROP FUNCTION IF EXISTS notify_bts_post() CASCADE;

CREATE OR REPLACE FUNCTION notify_bts_post()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visibility = 'global' OR NEW.visibility = 'assigned_only' THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
    SELECT
      c.user_id,
      'New Behind-the-Scenes!',
      'Check out the new BTS content: "' || COALESCE(NEW.title, 'New post') || '"',
      'bts',
      jsonb_build_object('btsId', NEW.id, 'title', NEW.title)
    FROM public.clients c
    WHERE c.owner_admin_id = NEW.created_by AND c.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_bts_post_created
  AFTER INSERT ON public.bts_posts
  FOR EACH ROW
  EXECUTE FUNCTION notify_bts_post();

-- 6. ANNOUNCEMENT NOTIFICATION TRIGGER
DROP TRIGGER IF EXISTS trg_announcement_created ON public.announcements;
DROP FUNCTION IF EXISTS notify_announcement() CASCADE;

CREATE OR REPLACE FUNCTION notify_announcement()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify all clients of this admin (announcements don't have client_id)
  IF NEW.visibility = 'global' OR NEW.visibility = 'assigned_only' THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
    SELECT
      c.user_id,
      'New Announcement!',
      COALESCE(NEW.title, 'New announcement') || ': ' || COALESCE(NEW.content, NEW.description, ''),
      'announcement',
      jsonb_build_object('announcementId', NEW.id, 'title', NEW.title)
    FROM public.clients c
    WHERE c.owner_admin_id = NEW.created_by AND c.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_announcement_created
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION notify_announcement();

-- 7. SMS/MESSAGE NOTIFICATION TRIGGER (notify client when message is sent)
DROP TRIGGER IF EXISTS trg_sms_sent ON public.delivery_logs;
DROP FUNCTION IF EXISTS notify_sms_sent() CASCADE;

CREATE OR REPLACE FUNCTION notify_sms_sent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND NEW.recipient IS NOT NULL THEN
    -- Try to find the client by phone number and notify them
    INSERT INTO public.notifications (user_id, title, body, type, data)
    SELECT
      c.user_id,
      'Message Sent',
      'A message was sent to your phone.',
      'message',
      jsonb_build_object('logId', NEW.id, 'type', NEW.message_type)
    FROM public.clients c
    WHERE c.phone = NEW.recipient AND c.user_id IS NOT NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sms_sent
  AFTER INSERT OR UPDATE ON public.delivery_logs
  FOR EACH ROW
  WHEN (NEW.status = 'sent')
  EXECUTE FUNCTION notify_sms_sent();

-- 8. PAYMENT RECEIVED NOTIFICATION TRIGGER
DROP TRIGGER IF EXISTS trg_payment_received ON public.galleries;
DROP FUNCTION IF EXISTS notify_payment_received() CASCADE;

CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_paid = true AND (OLD.is_paid IS NULL OR OLD.is_paid = false) THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      NEW.owner_admin_id,
      'Payment Received!',
      'Client has paid KES ' || COALESCE(NEW.price::text, '0') || ' for gallery "' || COALESCE(NEW.name, 'Gallery') || '".',
      'payment',
      jsonb_build_object('galleryId', NEW.id, 'amount', NEW.price)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_payment_received
  AFTER UPDATE ON public.galleries
  FOR EACH ROW
  WHEN (NEW.is_paid = true AND (OLD.is_paid IS NULL OR OLD.is_paid = false))
  EXECUTE FUNCTION notify_payment_received();

-- 9. ENSURE RLS POLICIES ALLOW TRIGGER FUNCTIONS TO WORK
-- The triggers use SECURITY DEFINER so they bypass RLS, but let's ensure policies exist

-- Notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance (safe - only create if column exists)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
  END IF;
END $$;

-- Done!
SELECT 'All fixes applied successfully!' as status;
