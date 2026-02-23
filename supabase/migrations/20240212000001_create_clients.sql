create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  user_id uuid references public.user_profiles(id),
  name text not null,
  phone text,
  email text,
  notes text,
  total_paid numeric not null default 0,
  last_shoot_date timestamptz,
  preferred_package text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

drop policy if exists "Admins can manage their own clients" on public.clients;
create policy "Admins can manage their own clients"
  on public.clients for all
  using (auth.uid() = owner_admin_id);

drop policy if exists "Clients can view their own record" on public.clients;
create policy "Clients can view their own record"
  on public.clients for select
  using (auth.uid() = user_id);
