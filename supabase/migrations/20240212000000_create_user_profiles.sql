create extension if not exists "uuid-ossp";

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'client')),
  name text,
  phone text unique,
  email text,
  avatar_url text,
  pin_hash text,
  biometric_enabled boolean default false,
  phone_verified boolean not null default false,
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "Admins can view all profiles" on public.user_profiles;
create policy "Admins can view all profiles"
  on public.user_profiles for select
  using (
    coalesce(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role'
    ) in ('admin', 'super_admin')
  );

drop policy if exists "Users can view own profile" on public.user_profiles;
create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, role, name, phone, pin_hash, biometric_enabled)
  values (
    new.id,
    new.email,
    'client',
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', 'New User'),
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    new.raw_user_meta_data->>'pin_hash',
    coalesce((new.raw_user_meta_data->>'biometric_enabled')::boolean, false)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.validate_profile_completeness()
returns trigger as $$
begin
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
