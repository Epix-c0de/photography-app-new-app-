-- Add description fields to packages table
alter table public.packages add column if not exists description text;
alter table public.packages add column if not exists detailed_description text;

-- Add is_popular flag to packages
alter table public.packages add column if not exists is_popular boolean default false;

-- Create admin calendar availability table
create table if not exists public.admin_calendar_availability (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.user_profiles(id) on delete cascade,
  date date not null,
  status text not null check (status in ('available', 'busy', 'partial')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(admin_id, date)
);

alter table public.admin_calendar_availability enable row level security;

-- RLS policies for admin_calendar_availability
drop policy if exists "Admins can manage their own calendar" on public.admin_calendar_availability;
create policy "Admins can manage their own calendar"
  on public.admin_calendar_availability for all
  to authenticated
  using (auth.uid() = admin_id)
  with check (auth.uid() = admin_id);

drop policy if exists "Clients can view admin availability" on public.admin_calendar_availability;
create policy "Clients can view admin availability"
  on public.admin_calendar_availability for select
  to authenticated
  using (true);

-- Update bookings status enum to include pending and cancelled
-- First, add new status values to the check constraint
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check 
  check (status in ('booked', 'pending', 'confirmed', 'completed', 'cancelled', 'editing', 'ready'));

-- Create index for faster calendar queries
create index if not exists idx_calendar_availability_admin_date 
  on public.admin_calendar_availability(admin_id, date);
