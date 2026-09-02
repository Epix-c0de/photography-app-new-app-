-- Add missing columns that the user app tries to insert
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_phone TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2) DEFAULT 0;
