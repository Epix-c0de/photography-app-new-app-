
-- Update handle_new_user to use role from metadata if provided
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, role, name, phone, pin_hash, biometric_enabled)
  values (
    new.id,
    new.email,
    -- Default to client, but allow admin if metadata specifies
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', 'New User'),
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    new.raw_user_meta_data->>'pin_hash',
    coalesce((new.raw_user_meta_data->>'biometric_enabled')::boolean, false)
  );
  return new;
end;
$$ language plpgsql security definer;
