DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('pending', 'success', 'failed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
    CREATE TYPE public.payment_provider AS ENUM ('mpesa');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sms_delivery_status') THEN
    CREATE TYPE public.sms_delivery_status AS ENUM ('queued', 'sent', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_kind') THEN
    CREATE TYPE public.notification_kind AS ENUM ('upload', 'payment_success', 'payment_failed', 'announcement', 'system');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid REFERENCES public.user_profiles(id) NOT NULL,
  client_id uuid REFERENCES public.clients(id) NOT NULL,
  gallery_id uuid REFERENCES public.galleries(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  status public.payment_status NOT NULL DEFAULT 'pending',
  provider public.payment_provider NOT NULL DEFAULT 'mpesa',
  checkout_request_id text,
  merchant_request_id text,
  mpesa_receipt_number text,
  mpesa_checkout_request_id text,
  phone_number text,
  client_phone text,
  transaction_date timestamptz,
  raw_callback_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS provider public.payment_provider NOT NULL DEFAULT 'mpesa',
  ADD COLUMN IF NOT EXISTS checkout_request_id text,
  ADD COLUMN IF NOT EXISTS merchant_request_id text,
  ADD COLUMN IF NOT EXISTS transaction_date timestamptz,
  ADD COLUMN IF NOT EXISTS raw_callback_payload jsonb;

ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;

UPDATE public.payments
SET checkout_request_id = mpesa_checkout_request_id
WHERE checkout_request_id IS NULL AND mpesa_checkout_request_id IS NOT NULL;

UPDATE public.payments
SET client_phone = phone_number
WHERE client_phone IS NULL AND phone_number IS NOT NULL;

UPDATE public.payments
SET status = CASE WHEN status::text = 'paid' THEN 'success' ELSE status END
WHERE status::text IN ('paid', 'pending', 'failed', 'cancelled', 'success');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_status_check') THEN
    ALTER TABLE public.payments DROP CONSTRAINT payments_status_check;
  END IF;
END $$;

ALTER TABLE public.payments
  ALTER COLUMN status TYPE public.payment_status
  USING (status::text::public.payment_status),
  ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS payments_client_phone_idx ON public.payments(client_phone);
CREATE UNIQUE INDEX IF NOT EXISTS payments_checkout_request_id_key ON public.payments(checkout_request_id) WHERE checkout_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id),
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS gallery_id uuid REFERENCES public.galleries(id),
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS notification_type public.notification_kind,
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL REFERENCES public.user_profiles(id),
  client_id uuid REFERENCES public.clients(id),
  phone_number text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their SMS logs" ON public.sms_logs;
CREATE POLICY "Admins can view their SMS logs"
  ON public.sms_logs FOR SELECT
  USING (auth.uid() = owner_admin_id);

UPDATE public.notifications
SET message = body
WHERE message IS NULL;

UPDATE public.notifications
SET notification_type = type::public.notification_kind
WHERE notification_type IS NULL
  AND type IN ('upload', 'payment_success', 'payment_failed', 'announcement', 'system');

UPDATE public.notifications
SET is_read = read
WHERE is_read IS NULL;

CREATE INDEX IF NOT EXISTS notifications_client_id_idx ON public.notifications(client_id);

DROP POLICY IF EXISTS "Clients can view notifications by client id" ON public.notifications;
CREATE POLICY "Clients can view notifications by client id"
  ON public.notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = notifications.client_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clients can update notifications by client id" ON public.notifications;
CREATE POLICY "Clients can update notifications by client id"
  ON public.notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = notifications.client_id
      AND c.user_id = auth.uid()
    )
  );

ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS gallery_id uuid REFERENCES public.galleries(id),
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS message_body text,
  ADD COLUMN IF NOT EXISTS sent_by_admin_id uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS delivery_status public.sms_delivery_status NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS fallback_whatsapp_triggered boolean NOT NULL DEFAULT false;

UPDATE public.sms_logs
SET client_phone = phone_number
WHERE client_phone IS NULL AND phone_number IS NOT NULL;

UPDATE public.sms_logs
SET message_body = message
WHERE message_body IS NULL AND message IS NOT NULL;

UPDATE public.sms_logs
SET sent_by_admin_id = owner_admin_id
WHERE sent_by_admin_id IS NULL AND owner_admin_id IS NOT NULL;

