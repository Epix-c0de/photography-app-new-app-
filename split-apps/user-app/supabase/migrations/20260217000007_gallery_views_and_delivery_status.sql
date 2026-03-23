-- Add gallery view tracking and delivery status tables
-- Migration: 20260217000007_gallery_views_and_delivery_status.sql

-- Table to track gallery views for delivery status
create table if not exists public.gallery_views (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id),
  user_id uuid not null references public.user_profiles(id),
  viewed_at timestamptz not null default now(),
  unique(gallery_id, user_id)
);

alter table public.gallery_views enable row level security;

-- Users can view their own gallery views
drop policy if exists "Users can view their gallery views" on public.gallery_views;
create policy "Users can view their gallery views"
  on public.gallery_views for select
  using (auth.uid() = user_id);

-- Users can insert their own gallery views
drop policy if exists "Users can insert gallery views" on public.gallery_views;
create policy "Users can insert gallery views"
  on public.gallery_views for insert
  with check (auth.uid() = user_id);

-- Table to track delivery status for galleries
create table if not exists public.gallery_delivery_status (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id),
  client_id uuid not null references public.clients(id),
  sms_sent boolean not null default false,
  sms_sent_at timestamptz,
  notification_sent boolean not null default false,
  notification_sent_at timestamptz,
  gallery_viewed boolean not null default false,
  gallery_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(gallery_id, client_id)
);

alter table public.gallery_delivery_status enable row level security;

-- Admins can view delivery status for their clients
drop policy if exists "Admins can view delivery status" on public.gallery_delivery_status;
create policy "Admins can view delivery status"
  on public.gallery_delivery_status for select
  using (
    exists (
      select 1 from public.clients
      where public.clients.id = public.gallery_delivery_status.client_id
      and public.clients.owner_admin_id = auth.uid()
    )
  );

-- Function to update delivery status
create or replace function public.update_delivery_status(
  p_gallery_id uuid,
  p_client_id uuid,
  p_field text,
  p_value boolean default null,
  p_timestamp timestamptz default null
)
returns void as $$
begin
  insert into public.gallery_delivery_status (
    gallery_id,
    client_id,
    sms_sent,
    notification_sent,
    gallery_viewed
  ) values (
    p_gallery_id,
    p_client_id,
    case when p_field = 'sms_sent' then coalesce(p_value, false) else false end,
    case when p_field = 'notification_sent' then coalesce(p_value, false) else false end,
    case when p_field = 'gallery_viewed' then coalesce(p_value, false) else false end
  )
  on conflict (gallery_id, client_id) do update set
    sms_sent = case when p_field = 'sms_sent' then coalesce(p_value, gallery_delivery_status.sms_sent) else gallery_delivery_status.sms_sent end,
    sms_sent_at = case when p_field = 'sms_sent' and p_value = true then coalesce(p_timestamp, now()) else gallery_delivery_status.sms_sent_at end,
    notification_sent = case when p_field = 'notification_sent' then coalesce(p_value, gallery_delivery_status.notification_sent) else gallery_delivery_status.notification_sent end,
    notification_sent_at = case when p_field = 'notification_sent' and p_value = true then coalesce(p_timestamp, now()) else gallery_delivery_status.notification_sent_at end,
    gallery_viewed = case when p_field = 'gallery_viewed' then coalesce(p_value, gallery_delivery_status.gallery_viewed) else gallery_delivery_status.gallery_viewed end,
    gallery_viewed_at = case when p_field = 'gallery_viewed' and p_value = true then coalesce(p_timestamp, now()) else gallery_delivery_status.gallery_viewed_at end,
    updated_at = now();
end;
$$ language plpgsql security definer;
