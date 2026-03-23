-- Migration: Add Deep Link Configuration to Brand Settings
-- Date: 2026-03-14

-- Add columns for custom app links
ALTER TABLE public.brand_settings 
ADD COLUMN IF NOT EXISTS share_app_link text DEFAULT 'https://rork.app',
ADD COLUMN IF NOT EXISTS access_code_link text DEFAULT 'epix-visuals://gallery?autoUnlock=true&accessCode=';

-- Update previous rows with defaults
UPDATE public.brand_settings SET share_app_link = 'https://rork.app' WHERE share_app_link IS NULL;
UPDATE public.brand_settings SET access_code_link = 'epix-visuals://gallery?autoUnlock=true&accessCode=' WHERE access_code_link IS NULL;
