-- Migration: Add detailed M-Pesa credentials to payment_config
-- and default photo price

ALTER TABLE public.payment_config 
ADD COLUMN IF NOT EXISTS mpesa_consumer_key text,
ADD COLUMN IF NOT EXISTS mpesa_consumer_secret text,
ADD COLUMN IF NOT EXISTS mpesa_passkey text,
ADD COLUMN IF NOT EXISTS mpesa_environment text DEFAULT 'sandbox' CHECK (mpesa_environment IN ('sandbox', 'live')),
ADD COLUMN IF NOT EXISTS default_photo_price numeric DEFAULT 0;

-- Comment out if not needed, but good for tracking
COMMENT ON COLUMN public.payment_config.mpesa_consumer_key IS 'M-Pesa Daraja API Consumer Key';
COMMENT ON COLUMN public.payment_config.mpesa_consumer_secret IS 'M-Pesa Daraja API Consumer Secret';
COMMENT ON COLUMN public.payment_config.mpesa_passkey IS 'M-Pesa Daraja API Online Passkey';
COMMENT ON COLUMN public.payment_config.mpesa_environment IS 'Sandbox or Live environment';
