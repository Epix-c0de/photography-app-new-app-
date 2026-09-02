-- Fix bookings RLS: make SELECT more permissive for authenticated users
DROP POLICY IF EXISTS "Clients can view their own bookings" ON public.bookings;
CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow admins to also see bookings they own
DROP POLICY IF EXISTS "Admins can update any booking" ON public.bookings;
CREATE POLICY "Admins can manage bookings"
  ON public.bookings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- Add index for faster user_id lookups
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);

-- Ensure packages RLS doesn't block joins from bookings
DROP POLICY IF EXISTS "Clients can view active packages" ON public.packages;
CREATE POLICY "Authenticated users can view packages"
  ON public.packages FOR SELECT
  TO authenticated
  USING (is_active = true);
