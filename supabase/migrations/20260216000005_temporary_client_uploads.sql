DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'galleries'
  ) THEN
    CREATE TABLE IF NOT EXISTS public.temporary_client_uploads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id uuid REFERENCES public.user_profiles(id),
      temporary_name text NOT NULL,
      temporary_identifier text,
      access_code text NOT NULL,
      photo_path text NOT NULL,
      file_name text NOT NULL,
      file_size bigint NOT NULL DEFAULT 0,
      mime_type text NOT NULL DEFAULT 'image/jpeg',
      width integer,
      height integer,
      upload_order integer NOT NULL DEFAULT 0,
      upload_timestamp timestamptz NOT NULL DEFAULT now(),
      sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
      synced_at timestamptz,
      client_id uuid REFERENCES public.clients(id),
      gallery_id uuid REFERENCES public.galleries(id),
      error_message text
    );

    CREATE INDEX IF NOT EXISTS temporary_client_uploads_access_code_idx ON public.temporary_client_uploads(access_code);
    CREATE INDEX IF NOT EXISTS temporary_client_uploads_admin_id_idx ON public.temporary_client_uploads(admin_id);
    CREATE INDEX IF NOT EXISTS temporary_client_uploads_status_idx ON public.temporary_client_uploads(sync_status);
    CREATE UNIQUE INDEX IF NOT EXISTS temporary_client_uploads_photo_path_idx ON public.temporary_client_uploads(photo_path);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'temporary_client_uploads'
  ) THEN
    ALTER TABLE public.temporary_client_uploads ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone can create temporary uploads" ON public.temporary_client_uploads;
    CREATE POLICY "Anyone can create temporary uploads"
      ON public.temporary_client_uploads FOR INSERT
      WITH CHECK (true);

    DROP POLICY IF EXISTS "Admins can view temporary uploads" ON public.temporary_client_uploads;
    CREATE POLICY "Admins can view temporary uploads"
      ON public.temporary_client_uploads FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
          AND up.role IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    DROP POLICY IF EXISTS "Allow audit log inserts" ON public.audit_logs;
    CREATE POLICY "Allow audit log inserts"
      ON public.audit_logs FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS "Allow temp uploads to storage" ON storage.objects;
    CREATE POLICY "Allow temp uploads to storage"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'client-photos'
        AND name LIKE 'temp/%'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'temporary_client_uploads'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.sync_temp_uploads_for_user(p_access_code text DEFAULT NULL)
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      SET row_security = off
      AS $func$
      DECLARE
        v_user_id uuid;
        v_profile record;
        v_group record;
        v_client_id uuid;
        v_gallery_id uuid;
        v_total_synced integer := 0;
        v_total_failed integer := 0;
      BEGIN
        v_user_id := auth.uid();
        IF v_user_id IS NULL THEN
          RETURN jsonb_build_object('synced', 0, 'failed', 0);
        END IF;

        SELECT name, phone, email INTO v_profile
        FROM public.user_profiles
        WHERE id = v_user_id;

        FOR v_group IN
          SELECT access_code, admin_id, max(temporary_name) AS temporary_name
          FROM public.temporary_client_uploads
          WHERE sync_status = 'pending'
            AND (
              (p_access_code IS NOT NULL AND access_code = upper(p_access_code))
              OR (
                p_access_code IS NULL
                AND (
                  temporary_identifier = v_profile.phone
                  OR temporary_identifier = v_profile.email
                )
              )
            )
          GROUP BY access_code, admin_id
        LOOP
          IF v_group.admin_id IS NULL THEN
            UPDATE public.temporary_client_uploads
            SET sync_status = 'failed',
                error_message = 'Missing admin_id'
            WHERE access_code = v_group.access_code
              AND sync_status = 'pending';
            v_total_failed := v_total_failed + 1;
            CONTINUE;
          END IF;

          SELECT id INTO v_client_id
          FROM public.clients
          WHERE owner_admin_id = v_group.admin_id
            AND user_id = v_user_id
          LIMIT 1;

          IF v_client_id IS NULL THEN
            INSERT INTO public.clients (
              owner_admin_id,
              user_id,
              name,
              phone,
              email
            ) VALUES (
              v_group.admin_id,
              v_user_id,
              COALESCE(v_profile.name, v_group.temporary_name, 'Client'),
              v_profile.phone,
              v_profile.email
            )
            RETURNING id INTO v_client_id;
          END IF;

          SELECT id INTO v_gallery_id
          FROM public.galleries
          WHERE access_code = v_group.access_code
          LIMIT 1;

          IF v_gallery_id IS NULL THEN
            INSERT INTO public.galleries (
              owner_admin_id,
              client_id,
              name,
              price,
              shoot_type,
              event_type,
              access_code,
              is_locked,
              is_paid,
              watermark_enabled,
              status
            ) VALUES (
              v_group.admin_id,
              v_client_id,
              COALESCE(v_group.temporary_name, 'Gallery'),
              0,
              'temp',
              'temp',
              v_group.access_code,
              true,
              false,
              true,
              'locked'
            )
            RETURNING id INTO v_gallery_id;
          END IF;

          INSERT INTO public.gallery_photos (
            gallery_id,
            photo_url,
            file_name,
            file_size,
            mime_type,
            width,
            height,
            is_watermarked,
            upload_order
          )
          SELECT
            v_gallery_id,
            t.photo_path,
            t.file_name,
            t.file_size,
            t.mime_type,
            t.width,
            t.height,
            false,
            t.upload_order
          FROM public.temporary_client_uploads t
          WHERE t.access_code = v_group.access_code
            AND t.sync_status = 'pending'
            AND NOT EXISTS (
              SELECT 1 FROM public.gallery_photos gp
              WHERE gp.gallery_id = v_gallery_id
                AND gp.photo_url = t.photo_path
            );

          UPDATE public.temporary_client_uploads
          SET sync_status = 'synced',
              synced_at = now(),
              client_id = v_client_id,
              gallery_id = v_gallery_id,
              error_message = NULL
          WHERE access_code = v_group.access_code
            AND sync_status = 'pending';

          INSERT INTO public.audit_logs (
            actor_id,
            action,
            entity_type,
            entity_id,
            metadata
          ) VALUES (
            v_group.admin_id,
            'temporary_upload_synced',
            'gallery',
            v_gallery_id,
            jsonb_build_object(
              'access_code', v_group.access_code,
              'client_id', v_client_id,
              'synced_by', v_user_id
            )
          );

          v_total_synced := v_total_synced + 1;
        END LOOP;

        RETURN jsonb_build_object('synced', v_total_synced, 'failed', v_total_failed);
      END;
      $func$;
    $sql$;
  END IF;
END $$;
