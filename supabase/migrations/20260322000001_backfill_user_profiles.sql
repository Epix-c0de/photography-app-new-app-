-- Backfill: ensure every auth.users row has a user_profiles row
-- Handles duplicate phone numbers gracefully by nulling them out

INSERT INTO public.user_profiles (id, email, role, name, phone, pin_hash, biometric_enabled, created_at, updated_at)
SELECT
  au.id,
  au.email,
  'client',
  COALESCE(au.raw_user_meta_data->>'display_name', au.raw_user_meta_data->>'name', 'New User'),
  CASE
    WHEN COALESCE(au.phone, au.raw_user_meta_data->>'phone') IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.user_profiles up2
      WHERE up2.phone = COALESCE(au.phone, au.raw_user_meta_data->>'phone')
    ) THEN NULL
    ELSE COALESCE(au.phone, au.raw_user_meta_data->>'phone')
  END,
  au.raw_user_meta_data->>'pin_hash',
  COALESCE((au.raw_user_meta_data->>'biometric_enabled')::boolean, false),
  au.created_at,
  now()
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- Recalculate profile_complete for all profiles
UPDATE public.user_profiles
SET profile_complete = (
  (name IS NOT NULL AND trim(name) <> '') AND
  (phone IS NOT NULL AND trim(phone) <> '') AND
  (email IS NOT NULL AND trim(email) <> '') AND
  (pin_hash IS NOT NULL AND trim(pin_hash) <> '')
);
