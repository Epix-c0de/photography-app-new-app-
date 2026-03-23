DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_upload_status') THEN
    CREATE TYPE public.photo_upload_status AS ENUM ('pending', 'uploaded', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_session_status') THEN
    CREATE TYPE public.upload_session_status AS ENUM ('initializing', 'uploading', 'completed', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gallery_upload_status') THEN
    CREATE TYPE public.gallery_upload_status AS ENUM ('pending', 'uploading', 'completed', 'failed', 'corrupted');
  END IF;
END $$;

ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS created_by_admin_id uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_photos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_file_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_total_size bigint,
  ADD COLUMN IF NOT EXISTS upload_status public.gallery_upload_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sms_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_sent boolean NOT NULL DEFAULT false;

UPDATE public.galleries
SET created_by_admin_id = owner_admin_id
WHERE created_by_admin_id IS NULL;

UPDATE public.galleries
SET upload_status = 'completed',
    is_active = true
WHERE total_photos > 0;

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
  checksum text,
  medium_url text,
  thumbnail_url text,
  upload_status public.photo_upload_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photos_gallery_id_idx ON public.photos(gallery_id);
CREATE UNIQUE INDEX IF NOT EXISTS photos_gallery_file_url_idx ON public.photos(gallery_id, file_url);
CREATE INDEX IF NOT EXISTS photos_gallery_created_at_idx ON public.photos(gallery_id, created_at);

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
  parallel_upload_limit integer NOT NULL DEFAULT 5,
  estimated_total_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upload_sessions_admin_id_idx ON public.upload_sessions(admin_id);
CREATE INDEX IF NOT EXISTS upload_sessions_gallery_id_idx ON public.upload_sessions(gallery_id);

CREATE TABLE IF NOT EXISTS public.upload_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  file_name text,
  status text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upload_logs_gallery_id_idx ON public.upload_logs(gallery_id);

ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage upload logs" ON public.upload_logs;
CREATE POLICY "Admins can manage upload logs"
  ON public.upload_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = upload_logs.gallery_id
      AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.galleries g
      WHERE g.id = upload_logs.gallery_id
      AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())
    )
  );

CREATE TABLE IF NOT EXISTS public.photo_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photo_processing_jobs_photo_id_idx ON public.photo_processing_jobs(photo_id);

ALTER TABLE public.photo_processing_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage photo processing jobs" ON public.photo_processing_jobs;
CREATE POLICY "Admins can manage photo processing jobs"
  ON public.photo_processing_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.photos p
      JOIN public.galleries g ON g.id = p.gallery_id
      WHERE p.id = photo_processing_jobs.photo_id
      AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.photos p
      JOIN public.galleries g ON g.id = p.gallery_id
      WHERE p.id = photo_processing_jobs.photo_id
      AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())
    )
  );

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
  client_id uuid,
  gallery_name text,
  total_files integer,
  estimated_total_size bigint DEFAULT NULL
)
RETURNS TABLE(session_id uuid, access_code text, gallery_id uuid, parallel_upload_limit integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id uuid;
  v_gallery_id uuid;
  v_access_code text;
  v_attempt int;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_owner uuid;
BEGIN
  SELECT owner_admin_id INTO v_owner
  FROM public.clients
  WHERE id = client_id;

  IF v_owner IS NULL OR v_owner <> admin_id THEN
    RAISE EXCEPTION 'CLIENT_FORBIDDEN';
  END IF;

  INSERT INTO public.upload_sessions (admin_id, status, total_files, estimated_total_size)
  VALUES (admin_id, 'initializing', total_files, estimated_total_size)
  RETURNING id INTO v_session_id;

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
        access_code,
        is_locked,
        is_paid,
        price,
        status,
        is_active,
        upload_status,
        expected_file_count,
        estimated_total_size
      )
      VALUES (
        admin_id,
        admin_id,
        client_id,
        gallery_name,
        v_access_code,
        true,
        false,
        0,
        'locked',
        false,
        'pending',
        total_files,
        estimated_total_size
      )
      RETURNING id INTO v_gallery_id;

      UPDATE public.upload_sessions
      SET gallery_id = v_gallery_id
      WHERE id = v_session_id;

      RETURN QUERY SELECT v_session_id, v_access_code, v_gallery_id, 5;
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
  SET total_photos = v_uploaded,
      upload_status = 'completed',
      is_active = true
  WHERE id = v_gallery_id;

  UPDATE public.upload_sessions
  SET status = 'completed'
  WHERE id = session_id;

  RETURN QUERY SELECT v_gallery_id, v_uploaded, v_failed, v_total;
END;
$$;
