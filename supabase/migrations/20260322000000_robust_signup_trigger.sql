-- Robust signup trigger with phone deduplication
-- Replaces earlier handle_new_user versions with a safer implementation

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_phone text;
  phone_exists boolean;
  existing_client_id uuid;
BEGIN
  -- Get the phone number from metadata or auth record
  new_phone := coalesce(new.phone, new.raw_user_meta_data->>'phone');

  -- Check if this phone number is already in use by ANOTHER profile
  IF new_phone IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.user_profiles WHERE phone = new_phone
    ) INTO phone_exists;

    IF phone_exists THEN
      new_phone := NULL; -- Clear to avoid unique constraint violation
    ELSE
      -- Auto-link to existing client record if phone matches
      SELECT id INTO existing_client_id
      FROM public.clients WHERE phone = new_phone LIMIT 1;

      IF existing_client_id IS NOT NULL THEN
        UPDATE public.clients
        SET user_id = new.id
        WHERE id = existing_client_id AND user_id IS NULL;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.user_profiles (id, email, role, name, phone, pin_hash, biometric_enabled)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'client'),
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', 'New User'),
    new_phone,
    new.raw_user_meta_data->>'pin_hash',
    COALESCE((new.raw_user_meta_data->>'biometric_enabled')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup even if profile creation fails
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
