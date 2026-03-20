-- Allow authenticated users (clients) to view admin profiles so they can chat with them
-- This fixes the "No admin found" error on the client side chat screen

DROP POLICY IF EXISTS "Anyone can view admin profiles" ON public.user_profiles;

CREATE POLICY "Anyone can view admin profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    role IN ('admin', 'super_admin')
  );