UPDATE public.sms_logs
SET delivery_status = status::public.sms_delivery_status
WHERE delivery_status IS NULL AND status IN ('queued', 'sent', 'failed');

CREATE INDEX IF NOT EXISTS sms_logs_client_phone_idx ON public.sms_logs(client_phone);

CREATE TABLE IF NOT EXISTS public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.user_profiles(id),
  mpesa_shortcode text NOT NULL,
  mpesa_consumer_key text NOT NULL,
  mpesa_consumer_secret text NOT NULL,
  mpesa_passkey text NOT NULL,
  callback_url text,
  payment_recipient_display_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_settings_active_admin_idx
  ON public.payment_settings(admin_id)
  WHERE is_active = true;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage payment settings" ON public.payment_settings;
CREATE POLICY "Admins can manage payment settings"
  ON public.payment_settings FOR ALL
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

CREATE TABLE IF NOT EXISTS public.event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  payload jsonb,
  gallery_id uuid REFERENCES public.galleries(id),
  client_id uuid REFERENCES public.clients(id),
  admin_id uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_log_event_name_idx ON public.event_log(event_name);
CREATE INDEX IF NOT EXISTS event_log_gallery_id_idx ON public.event_log(gallery_id);

ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their events" ON public.event_log;
CREATE POLICY "Admins can view their events"
  ON public.event_log FOR SELECT
  USING (admin_id = auth.uid());

