-- From: split-apps/admin-app/supabase/migrations/20260815000001_add_social_contact_to_branding.sql
ALTER TABLE public.brand_settings
ADD COLUMN IF NOT EXISTS social_instagram text,
ADD COLUMN IF NOT EXISTS social_facebook text,
ADD COLUMN IF NOT EXISTS social_twitter text,
ADD COLUMN IF NOT EXISTS social_tiktok text,
ADD COLUMN IF NOT EXISTS social_youtube text,
ADD COLUMN IF NOT EXISTS social_website text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS contact_whatsapp text,
ADD COLUMN IF NOT EXISTS contact_address text,
ADD COLUMN IF NOT EXISTS contact_city text,
ADD COLUMN IF NOT EXISTS contact_country text;
