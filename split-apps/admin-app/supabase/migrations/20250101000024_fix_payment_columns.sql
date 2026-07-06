-- Add missing columns to simple_payment_settings
ALTER TABLE simple_payment_settings ADD COLUMN IF NOT EXISTS auto_verification BOOLEAN DEFAULT false;
ALTER TABLE simple_payment_settings ADD COLUMN IF NOT EXISTS default_price NUMERIC DEFAULT 0;
ALTER TABLE simple_payment_settings ADD COLUMN IF NOT EXISTS till_number TEXT;
ALTER TABLE simple_payment_settings ADD COLUMN IF NOT EXISTS paybill_number TEXT;
ALTER TABLE simple_payment_settings ADD COLUMN IF NOT EXISTS business_shortcode TEXT;
