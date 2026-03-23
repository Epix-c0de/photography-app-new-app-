ALTER TABLE public.brand_settings
ADD COLUMN IF NOT EXISTS bts_share_link text,
ADD COLUMN IF NOT EXISTS announcement_share_link text,
ADD COLUMN IF NOT EXISTS gallery_share_link text,
ADD COLUMN IF NOT EXISTS referral_link text,
ADD COLUMN IF NOT EXISTS whatsapp_share_link text;

UPDATE public.brand_settings
SET
  bts_share_link = COALESCE(bts_share_link, share_app_link),
  announcement_share_link = COALESCE(announcement_share_link, share_app_link),
  gallery_share_link = COALESCE(gallery_share_link, share_app_link),
  referral_link = COALESCE(referral_link, share_app_link),
  whatsapp_share_link = COALESCE(whatsapp_share_link, share_app_link);
