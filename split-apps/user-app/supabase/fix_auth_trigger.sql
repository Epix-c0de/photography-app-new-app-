-- 1. Update handle_new_user function to be more robust
-- It will now check if a profile already exists before inserting
-- And handle potential phone number collisions by making it null if it already exists in another profile
create or replace function public.handle_new_user()
returns trigger as $$
declare
  existing_phone_user_id uuid;
begin
  -- Check if phone number already exists in another profile
  if new.raw_user_meta_data->>'phone' is not null then
    select id into existing_phone_user_id 
    from public.user_profiles 
    where phone = new.raw_user_meta_data->>'phone'
    limit 1;
  end if;

  -- Insert or update user profile
  insert into public.user_profiles (
    id, 
    email, 
    role, 
    name, 
    phone, 
    pin_hash, 
    biometric_enabled
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', 'New User'),
    case when existing_phone_user_id is null then coalesce(new.phone, new.raw_user_meta_data->>'phone') else null end,
    new.raw_user_meta_data->>'pin_hash',
    coalesce((new.raw_user_meta_data->>'biometric_enabled')::boolean, false)
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(excluded.name, user_profiles.name),
    phone = coalesce(excluded.phone, user_profiles.phone),
    pin_hash = coalesce(excluded.pin_hash, user_profiles.pin_hash),
    biometric_enabled = coalesce(excluded.biometric_enabled, user_profiles.biometric_enabled);
    
  return new;
exception when others then
  -- Ensure signup doesn't fail even if profile creation fails
  -- The app can prompt the user to complete their profile later
  return new;
end;
$$ language plpgsql security definer;

-- 2. Ensure RLS allows the trigger (security definer handles this, but good to check)
-- Make sure the service_role can do anything
-- The handle_new_user function already uses security definer.

-- 3. Add a check to ensure user_profiles exists for all users
-- Run this if you have existing users without profiles
insert into public.user_profiles (id, email, role)
select id, email, 'client'
from auth.users
where id not in (select id from public.user_profiles)
on conflict (id) do nothing;
