DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_upload_status') THEN
    CREATE TYPE public.photo_upload_status AS ENUM ('pending', 'uploaded', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_session_status') THEN
    CREATE TYPE public.upload_session_status AS ENUM ('initializing', 'uploading', 'completed', 'failed');
  END IF;
END $$;

ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS created_by_admin_id uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_photos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_sent boolean NOT NULL DEFAULT false;

UPDATE public.galleries
SET created_by_admin_id = owner_admin_id
WHERE created_by_admin_id IS NULL;

ALTER TABLE public.galleries
  ALTER COLUMN created_by_admin_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS galleries_client_phone_idx ON public.galleries(client_phone);
CREATE INDEX IF NOT EXISTS galleries_created_by_admin_idx ON public.galleries(created_by_admin_id);

CREATE TABLE IF NOT EXISTS public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  file_size integer,
  mime_type text,
  upload_status public.photo_upload_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photos_gallery_id_idx ON public.photos(gallery_id);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage photos" ON public.photos;
CREATE POLICY "Admins can manage photos"
  ON public.photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = photos.gallery_id
      AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = photos.gallery_id
      AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())
    )
  );

CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid REFERENCES public.galleries(id) ON DELETE SET NULL,
  admin_id uuid NOT NULL REFERENCES public.user_profiles(id),
  status public.upload_session_status NOT NULL DEFAULT 'initializing',
  total_files integer NOT NULL,
  uploaded_files integer NOT NULL DEFAULT 0,
  failed_files integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upload_sessions_admin_id_idx ON public.upload_sessions(admin_id);
CREATE INDEX IF NOT EXISTS upload_sessions_gallery_id_idx ON public.upload_sessions(gallery_id);

ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage upload sessions" ON public.upload_sessions;
CREATE POLICY "Admins can manage upload sessions"
  ON public.upload_sessions FOR ALL
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

CREATE TABLE IF NOT EXISTS public.access_code_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_code_attempts_identifier_idx ON public.access_code_attempts(identifier);

CREATE OR REPLACE FUNCTION public.init_upload_session(
  admin_id uuid,
  client_name text,
  client_phone text,
  total_files integer
)
RETURNS TABLE(session_id uuid, access_code text, gallery_id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id uuid;
  v_gallery_id uuid;
  v_access_code text;
  v_client_id uuid;
  v_attempt int;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
BEGIN
  INSERT INTO public.upload_sessions (admin_id, status, total_files)
  VALUES (admin_id, 'initializing', total_files)
  RETURNING id INTO v_session_id;

  SELECT id INTO v_client_id
  FROM public.clients
  WHERE owner_admin_id = admin_id
    AND phone = client_phone
  LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (owner_admin_id, name, phone)
    VALUES (admin_id, client_name, client_phone)
    RETURNING id INTO v_client_id;
  END IF;

  FOR v_attempt IN 1..10 LOOP
    SELECT string_agg(substr(v_chars, (floor(random() * length(v_chars)) + 1)::int, 1), '')
    INTO v_access_code
    FROM generate_series(1, 6);

    IF NOT EXISTS (
      SELECT 1 FROM public.galleries WHERE access_code = v_access_code
    ) THEN
      INSERT INTO public.galleries (
        owner_admin_id,
        created_by_admin_id,
        client_id,
        name,
        client_name,
        client_phone,
        access_code,
        is_locked,
        is_paid,
        price,
        status
      )
      VALUES (
        admin_id,
        admin_id,
        v_client_id,
        client_name,
        client_name,
        client_phone,
        v_access_code,
        true,
        false,
        0,
        'locked'
      )
      RETURNING id INTO v_gallery_id;

      UPDATE public.upload_sessions
      SET gallery_id = v_gallery_id
      WHERE id = v_session_id;

      RETURN QUERY SELECT v_session_id, v_access_code, v_gallery_id;
      RETURN;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'ACCESS_CODE_GENERATION_FAILED';
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_upload_session(
  session_id uuid,
  uploaded_delta integer,
  failed_delta integer,
  new_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.upload_sessions
  SET uploaded_files = uploaded_files + uploaded_delta,
      failed_files = failed_files + failed_delta,
      status = COALESCE(new_status, status)
  WHERE id = session_id;
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

  RETURN QUERY SELECT v_gallery_id, v_uploaded, v_failed, v_total;
END;
$$;
