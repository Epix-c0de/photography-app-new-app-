-- Add unlocked galleries tracking for client access rules
-- Migration: 20260217000006_unlocked_galleries.sql

-- Table to track which galleries a user has unlocked
create table if not exists public.unlocked_galleries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id),
  gallery_id uuid not null references public.galleries(id),
  unlocked_at timestamptz not null default now(),
  unique(user_id, gallery_id)
);

alter table public.unlocked_galleries enable row level security;

-- Users can view their own unlocked galleries
drop policy if exists "Users can view their unlocked galleries" on public.unlocked_galleries;
create policy "Users can view their unlocked galleries"
  on public.unlocked_galleries for select
  using (auth.uid() = user_id);

-- Users can insert their own unlocked galleries
drop policy if exists "Users can unlock galleries" on public.unlocked_galleries;
create policy "Users can unlock galleries"
  on public.unlocked_galleries for insert
  with check (auth.uid() = user_id);

-- Function to unlock a gallery for a user
create or replace function public.unlock_gallery_for_user(
  p_gallery_id uuid
)
returns boolean as $$
declare
  v_user_id uuid;
begin
  -- Get current user
  select auth.uid() into v_user_id;
  if v_user_id is null then
    return false;
  end if;

  -- Insert unlocked record (will be ignored if already exists due to unique constraint)
  insert into public.unlocked_galleries (user_id, gallery_id)
  values (v_user_id, p_gallery_id)
  on conflict (user_id, gallery_id) do nothing;

  return true;
end;
$$ language plpgsql security definer;
