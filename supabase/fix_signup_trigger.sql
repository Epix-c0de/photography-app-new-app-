-- FIX: Robust Signup Trigger
-- This script updates the handle_new_user trigger to gracefully handle duplicate phone numbers
-- by setting the phone field to NULL instead of failing the transaction.

create or replace function public.handle_new_user() 
returns trigger as $$
declare
  new_phone text;
  phone_exists boolean;
begin
  -- Get the phone number from metadata or auth record
  new_phone := coalesce(new.phone, new.raw_user_meta_data->>'phone');
  
  -- Check if this phone number is already in use by ANOTHER profile
  -- We don't care if it's null
  if new_phone is not null then
    select exists(select 1 from public.user_profiles where phone = new_phone) into phone_exists;
    if phone_exists then
      new_phone := null; -- Clear it to avoid unique constraint violation
    end if;
  end if;

  insert into public.user_profiles (id, email, role, name, phone, pin_hash, biometric_enabled)
  values (
    new.id, 
    new.email, 
    'client', -- Default role
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', 'New User'),
    new_phone, -- Use the checked phone number
    new.raw_user_meta_data->>'pin_hash',
    coalesce((new.raw_user_meta_data->>'biometric_enabled')::boolean, false)
  )
  on conflict (id) do nothing; -- Prevent errors if profile already exists
  
  return new;
end;
$$ language plpgsql security definer;

-- Re-apply the trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
