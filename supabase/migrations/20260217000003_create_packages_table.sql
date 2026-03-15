-- Create packages table
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  name text not null,
  price numeric not null default 0,
  sms_included int not null default 0,
  storage_limit_gb numeric not null default 0,
  features jsonb, -- e.g. ["4k downloads", "1 year access"]
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.packages enable row level security;

drop policy if exists "Admins can manage their packages" on public.packages;
create policy "Admins can manage their packages"
  on public.packages for all
  using (auth.uid() = owner_admin_id);

drop policy if exists "Clients can view active packages" on public.packages;
create policy "Clients can view active packages"
  on public.packages for select
  using (is_active = true);
