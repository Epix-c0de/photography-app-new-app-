-- FIX SCRIPT: Sync auth.users with public.user_profiles and update triggers
-- Run this script in your Supabase SQL Editor to resolve the "account exists but not accessible" issue.
-- UPDATED: Now handles duplicate phone numbers by setting them to NULL to avoid unique constraint violations.

-- 1. Update the Trigger Function (Ensure it correctly handles metadata)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.user_profiles (id, email, role, name, phone, pin_hash, biometric_enabled)
  values (
    new.id, 
    new.email, 
    'client', -- Default role
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', 'New User'),
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    new.raw_user_meta_data->>'pin_hash',
    coalesce((new.raw_user_meta_data->>'biometric_enabled')::boolean, false)
  )
  on conflict (id) do nothing; -- Prevent errors if profile already exists
  return new;
end;
$$ language plpgsql security definer;

-- 2. Re-create the Trigger (Idempotent: Drop first to avoid "already exists" error)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Update the Profile Completeness Validator
create or replace function public.validate_profile_completeness() 
returns trigger as $$
begin
  -- Check if all mandatory fields are present
  if (new.name is not null and trim(new.name) <> '') and
     (new.phone is not null and trim(new.phone) <> '') and
     (new.email is not null and trim(new.email) <> '') and
     (new.pin_hash is not null and trim(new.pin_hash) <> '') then
    new.profile_complete := true;
  else
    new.profile_complete := false;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists validate_profile_completeness_trigger on public.user_profiles;
create trigger validate_profile_completeness_trigger
  before insert or update on public.user_profiles
  for each row execute procedure public.validate_profile_completeness();

-- 4. BACKFILL: Insert missing profiles for existing auth users
-- Uses a CTE to identify and deduplicate phone numbers to prevent "duplicate key value" errors.
WITH missing_profiles_raw AS (
    SELECT 
        au.id,
        au.email,
        COALESCE(au.raw_user_meta_data->>'display_name', au.raw_user_meta_data->>'name', 'New User') as name,
        COALESCE(au.phone, au.raw_user_meta_data->>'phone') as phone,
        au.raw_user_meta_data->>'pin_hash' as pin_hash,
        COALESCE((au.raw_user_meta_data->>'biometric_enabled')::boolean, false) as biometric_enabled,
        au.created_at
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON up.id = au.id
    WHERE up.id IS NULL
),
deduplicated_profiles AS (
    SELECT 
        *,
        -- Assign a row number to identify duplicate phones within the batch
        ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at DESC) as rn
    FROM missing_profiles_raw
)
INSERT INTO public.user_profiles (id, email, role, name, phone, pin_hash, biometric_enabled, created_at, updated_at)
SELECT 
    dp.id,
    dp.email,
    'client',
    dp.name,
    CASE 
        -- If phone is NULL, keep it NULL
        WHEN dp.phone IS NULL THEN NULL
        -- If duplicate in this batch (rn > 1), set to NULL
        WHEN dp.rn > 1 THEN NULL 
        -- If phone already exists in the MAIN table, set to NULL
        WHEN EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.phone = dp.phone) THEN NULL
        -- Otherwise, use the phone number
        ELSE dp.phone
    END,
    dp.pin_hash,
    dp.biometric_enabled,
    dp.created_at,
    now()
FROM deduplicated_profiles dp;

-- 5. RECALCULATE: Update profile_complete status for ALL profiles
UPDATE public.user_profiles
SET profile_complete = (
    (name IS NOT NULL AND trim(name) <> '') AND
    (phone IS NOT NULL AND trim(phone) <> '') AND
    (email IS NOT NULL AND trim(email) <> '') AND
    (pin_hash IS NOT NULL AND trim(pin_hash) <> '')
);

-- 6. VERIFY: Output the count of fixed profiles (Optional)
-- select count(*) as total_profiles from public.user_profiles;
