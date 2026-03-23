-- FIX FOR PHOTO UPLOAD PIPELINE
-- Aligning schema with Edge Function expectations

-- 1. Expand galleries.status check constraint
-- Original check was: check (status in ('locked', 'unlocked', 'archived'))
ALTER TABLE public.galleries DROP CONSTRAINT IF EXISTS galleries_status_check;
ALTER TABLE public.galleries ADD CONSTRAINT galleries_status_check 
  CHECK (status IN ('locked', 'unlocked', 'archived', 'pending_upload', 'active', 'uploading'));

-- 2. Add missing columns to galleries
ALTER TABLE public.galleries 
  ADD COLUMN IF NOT EXISTS photo_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_by uuid REFERENCES public.user_profiles(id);

-- 3. Fix upload_sessions table columns
ALTER TABLE public.upload_sessions
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 4. Fix gallery_photos table columns to match Edge Function expectations
-- Edge Function expects: id, gallery_id, file_name, storage_path, file_size, mime_type, checksum, uploaded_by, upload_session_id
ALTER TABLE public.gallery_photos
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS checksum text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS upload_session_id uuid REFERENCES public.upload_sessions(id);

-- Link existing photo_url to storage_path for compatibility
UPDATE public.gallery_photos 
SET storage_path = photo_url 
WHERE storage_path IS NULL;

-- 5. Fix permissions for Edge Functions to insert logs
ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage all logs" ON public.upload_logs;
CREATE POLICY "Service role can manage all logs" ON public.upload_logs
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Add session_id to upload_logs if missing
ALTER TABLE public.upload_logs
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.upload_sessions(id),
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS checksum text;
