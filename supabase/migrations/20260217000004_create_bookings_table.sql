-- Create bookings table for client bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id),
  package_id uuid references public.packages(id),
  status text not null check (status in ('booked', 'confirmed', 'completed', 'editing', 'ready')),
  date text not null,
  time text not null,
  location text not null,
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

-- Clients can view their own bookings
drop policy if exists "Clients can view their own bookings" on public.bookings;
create policy "Clients can view their own bookings"
  on public.bookings for select
  to authenticated
  using (
    auth.uid() = user_id
    OR
    exists (
      select 1 from public.user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role in ('admin', 'super_admin')
    )
  );

-- Clients can create their own bookings
drop policy if exists "Clients can create their own bookings" on public.bookings;
create policy "Clients can create their own bookings"
  on public.bookings for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Admins can update any booking status
drop policy if exists "Admins can update any booking" on public.bookings;
create policy "Admins can update any booking"
  on public.bookings for update
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role in ('admin', 'super_admin')
    )
  );
