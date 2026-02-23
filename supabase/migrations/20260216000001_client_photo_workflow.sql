-- =============================================
-- CLIENT PHOTO UPLOAD + SMS + ACCESS CODE WORKFLOW
-- Enhanced schema for comprehensive photo management
-- =============================================

-- 1. ENHANCE EXISTING GALLERIES TABLE
DO $$
BEGIN
  -- Add gallery_title column if not exists (for backward compatibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'galleries' AND column_name = 'gallery_title'
  ) THEN
    ALTER TABLE public.galleries ADD COLUMN gallery_title text;
    -- Copy existing name to gallery_title for existing records
    UPDATE public.galleries SET gallery_title = name;
  END IF;

  -- Ensure access_code has proper constraints
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'public' AND table_name = 'galleries' AND constraint_name = 'galleries_access_code_key'
  ) THEN
    ALTER TABLE public.galleries ADD CONSTRAINT galleries_access_code_key UNIQUE (access_code);
  END IF;

  -- Add watermark_applied column for paid/unpaid status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'galleries' AND column_name = 'watermark_applied'
  ) THEN
    ALTER TABLE public.galleries ADD COLUMN watermark_applied boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. CREATE GALLERY PHOTOS TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'gallery_photos'
  ) THEN
    CREATE TABLE public.gallery_photos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      gallery_id uuid NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
      photo_url text NOT NULL,
      file_name text NOT NULL,
      file_size bigint NOT NULL,
      mime_type text NOT NULL,
      width integer,
      height integer,
      is_watermarked boolean NOT NULL DEFAULT false,
      upload_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    -- Create index for faster gallery queries
    CREATE INDEX gallery_photos_gallery_id_idx ON public.gallery_photos(gallery_id);
    CREATE INDEX gallery_photos_upload_order_idx ON public.gallery_photos(upload_order);
  END IF;
END $$;

-- 3. ENHANCE NOTIFICATIONS TABLE FOR PHOTO WORKFLOW
DO $$
BEGIN
  -- Add access_code column for photo notifications
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'access_code'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN access_code text;
  END IF;

  -- Add gallery_id column for direct gallery linking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'gallery_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN gallery_id uuid REFERENCES public.galleries(id);
  END IF;

  -- Add sent_status for delivery tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'sent_status'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN sent_status text NOT NULL DEFAULT 'pending';
  END IF;

  -- Add client_id for client-specific notifications
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN client_id uuid REFERENCES public.clients(id);
  END IF;
END $$;

-- 4. ENHANCE SMS_LOGS TABLE FOR PHOTO NOTIFICATIONS
DO $$
BEGIN
  -- Add gallery_id column for SMS tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sms_logs' AND column_name = 'gallery_id'
  ) THEN
    ALTER TABLE public.sms_logs ADD COLUMN gallery_id uuid REFERENCES public.galleries(id);
  END IF;

  -- Add access_code column for SMS tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sms_logs' AND column_name = 'access_code'
  ) THEN
    ALTER TABLE public.sms_logs ADD COLUMN access_code text;
  END IF;

  -- Add notification_type for different SMS purposes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sms_logs' AND column_name = 'notification_type'
  ) THEN
    ALTER TABLE public.sms_logs ADD COLUMN notification_type text NOT NULL DEFAULT 'photo_gallery';
  END IF;
END $$;

