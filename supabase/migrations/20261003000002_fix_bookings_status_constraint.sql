-- Fix bookings status check constraint to include all values the app uses
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('booked', 'confirmed', 'completed', 'editing', 'ready', 'cancelled'));
