-- Create apk_versions table
CREATE TABLE IF NOT EXISTS apk_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('admin', 'client')),
  version TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  chunk_count INTEGER DEFAULT 1,
  changelog TEXT,
  is_latest BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add chunk_count if table already exists without it
DO $$ BEGIN
  ALTER TABLE apk_versions ADD COLUMN chunk_count INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_apk_versions_type_latest ON apk_versions(type, is_latest);

ALTER TABLE apk_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage apk_versions"
  ON apk_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Authenticated users can read apk_versions"
  ON apk_versions FOR SELECT
  TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('apk-files', 'apk-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Super admins can upload APKs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'apk-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update APKs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'apk-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete APKs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'apk-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Authenticated users can read APKs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'apk-files');