-- 5. CREATE ACCESS CODE VALIDATION FUNCTION
CREATE OR REPLACE FUNCTION public.validate_access_code(
  p_access_code text,
  p_phone_number text DEFAULT NULL
)
RETURNS TABLE (
  gallery_id uuid,
  gallery_title text,
  client_name text,
  client_phone text,
  is_paid boolean,
  is_valid boolean,
  validation_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id as gallery_id,
    COALESCE(g.gallery_title, g.name) as gallery_title,
    c.name as client_name,
    c.phone as client_phone,
    g.is_paid as is_paid,
    true as is_valid,
    'Access code validated successfully' as validation_message
  FROM public.galleries g
  JOIN public.clients c ON g.client_id = c.id
  WHERE g.access_code = p_access_code
    AND (p_phone_number IS NULL OR c.phone = p_phone_number)
  LIMIT 1;

  -- If no results found, return invalid result
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::uuid, 
      NULL::text, 
      NULL::text, 
      NULL::text, 
      false::boolean, 
      false::boolean, 
      'Invalid access code or phone number mismatch'::text;
  END IF;
END;
$$;

-- 6. CREATE FUNCTION TO GENERATE ACCESS CODES
CREATE OR REPLACE FUNCTION public.generate_access_code(
  p_prefix text DEFAULT 'WED'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_counter integer := 0;
  v_max_attempts integer := 10;
BEGIN
  -- Generate unique access code
  WHILE v_counter < v_max_attempts LOOP
    v_code := p_prefix || '-' || LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');
    
    -- Check if code already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.galleries WHERE access_code = v_code
    ) THEN
      RETURN v_code;
    END IF;
    
    v_counter := v_counter + 1;
  END LOOP;
  
  -- If we can't find a unique code after max attempts, raise exception
  RAISE EXCEPTION 'Could not generate unique access code after % attempts', v_max_attempts;
END;
$$;

-- 7. CREATE FUNCTION TO SEND PHOTO NOTIFICATION
CREATE OR REPLACE FUNCTION public.send_photo_notification(
  p_gallery_id uuid,
  p_client_id uuid,
  p_notification_title text,
  p_notification_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id uuid;
  v_access_code text;
  v_client_phone text;
  v_client_name text;
  v_gallery_title text;
BEGIN
  -- Get gallery and client info
  SELECT g.access_code, c.phone, c.name, COALESCE(g.gallery_title, g.name)
  INTO v_access_code, v_client_phone, v_client_name, v_gallery_title
  FROM public.galleries g
  JOIN public.clients c ON g.client_id = c.id
  WHERE g.id = p_gallery_id AND c.id = p_client_id;

  -- Create notification record
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    access_code,
    gallery_id,
    client_id,
    data,
    sent_status
  ) VALUES (
    (SELECT user_id FROM public.clients WHERE id = p_client_id),
    'photo_gallery_ready',
    p_notification_title,
    p_notification_body,
    v_access_code,
    p_gallery_id,
    p_client_id,
    jsonb_build_object(
      'galleryId', p_gallery_id,
      'accessCode', v_access_code,
      'clientName', v_client_name,
      'galleryTitle', v_gallery_title
    ),
    'sent'
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- 8. ENABLE RLS AND CREATE POLICIES FOR GALLERY_PHOTOS
DO $$
BEGIN
  -- Enable RLS
  ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;
  
  -- Drop existing policy if it exists to avoid conflicts
  DROP POLICY IF EXISTS "Admins can manage gallery photos" ON public.gallery_photos;
  
  CREATE POLICY "Admins can manage gallery photos"
    ON public.gallery_photos FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.galleries g
        WHERE g.id = gallery_photos.gallery_id
        AND (
          g.owner_admin_id = auth.uid()
          OR 
          coalesce(
            auth.jwt() -> 'app_metadata' ->> 'role',
            auth.jwt() -> 'user_metadata' ->> 'role'
          ) in ('admin', 'super_admin')
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.galleries g
        WHERE g.id = gallery_photos.gallery_id
        AND (
          g.owner_admin_id = auth.uid()
          OR 
          coalesce(
            auth.jwt() -> 'app_metadata' ->> 'role',
            auth.jwt() -> 'user_metadata' ->> 'role'
          ) in ('admin', 'super_admin')
        )
      )
    );
    
  -- Allow clients to view their photos (read-only access)
  DROP POLICY IF EXISTS "Clients can view their photos" ON public.gallery_photos;
  
  CREATE POLICY "Clients can view their photos"
    ON public.gallery_photos FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.galleries g
        JOIN public.clients c ON g.client_id = c.id
        WHERE g.id = gallery_photos.gallery_id
        AND c.user_id = auth.uid()
      )
    );
END $$;

-- 9. CREATE STORAGE BUCKET FOR CLIENT PHOTOS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-photos',
  'client-photos',
  false,
  104857600, -- 100MB limit
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 10. STORAGE POLICIES FOR CLIENT PHOTOS
DO $$
BEGIN
  -- Admin can upload to client-photos bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
    AND policyname = 'Admins can upload client photos'
  ) THEN
    CREATE POLICY "Admins can upload client photos"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'client-photos'
        AND (storage.foldername(name))[1] = 'clients'
        AND coalesce(
          auth.jwt() -> 'app_metadata' ->> 'role',
          auth.jwt() -> 'user_metadata' ->> 'role'
        ) in ('admin', 'super_admin')
      );
  END IF;

  -- Clients can view their own photos (watermarked version always, clean version only if paid)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
    AND policyname = 'Clients can view their photos'
  ) THEN
    CREATE POLICY "Clients can view their photos"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'client-photos'
        AND EXISTS (
          SELECT 1 FROM public.gallery_photos gp
          JOIN public.galleries g ON gp.gallery_id = g.id
          JOIN public.clients c ON g.client_id = c.id
          WHERE gp.photo_url LIKE '%' || storage.objects.name
          AND c.user_id = auth.uid()
          -- Allow viewing watermarked photos regardless of payment status
          AND (
            (storage.objects.name LIKE '%watermarked%' OR storage.objects.name LIKE '%wm%') 
            OR 
            (g.is_paid = true AND NOT (storage.objects.name LIKE '%watermarked%' OR storage.objects.name LIKE '%wm%'))
          )
        )
      );
  END IF;
END $$;

-- 11. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS galleries_client_id_idx ON public.galleries(client_id);
CREATE INDEX IF NOT EXISTS galleries_access_code_idx ON public.galleries(access_code);
CREATE INDEX IF NOT EXISTS notifications_gallery_id_idx ON public.notifications(gallery_id);
CREATE INDEX IF NOT EXISTS notifications_access_code_idx ON public.notifications(access_code);
CREATE INDEX IF NOT EXISTS sms_logs_gallery_id_idx ON public.sms_logs(gallery_id);
CREATE INDEX IF NOT EXISTS sms_logs_access_code_idx ON public.sms_logs(access_code);

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
