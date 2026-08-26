-- app_versions: stores version metadata for the in-app update system.
-- The check-version Edge Function reads from this table.
-- When a super admin uploads an APK, a row is inserted/updated here.

CREATE TABLE IF NOT EXISTS public.app_versions (
  id text PRIMARY KEY DEFAULT 'current',
  latest_version text NOT NULL,
  minimum_version text NOT NULL DEFAULT '1.0.0',
  force_update boolean NOT NULL DEFAULT false,
  release_notes text NOT NULL DEFAULT '',
  download_url text NOT NULL DEFAULT '',
  file_size text DEFAULT '',
  sha256 text DEFAULT '',
  provider text NOT NULL DEFAULT 'apk-direct',
  published_at timestamptz NOT NULL DEFAULT now(),
  version_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one row should be "active" at a time. We enforce this via application
-- logic (upsert into a single row with id = 'current').
INSERT INTO public.app_versions (id, latest_version, minimum_version, force_update, release_notes, download_url, file_size, provider)
VALUES ('current', '1.0.0', '1.0.0', false, 'Welcome to Epix Visuals Studios.co!', 'https://epix-visuals.vercel.app/download', '~25 MB', 'apk-direct')
ON CONFLICT (id) DO NOTHING;

-- RLS: only super admins can read/write
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage app_versions"
  ON public.app_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Allow the Edge Function (service role) to read
CREATE POLICY "Service role can read app_versions"
  ON public.app_versions
  FOR SELECT
  USING (true);