CREATE OR REPLACE FUNCTION public.emit_event(
  p_event_name text,
  p_payload jsonb,
  p_gallery_id uuid,
  p_client_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.event_log (event_name, payload, gallery_id, client_id, admin_id)
  VALUES (p_event_name, p_payload, p_gallery_id, p_client_id, p_admin_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_client_notification(
  p_client_id uuid,
  p_gallery_id uuid,
  p_type public.notification_kind,
  p_title text,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.notifications (
    client_id,
    gallery_id,
    notification_type,
    title,
    message,
    is_read
  )
  VALUES (
    p_client_id,
    p_gallery_id,
    p_type,
    p_title,
    p_message,
    false
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_mpesa_callback(
  p_checkout_request_id text,
  p_merchant_request_id text,
  p_result_code integer,
  p_receipt_number text,
  p_transaction_date timestamptz,
  p_phone text,
  p_raw_payload jsonb
)
RETURNS TABLE(
  payment_id uuid,
  gallery_id uuid,
  client_id uuid,
  status public.payment_status,
  processed boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id uuid;
  v_gallery_id uuid;
  v_client_id uuid;
  v_status public.payment_status;
BEGIN
  SELECT id, gallery_id, client_id, status
  INTO v_payment_id, v_gallery_id, v_client_id, v_status
  FROM public.payments
  WHERE checkout_request_id = p_checkout_request_id
     OR mpesa_checkout_request_id = p_checkout_request_id
  FOR UPDATE;

  IF v_payment_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::public.payment_status, false;
    RETURN;
  END IF;

  IF v_status <> 'pending' THEN
    RETURN QUERY SELECT v_payment_id, v_gallery_id, v_client_id, v_status, false;
    RETURN;
  END IF;

  IF p_result_code = 0 THEN
    UPDATE public.payments
    SET status = 'success',
        mpesa_receipt_number = p_receipt_number,
        merchant_request_id = COALESCE(p_merchant_request_id, merchant_request_id),
        transaction_date = p_transaction_date,
        client_phone = COALESCE(p_phone, client_phone),
        phone_number = COALESCE(p_phone, phone_number),
        raw_callback_payload = p_raw_payload,
        updated_at = now()
    WHERE id = v_payment_id;

    IF v_gallery_id IS NOT NULL THEN
      UPDATE public.galleries
      SET is_paid = true,
          is_locked = false,
          is_active = true
      WHERE id = v_gallery_id;
    END IF;

    RETURN QUERY SELECT v_payment_id, v_gallery_id, v_client_id, 'success'::public.payment_status, true;
  ELSE
    UPDATE public.payments
    SET status = 'failed',
        raw_callback_payload = p_raw_payload,
        updated_at = now()
    WHERE id = v_payment_id;

    RETURN QUERY SELECT v_payment_id, v_gallery_id, v_client_id, 'failed'::public.payment_status, true;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_upload_session(
  session_id uuid
)
RETURNS TABLE(gallery_id uuid, uploaded_files integer, failed_files integer, total_files integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_gallery_id uuid;
  v_uploaded integer;
  v_failed integer;
  v_total integer;
  v_client_id uuid;
  v_client_name text;
BEGIN
  SELECT gallery_id, uploaded_files, failed_files, total_files
  INTO v_gallery_id, v_uploaded, v_failed, v_total
  FROM public.upload_sessions
  WHERE id = session_id
  FOR UPDATE;

  IF v_gallery_id IS NULL THEN
    RAISE EXCEPTION 'SESSION_GALLERY_MISSING';
  END IF;

  IF v_uploaded + v_failed < v_total THEN
    RAISE EXCEPTION 'UPLOADS_INCOMPLETE';
  END IF;

  UPDATE public.galleries
  SET total_photos = v_uploaded
  WHERE id = v_gallery_id;

  UPDATE public.upload_sessions
  SET status = 'completed'
  WHERE id = session_id;

  SELECT client_id, client_name INTO v_client_id, v_client_name
  FROM public.galleries
  WHERE id = v_gallery_id;

  IF v_client_id IS NOT NULL THEN
    PERFORM public.create_client_notification(
      v_client_id,
      v_gallery_id,
      'upload',
      'Your Photos Are Ready',
      COALESCE('Hello ' || v_client_name || ', your photos are ready.', 'Your photos are ready.')
    );

    PERFORM public.emit_event(
      'GALLERY_UPLOADED',
      jsonb_build_object('gallery_id', v_gallery_id, 'client_id', v_client_id),
      v_gallery_id,
      v_client_id,
      NULL
    );
  END IF;

  RETURN QUERY SELECT v_gallery_id, v_uploaded, v_failed, v_total;
END;
$$;

ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS release_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_locked_until_release boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.bts_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  media_url text NOT NULL,
  media_type text CHECK (media_type IN ('image', 'video')) NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  scheduled_for timestamptz,
  music_url text,
  views_count integer NOT NULL DEFAULT 0,
  clicks_count integer NOT NULL DEFAULT 0,
  target_audience text[],
  is_active boolean NOT NULL DEFAULT true,
  shoot_type text,
  created_by uuid REFERENCES auth.users(id),
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  admin_id uuid,
  video_url text,
  caption text,
  music_track_url text
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  tag text,
  cta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  content_html text,
  media_url text,
  media_type text CHECK (media_type IN ('image', 'video')),
  category text,
  created_by uuid REFERENCES auth.users(id),
  comments_count integer NOT NULL DEFAULT 0,
  body_html text,
  created_by_admin uuid,
  is_published boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.bts_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bts_id uuid REFERENCES public.bts_posts(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  post_id uuid,
  comment_text text
);

CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  comment_text text
);

CREATE TABLE IF NOT EXISTS public.bts_likes (
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  bts_id uuid REFERENCES public.bts_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid DEFAULT gen_random_uuid(),
  client_id uuid,
  post_id uuid,
  PRIMARY KEY (user_id, bts_id)
);

ALTER TABLE public.bts_posts
  ADD COLUMN IF NOT EXISTS admin_id uuid,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS music_track_url text;

UPDATE public.bts_posts
SET admin_id = created_by
WHERE admin_id IS NULL AND created_by IS NOT NULL;

UPDATE public.bts_posts
SET video_url = media_url
WHERE video_url IS NULL AND media_url IS NOT NULL;

UPDATE public.bts_posts
SET caption = title
WHERE caption IS NULL AND title IS NOT NULL;

UPDATE public.bts_posts
SET music_track_url = music_url
WHERE music_track_url IS NULL AND music_url IS NOT NULL;

ALTER TABLE public.bts_likes
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS post_id uuid;

UPDATE public.bts_likes
SET client_id = user_id
WHERE client_id IS NULL AND user_id IS NOT NULL;

UPDATE public.bts_likes
SET post_id = bts_id
WHERE post_id IS NULL AND bts_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bts_likes_client_post_key ON public.bts_likes(client_id, post_id);
CREATE INDEX IF NOT EXISTS bts_likes_post_id_idx ON public.bts_likes(post_id);

ALTER TABLE public.bts_comments
  ADD COLUMN IF NOT EXISTS post_id uuid,
  ADD COLUMN IF NOT EXISTS comment_text text;

UPDATE public.bts_comments
SET post_id = bts_id
WHERE post_id IS NULL AND bts_id IS NOT NULL;

UPDATE public.bts_comments
SET comment_text = comment
WHERE comment_text IS NULL AND comment IS NOT NULL;

CREATE INDEX IF NOT EXISTS bts_comments_post_id_idx ON public.bts_comments(post_id);

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS created_by_admin uuid,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

UPDATE public.announcements
SET body_html = content_html
WHERE body_html IS NULL AND content_html IS NOT NULL;

UPDATE public.announcements
SET created_by_admin = created_by
WHERE created_by_admin IS NULL AND created_by IS NOT NULL;

UPDATE public.announcements
SET is_published = is_active
WHERE is_published IS NULL;

ALTER TABLE public.announcement_comments
  ADD COLUMN IF NOT EXISTS comment_text text;

UPDATE public.announcement_comments
SET comment_text = comment
WHERE comment_text IS NULL AND comment IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gallery_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE,
  caption text,
  background_music_url text,
  download_app_link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gallery_shares_gallery_id_idx ON public.gallery_shares(gallery_id);
CREATE INDEX IF NOT EXISTS gallery_shares_client_id_idx ON public.gallery_shares(client_id);

ALTER TABLE public.gallery_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can manage their shares" ON public.gallery_shares;
CREATE POLICY "Clients can manage their shares"
  ON public.gallery_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = gallery_shares.client_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = gallery_shares.client_id
      AND c.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  client_id uuid REFERENCES public.clients(id),
  gallery_id uuid REFERENCES public.galleries(id),
  admin_id uuid REFERENCES public.user_profiles(id),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_event_type_idx ON public.events(event_type);
CREATE INDEX IF NOT EXISTS events_gallery_id_idx ON public.events(gallery_id);
CREATE INDEX IF NOT EXISTS events_client_id_idx ON public.events(client_id);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view events" ON public.events;
CREATE POLICY "Admins can view events"
  ON public.events FOR SELECT
  USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "Clients can view their events" ON public.events;
CREATE POLICY "Clients can view their events"
  ON public.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = events.client_id
      AND c.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.storage_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.user_profiles(id),
  total_bytes_used bigint NOT NULL DEFAULT 0,
  total_galleries integer NOT NULL DEFAULT 0,
  total_photos integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_usage_admin_id_key ON public.storage_usage(admin_id);

ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage storage usage" ON public.storage_usage;
CREATE POLICY "Admins can manage storage usage"
  ON public.storage_usage FOR ALL
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

CREATE TABLE IF NOT EXISTS public.client_lifetime_stats (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  total_galleries integer NOT NULL DEFAULT 0,
  total_paid_amount numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_lifetime_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view lifetime stats" ON public.client_lifetime_stats;
CREATE POLICY "Clients can view lifetime stats"
  ON public.client_lifetime_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_lifetime_stats.client_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view lifetime stats" ON public.client_lifetime_stats;
CREATE POLICY "Admins can view lifetime stats"
  ON public.client_lifetime_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_lifetime_stats.client_id
      AND c.owner_admin_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.bulk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.user_profiles(id),
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bulk_jobs_admin_id_idx ON public.bulk_jobs(admin_id);

ALTER TABLE public.bulk_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage bulk jobs" ON public.bulk_jobs;
CREATE POLICY "Admins can manage bulk jobs"
  ON public.bulk_jobs FOR ALL
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

CREATE TABLE IF NOT EXISTS public.greeting_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.user_profiles(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  send_at timestamptz NOT NULL,
  message_template text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS greeting_schedules_admin_id_idx ON public.greeting_schedules(admin_id);
CREATE INDEX IF NOT EXISTS greeting_schedules_send_at_idx ON public.greeting_schedules(send_at);

ALTER TABLE public.greeting_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage greetings" ON public.greeting_schedules;
CREATE POLICY "Admins can manage greetings"
  ON public.greeting_schedules FOR ALL
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

CREATE OR REPLACE FUNCTION public.record_event(
  p_event_type text,
  p_client_id uuid,
  p_gallery_id uuid,
  p_admin_id uuid,
  p_metadata jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.events (event_type, client_id, gallery_id, admin_id, metadata)
  VALUES (p_event_type, p_client_id, p_gallery_id, p_admin_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_gallery_payment(
  p_gallery_id uuid,
  p_client_id uuid,
  p_client_phone text,
  p_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id uuid;
  v_pending_id uuid;
  v_pending_created timestamptz;
  v_owner_admin_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_gallery_id::text));

  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE gallery_id = p_gallery_id AND status = 'success'
  ) THEN
    RAISE EXCEPTION 'GALLERY_ALREADY_PAID';
  END IF;

  SELECT id, created_at
  INTO v_pending_id, v_pending_created
  FROM public.payments
  WHERE gallery_id = p_gallery_id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_pending_id IS NOT NULL THEN
    IF now() - v_pending_created < interval '10 minutes' THEN
      RAISE EXCEPTION 'PAYMENT_IN_PROGRESS';
    ELSE
      UPDATE public.payments
      SET status = 'cancelled', updated_at = now()
      WHERE id = v_pending_id;
    END IF;
  END IF;

  SELECT owner_admin_id INTO v_owner_admin_id
  FROM public.galleries
  WHERE id = p_gallery_id;

  INSERT INTO public.payments (
    owner_admin_id,
    client_id,
    gallery_id,
    amount,
    currency,
    status,
    provider,
    client_phone,
    phone_number
  )
  VALUES (
    v_owner_admin_id,
    p_client_id,
    p_gallery_id,
    p_amount,
    'KES',
    'pending',
    'mpesa',
    p_client_phone,
    p_client_phone
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_due_galleries()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.galleries
  SET is_active = true,
      is_locked_until_release = false
  WHERE release_at IS NOT NULL
    AND release_at <= now()
    AND is_paid = true
    AND is_active = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_greeting_schedules()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
  v_row record;
  v_user_id uuid;
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.greeting_schedules
    WHERE status = 'scheduled' AND send_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT user_id INTO v_user_id
    FROM public.clients
    WHERE id = v_row.client_id;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_user_id,
        'system',
        'Greeting',
        v_row.message_template,
        jsonb_build_object('client_id', v_row.client_id)
      );

      PERFORM public.record_event(
        'greeting_sent',
        v_row.client_id,
        NULL,
        v_row.admin_id,
        jsonb_build_object('schedule_id', v_row.id)
      );
    END IF;

    UPDATE public.greeting_schedules
    SET status = 'sent', updated_at = now()
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_mpesa_callback(
  p_checkout_request_id text,
  p_merchant_request_id text,
  p_result_code integer,
  p_receipt_number text,
  p_transaction_date timestamptz,
  p_phone text,
  p_raw_payload jsonb
)
RETURNS TABLE(
  payment_id uuid,
  gallery_id uuid,
  client_id uuid,
  status public.payment_status,
  processed boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id uuid;
  v_gallery_id uuid;
  v_client_id uuid;
  v_status public.payment_status;
  v_amount numeric;
BEGIN
  SELECT id, gallery_id, client_id, status, amount
  INTO v_payment_id, v_gallery_id, v_client_id, v_status, v_amount
  FROM public.payments
  WHERE checkout_request_id = p_checkout_request_id
     OR mpesa_checkout_request_id = p_checkout_request_id
  FOR UPDATE;

  IF v_payment_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::public.payment_status, false;
    RETURN;
  END IF;

  IF v_status <> 'pending' THEN
    RETURN QUERY SELECT v_payment_id, v_gallery_id, v_client_id, v_status, false;
    RETURN;
  END IF;

  IF p_result_code = 0 THEN
    UPDATE public.payments
    SET status = 'success',
        mpesa_receipt_number = p_receipt_number,
        merchant_request_id = COALESCE(p_merchant_request_id, merchant_request_id),
        transaction_date = p_transaction_date,
        client_phone = COALESCE(p_phone, client_phone),
        phone_number = COALESCE(p_phone, phone_number),
        raw_callback_payload = p_raw_payload,
        updated_at = now()
    WHERE id = v_payment_id;

    IF v_gallery_id IS NOT NULL THEN
      UPDATE public.galleries
      SET is_paid = true,
          is_locked = false,
          is_active = CASE
            WHEN release_at IS NULL OR release_at <= now() THEN true
            ELSE false
          END,
          is_locked_until_release = CASE
            WHEN release_at IS NULL OR release_at <= now() THEN false
            ELSE true
          END
      WHERE id = v_gallery_id;
    END IF;

    IF v_client_id IS NOT NULL THEN
      INSERT INTO public.client_lifetime_stats (client_id, total_galleries, total_paid_amount, updated_at)
      VALUES (v_client_id, 0, COALESCE(v_amount, 0), now())
      ON CONFLICT (client_id) DO UPDATE
      SET total_paid_amount = public.client_lifetime_stats.total_paid_amount + EXCLUDED.total_paid_amount,
          updated_at = now();
    END IF;

    RETURN QUERY SELECT v_payment_id, v_gallery_id, v_client_id, 'success'::public.payment_status, true;
  ELSE
    UPDATE public.payments
    SET status = 'failed',
        raw_callback_payload = p_raw_payload,
        updated_at = now()
    WHERE id = v_payment_id;

    RETURN QUERY SELECT v_payment_id, v_gallery_id, v_client_id, 'failed'::public.payment_status, true;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_upload_session(
  session_id uuid
)
RETURNS TABLE(gallery_id uuid, uploaded_files integer, failed_files integer, total_files integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_gallery_id uuid;
  v_uploaded integer;
  v_failed integer;
  v_total integer;
  v_client_id uuid;
  v_client_name text;
  v_owner_admin_id uuid;
  v_bytes bigint;
BEGIN
  SELECT gallery_id, uploaded_files, failed_files, total_files
  INTO v_gallery_id, v_uploaded, v_failed, v_total
  FROM public.upload_sessions
  WHERE id = session_id
  FOR UPDATE;

  IF v_gallery_id IS NULL THEN
    RAISE EXCEPTION 'SESSION_GALLERY_MISSING';
  END IF;

  IF v_uploaded + v_failed < v_total THEN
    RAISE EXCEPTION 'UPLOADS_INCOMPLETE';
  END IF;

  UPDATE public.galleries
  SET total_photos = v_uploaded,
      is_active = CASE
        WHEN release_at IS NULL OR release_at <= now() THEN is_active
        ELSE false
      END,
      is_locked_until_release = CASE
        WHEN release_at IS NULL OR release_at <= now() THEN false
        ELSE true
      END
  WHERE id = v_gallery_id
  RETURNING owner_admin_id INTO v_owner_admin_id;

  SELECT COALESCE(SUM(file_size), 0)
  INTO v_bytes
  FROM public.photos
  WHERE gallery_id = v_gallery_id AND upload_status = 'uploaded';

  INSERT INTO public.storage_usage (admin_id, total_bytes_used, total_galleries, total_photos, updated_at)
  VALUES (v_owner_admin_id, v_bytes, 1, v_uploaded, now())
  ON CONFLICT (admin_id) DO UPDATE
  SET total_bytes_used = public.storage_usage.total_bytes_used + EXCLUDED.total_bytes_used,
      total_galleries = public.storage_usage.total_galleries + EXCLUDED.total_galleries,
      total_photos = public.storage_usage.total_photos + EXCLUDED.total_photos,
      updated_at = now();

  UPDATE public.upload_sessions
  SET status = 'completed'
  WHERE id = session_id;

  SELECT client_id, client_name INTO v_client_id, v_client_name
  FROM public.galleries
  WHERE id = v_gallery_id;

  IF v_client_id IS NOT NULL THEN
    PERFORM public.create_client_notification(
      v_client_id,
      v_gallery_id,
      'upload',
      'Your Photos Are Ready',
      COALESCE('Hello ' || v_client_name || ', your photos are ready.', 'Your photos are ready.')
    );

    PERFORM public.emit_event(
      'GALLERY_UPLOADED',
      jsonb_build_object('gallery_id', v_gallery_id, 'client_id', v_client_id),
      v_gallery_id,
      v_client_id,
      NULL
    );

    INSERT INTO public.client_lifetime_stats (client_id, total_galleries, total_paid_amount, updated_at)
    VALUES (v_client_id, 1, 0, now())
    ON CONFLICT (client_id) DO UPDATE
    SET total_galleries = public.client_lifetime_stats.total_galleries + 1,
        updated_at = now();
  END IF;

  RETURN QUERY SELECT v_gallery_id, v_uploaded, v_failed, v_total;
END;
$$;
