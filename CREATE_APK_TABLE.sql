-- APK Versions table for tracking uploaded APKs
CREATE TABLE IF NOT EXISTS apk_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('admin', 'client')),
  version TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  changelog TEXT,
  is_latest BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Only one latest per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_apk_latest ON apk_versions(type) WHERE is_latest = true;

-- RLS policies
ALTER TABLE apk_versions ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins manage APKs" ON apk_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'super_admin'
    )
  );

-- Anyone can read latest versions (for download links)
CREATE POLICY "Public read latest APKs" ON apk_versions
  FOR SELECT
  USING (is_latest = true);
