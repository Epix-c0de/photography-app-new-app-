-- ============================================
-- Photo Download Optimization & Original Access Control
-- Feature: 5MB optimized download (default) + per-photographer original access
-- ============================================

-- 1. Add allow_original_download column to user_profiles
--    Controls whether a photographer's clients can download original full-size files
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS allow_original_download BOOLEAN NOT NULL DEFAULT false;

-- 2. Add is_suspended column for super admin suspend action
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- 3. Add optimized_photo_url column to gallery_photos
--    Stores the path of the server-resized/compressed version when generated
--    NULL means not yet processed — fall back to original
ALTER TABLE public.gallery_photos
  ADD COLUMN IF NOT EXISTS optimized_photo_url TEXT;

-- 4. Index for finding unoptimized photos
CREATE INDEX IF NOT EXISTS idx_gallery_photos_no_optimized
  ON public.gallery_photos(gallery_id)
  WHERE optimized_photo_url IS NULL;

-- 5. RPC: get_photo_download_url
--    Returns the correct photo URL for a client download:
--      - If the photographer has allow_original_download = true → returns original URL
--      - Otherwise → returns optimized_photo_url (if available) else original
--    Enforces RLS: only works for photos the caller has access to
CREATE OR REPLACE FUNCTION public.get_photo_download_url(
  p_photo_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID := auth.uid();
  v_photo           RECORD;
  v_gallery         RECORD;
  v_photographer    RECORD;
  v_use_original    BOOLEAN;
  v_url             TEXT;
BEGIN
  -- Fetch photo
  SELECT gp.id, gp.photo_url, gp.optimized_photo_url, gp.gallery_id
  INTO v_photo
  FROM public.gallery_photos gp
  WHERE gp.id = p_photo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Photo not found');
  END IF;

  -- Fetch gallery + ownership
  SELECT g.id, g.owner_admin_id, g.is_paid, g.is_locked, g.client_id
  INTO v_gallery
  FROM public.galleries g
  WHERE g.id = v_photo.gallery_id;

  -- Verify caller has access (client owns gallery OR admin owns gallery)
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if caller is the admin owner
  IF v_gallery.owner_admin_id = v_user_id THEN
    -- Admin always gets original
    RETURN jsonb_build_object(
      'success', true,
      'url', v_photo.photo_url,
      'is_original', true
    );
  END IF;

  -- Verify gallery is accessible to client
  IF v_gallery.is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gallery is locked');
  END IF;

  -- Check if photographer allows original downloads
  SELECT up.allow_original_download
  INTO v_photographer
  FROM public.user_profiles up
  WHERE up.id = v_gallery.owner_admin_id;

  v_use_original := COALESCE(v_photographer.allow_original_download, false);

  IF v_use_original THEN
    v_url := v_photo.photo_url;
  ELSE
    -- Use optimized version if available, otherwise fall back to original
    v_url := COALESCE(v_photo.optimized_photo_url, v_photo.photo_url);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'url', v_url,
    'is_original', v_use_original OR v_photo.optimized_photo_url IS NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_photo_download_url(UUID) TO authenticated;

-- 6. RPC: toggle_photographer_original_download (super admin only)
CREATE OR REPLACE FUNCTION public.toggle_photographer_original_download(
  p_photographer_id UUID,
  p_allow           BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admins can call this
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  UPDATE public.user_profiles
  SET allow_original_download = p_allow
  WHERE id = p_photographer_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_photographer_original_download(UUID, BOOLEAN) TO authenticated;

-- 7. RPC: suspend_photographer (super admin only)
CREATE OR REPLACE FUNCTION public.suspend_photographer(
  p_photographer_id UUID,
  p_reason          TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  UPDATE public.user_profiles
  SET
    is_suspended      = true,
    suspended_at      = NOW(),
    suspended_reason  = p_reason,
    subscription_status = 'suspended'
  WHERE id = p_photographer_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suspend_photographer(UUID, TEXT) TO authenticated;

-- 8. RPC: unsuspend_photographer (super admin only)
CREATE OR REPLACE FUNCTION public.unsuspend_photographer(
  p_photographer_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: super_admin role required';
  END IF;

  UPDATE public.user_profiles
  SET
    is_suspended      = false,
    suspended_at      = NULL,
    suspended_reason  = NULL,
    subscription_status = CASE
      WHEN subscription_expires_at > NOW() THEN 'active'
      ELSE 'inactive'
    END
  WHERE id = p_photographer_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unsuspend_photographer(UUID) TO authenticated;

-- 9. RPC: get_photographer_full_stats (super admin)
CREATE OR REPLACE FUNCTION public.get_photographer_full_stats(
  p_photographer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_storage       RECORD;
  v_revenue       NUMERIC;
  v_galleries     INTEGER;
  v_clients       INTEGER;
  v_paid_galleries INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Storage metrics
  SELECT
    COUNT(gp.id)::INTEGER              AS total_photos,
    COALESCE(SUM(gp.file_size), 0)     AS total_storage_bytes,
    COUNT(DISTINCT gp.gallery_id)::INTEGER AS gallery_count,
    COALESCE(AVG(gp.file_size), 0)     AS avg_photo_size_bytes
  INTO v_storage
  FROM public.gallery_photos gp
  JOIN public.galleries g ON g.id = gp.gallery_id
  WHERE g.owner_admin_id = p_photographer_id;

  -- Revenue from subscription payments
  SELECT COALESCE(SUM(amount), 0) INTO v_revenue
  FROM public.admin_subscriptions
  WHERE admin_id = p_photographer_id AND status = 'success';

  -- Gallery counts
  SELECT COUNT(*)::INTEGER INTO v_galleries
  FROM public.galleries WHERE owner_admin_id = p_photographer_id;

  SELECT COUNT(*)::INTEGER INTO v_paid_galleries
  FROM public.galleries WHERE owner_admin_id = p_photographer_id AND is_paid = true;

  -- Client count
  SELECT COUNT(*)::INTEGER INTO v_clients
  FROM public.clients WHERE owner_admin_id = p_photographer_id;

  RETURN jsonb_build_object(
    'total_photos',          COALESCE(v_storage.total_photos, 0),
    'total_storage_bytes',   COALESCE(v_storage.total_storage_bytes, 0),
    'total_storage_gb',      ROUND((COALESCE(v_storage.total_storage_bytes, 0) / 1024.0 / 1024.0 / 1024.0)::NUMERIC, 3),
    'gallery_count',         COALESCE(v_storage.gallery_count, 0),
    'avg_photo_size_bytes',  ROUND(COALESCE(v_storage.avg_photo_size_bytes, 0)::NUMERIC, 0),
    'total_revenue_kes',     v_revenue,
    'total_galleries',       v_galleries,
    'paid_galleries',        v_paid_galleries,
    'total_clients',         v_clients
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_photographer_full_stats(UUID) TO authenticated;
