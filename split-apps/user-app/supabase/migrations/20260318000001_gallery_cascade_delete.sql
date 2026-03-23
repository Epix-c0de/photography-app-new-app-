-- Migration: Add ON DELETE CASCADE to all foreign keys referencing galleries(id)
-- This permanently fixes the 409 Conflict when deleting a gallery.
-- Any row in a child table that references the gallery will be auto-deleted.
-- Payments use SET NULL to preserve payment history.

-- Helper: find and drop a foreign key constraint if it exists
CREATE OR REPLACE FUNCTION _drop_fk_if_exists(p_table text, p_column text, p_ref_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_class r ON r.oid = c.confrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = p_table
    AND r.relname = p_ref_table
    AND n.nspname = 'public'
    AND c.contype = 'f'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', p_table, v_constraint);
  END IF;
END;
$$;

-- 1. gallery_photos → galleries (CASCADE)
SELECT _drop_fk_if_exists('gallery_photos', 'gallery_id', 'galleries');
ALTER TABLE public.gallery_photos
  ADD CONSTRAINT gallery_photos_gallery_id_fkey
  FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE CASCADE;

-- 2. unlocked_galleries → galleries (CASCADE)
SELECT _drop_fk_if_exists('unlocked_galleries', 'gallery_id', 'galleries');
ALTER TABLE public.unlocked_galleries
  ADD CONSTRAINT unlocked_galleries_gallery_id_fkey
  FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE CASCADE;

-- 3. notifications → galleries (SET NULL — keep notifications but clear reference)
SELECT _drop_fk_if_exists('notifications', 'gallery_id', 'galleries');
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_gallery_id_fkey
  FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE SET NULL;

-- 4. gallery_views → galleries (CASCADE)
SELECT _drop_fk_if_exists('gallery_views', 'gallery_id', 'galleries');
ALTER TABLE public.gallery_views
  ADD CONSTRAINT gallery_views_gallery_id_fkey
  FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE CASCADE;

-- 5. gallery_delivery_status → galleries (CASCADE)
SELECT _drop_fk_if_exists('gallery_delivery_status', 'gallery_id', 'galleries');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gallery_delivery_status' AND table_schema = 'public') THEN
    EXECUTE $inner$
      ALTER TABLE public.gallery_delivery_status
        ADD CONSTRAINT gallery_delivery_status_gallery_id_fkey
        FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE CASCADE
    $inner$;
  END IF;
END;
$$;

-- 6. gallery_shares → galleries (CASCADE)
SELECT _drop_fk_if_exists('gallery_shares', 'gallery_id', 'galleries');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gallery_shares' AND table_schema = 'public') THEN
    EXECUTE $inner$
      ALTER TABLE public.gallery_shares
        ADD CONSTRAINT gallery_shares_gallery_id_fkey
        FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE CASCADE
    $inner$;
  END IF;
END;
$$;

-- 7. upload_logs → galleries (CASCADE)
SELECT _drop_fk_if_exists('upload_logs', 'gallery_id', 'galleries');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_logs' AND table_schema = 'public') THEN
    EXECUTE $inner$
      ALTER TABLE public.upload_logs
        ADD CONSTRAINT upload_logs_gallery_id_fkey
        FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE CASCADE
    $inner$;
  END IF;
END;
$$;

-- 8. upload_sessions → galleries (CASCADE)
SELECT _drop_fk_if_exists('upload_sessions', 'gallery_id', 'galleries');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_sessions' AND table_schema = 'public') THEN
    EXECUTE $inner$
      ALTER TABLE public.upload_sessions
        ADD CONSTRAINT upload_sessions_gallery_id_fkey
        FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE CASCADE
    $inner$;
  END IF;
END;
$$;

-- 9. sms_logs → galleries (CASCADE)
SELECT _drop_fk_if_exists('sms_logs', 'gallery_id', 'galleries');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sms_logs' AND table_schema = 'public') THEN
    EXECUTE $inner$
      ALTER TABLE public.sms_logs
        ADD CONSTRAINT sms_logs_gallery_id_fkey
        FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE CASCADE
    $inner$;
  END IF;
END;
$$;

-- 10. payments → galleries (SET NULL — preserve payment history)
SELECT _drop_fk_if_exists('payments', 'gallery_id', 'galleries');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments' AND table_schema = 'public') THEN
    EXECUTE $inner$
      ALTER TABLE public.payments
        ADD CONSTRAINT payments_gallery_id_fkey
        FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE SET NULL
    $inner$;
  END IF;
END;
$$;

-- 11. mpesa_transactions → galleries (SET NULL — preserve transaction history)
SELECT _drop_fk_if_exists('mpesa_transactions', 'gallery_id', 'galleries');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mpesa_transactions' AND table_schema = 'public') THEN
    EXECUTE $inner$
      ALTER TABLE public.mpesa_transactions
        ADD CONSTRAINT mpesa_transactions_gallery_id_fkey
        FOREIGN KEY (gallery_id) REFERENCES public.galleries(id) ON DELETE SET NULL
    $inner$;
  END IF;
END;
$$;

-- Clean up helper function
DROP FUNCTION IF EXISTS _drop_fk_if_exists(text, text, text);
