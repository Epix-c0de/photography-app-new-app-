create table if not exists public.galleries (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  client_id uuid not null references public.clients(id),
  name text not null,
  gallery_title text,
  cover_photo_url text,
  access_code text unique not null,
  is_paid boolean not null default false,
  is_locked boolean not null default true,
  price numeric not null default 0,
  shoot_type text,
  event_type text,
  scheduled_release timestamptz,
  watermark_enabled boolean not null default true,
  status text not null default 'locked' check (status in ('locked', 'unlocked', 'archived')),
  watermark_applied boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.galleries enable row level security;

drop policy if exists "Admins can manage their own galleries" on public.galleries;
create policy "Admins can manage their own galleries"
  on public.galleries for all
  using (auth.uid() = owner_admin_id);

drop policy if exists "Clients can view their galleries" on public.galleries;
create policy "Clients can view their galleries"
  on public.galleries for select
  using (
    exists (
      select 1 from public.clients
      where public.clients.id = public.galleries.client_id
      and public.clients.user_id = auth.uid()
    )
  );
