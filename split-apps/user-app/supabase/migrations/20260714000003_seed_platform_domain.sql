-- Seed platform_domain key in platform_settings
-- This key is queried by getPlatformDomain() in platform-config.ts
-- All share links (announcements, galleries, BTS, referrals) depend on this

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES ('platform_domain', 'https://epixvisuals.co.ke', NOW())
ON CONFLICT (key) DO NOTHING;

-- Also seed any other commonly queried keys that may be missing
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES
  ('platform_admin_app_android_link', '', NOW()),
  ('platform_admin_app_ios_link', '', NOW()),
  ('platform_app_android_link', '', NOW()),
  ('platform_app_ios_link', '', NOW()),
  ('platform_photographer_signup_url', 'https://join.epixvisuals.co', NOW()),
  ('platform_deep_link_scheme', 'epixvisuals', NOW())
ON CONFLICT (key) DO NOTHING;
