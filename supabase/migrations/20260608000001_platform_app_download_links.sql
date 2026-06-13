-- ============================================
-- Add separate admin app and user app download
-- link keys to platform_settings.
-- Old keys (platform_app_android_link / ios) are
-- re-purposed as the USER (client) app links.
-- New keys are added for the ADMIN (photographer) app.
-- ============================================

INSERT INTO platform_settings (key, value) VALUES
  ('platform_admin_app_android_link', ''),
  ('platform_admin_app_ios_link',     ''),
  ('platform_deep_link_scheme',       'epixvisuals')
ON CONFLICT (key) DO NOTHING;
