-- Enable UUID extension (usually enabled by default in Supabase)
create extension if not exists "uuid-ossp";

-- 1. USER PROFILES
-- Extends auth.users to store role and application specific data
create table public.user_profiles (
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

-- Enable RLS
alter table public.user_profiles enable row level security;

-- Policies
-- Admins can view all profiles
create policy "Admins can view all profiles" 
  on public.user_profiles for select 
  using (
    coalesce(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role'
    ) in ('admin', 'super_admin')
  );

-- Users can view and update their own profile
create policy "Users can view own profile" 
  on public.user_profiles for select 
  using (auth.uid() = id);

create policy "Users can update own profile" 
  on public.user_profiles for update 
  using (auth.uid() = id);

-- 2. CLIENTS (Admin managed client records)
-- This table links a client user (user_profiles) to an admin's client list
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id), -- The admin who owns this client record
  user_id uuid references public.user_profiles(id), -- Optional link to the actual client user account
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

-- Admin policies
create policy "Admins can manage their own clients" 
  on public.clients for all 
  using (auth.uid() = owner_admin_id);

-- Client policies (if clients need to see their "record" managed by admin)
-- Typically clients see "Galleries", not this CRM record, but we can allow read if linked
create policy "Clients can view their own record" 
  on public.clients for select 
  using (auth.uid() = user_id);

-- 3. GALLERIES
create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  client_id uuid not null references public.clients(id),
  name text not null, -- e.g., "Wedding 2024"
  cover_photo_url text,
  access_code text unique not null, -- For unlocking/finding
  is_paid boolean not null default false,
  is_locked boolean not null default true, -- Can be locked even if paid (manual release)
  price numeric not null default 0,
  shoot_type text, -- e.g. "Wedding", "Portrait"
  scheduled_release timestamptz,
  created_at timestamptz not null default now()
);

alter table public.galleries enable row level security;

-- Admin policies
create policy "Admins can manage their own galleries" 
  on public.galleries for all 
  using (auth.uid() = owner_admin_id);

-- Client policies
-- Clients can see galleries linked to them
create policy "Clients can view their galleries" 
  on public.galleries for select 
  using (
    exists (
      select 1 from public.clients 
      where public.clients.id = public.galleries.client_id 
      and public.clients.user_id = auth.uid()
    )
  );

-- 4. PHOTOS
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  storage_path text not null, -- Path in Supabase Storage
  variant text not null check (variant in ('watermarked', 'clean')),
  width int,
  height int,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

-- Admin policies
create policy "Admins can manage photos in their galleries" 
  on public.photos for all 
  using (
    exists (
      select 1 from public.galleries 
      where public.galleries.id = public.photos.gallery_id 
      and public.galleries.owner_admin_id = auth.uid()
    )
  );

-- Client policies
-- Clients can view watermarked photos always if they have access to gallery
create policy "Clients can view watermarked photos" 
  on public.photos for select 
  using (
    variant = 'watermarked' 
    and exists (
      select 1 from public.galleries 
      join public.clients on public.clients.id = public.galleries.client_id
      where public.galleries.id = public.photos.gallery_id 
      and public.clients.user_id = auth.uid()
    )
  );

-- Clients can view clean photos ONLY if gallery is paid and unlocked
create policy "Clients can view clean photos if paid" 
  on public.photos for select 
  using (
    variant = 'clean' 
    and exists (
      select 1 from public.galleries 
      join public.clients on public.clients.id = public.galleries.client_id
      where public.galleries.id = public.photos.gallery_id 
      and public.clients.user_id = auth.uid()
      and public.galleries.is_paid = true
      and public.galleries.is_locked = false
    )
  );

-- 5. PAYMENTS
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  client_id uuid not null references public.clients(id),
  gallery_id uuid references public.galleries(id),
  amount numeric not null,
  currency text not null default 'KES',
  status text not null check (status in ('pending', 'paid', 'failed', 'cancelled')),
  mpesa_receipt_number text,
  mpesa_checkout_request_id text,
  phone_number text, -- The number that paid
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;

-- Admin policies
create policy "Admins can view payments for them" 
  on public.payments for select 
  using (auth.uid() = owner_admin_id);

-- Client policies
create policy "Clients can view their own payments" 
  on public.payments for select 
  using (
    exists (
      select 1 from public.clients 
      where public.clients.id = public.payments.client_id 
      and public.clients.user_id = auth.uid()
    )
  );

-- 6. NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id),
  type text not null, -- e.g., 'payment_success', 'gallery_unlocked', 'promotion'
  title text not null,
  body text not null,
  data jsonb, -- Metadata for navigation (e.g., { galleryId: ... })
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Users can view their own notifications
create policy "Users can view own notifications" 
  on public.notifications for select 
  using (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
create policy "Users can update own notifications" 
  on public.notifications for update 
  using (auth.uid() = user_id);

-- 7. SMS LOGS (For admin auditing)
create table public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  client_id uuid references public.clients(id),
  phone_number text not null,
  message text not null,
  status text not null check (status in ('queued', 'sent', 'failed')),
  cost numeric,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.sms_logs enable row level security;

create policy "Admins can view their SMS logs" 
  on public.sms_logs for select 
  using (auth.uid() = owner_admin_id);

-- 8. PACKAGES
create table public.packages (
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

create policy "Admins can manage their packages" 
  on public.packages for all 
  using (auth.uid() = owner_admin_id);

create policy "Clients can view active packages" 
  on public.packages for select 
  using (is_active = true);

-- 9. ADMIN RESOURCES & STATS
-- Single row per admin to track balances and usage
create table public.admin_resources (
  admin_id uuid primary key references public.user_profiles(id),
  sms_balance int not null default 0,
  storage_used_bytes bigint not null default 0,
  storage_limit_bytes bigint not null default 5368709120, -- Default 5GB
  subscription_tier text default 'free',
  updated_at timestamptz not null default now()
);

alter table public.admin_resources enable row level security;

create policy "Admins can view own resources" 
  on public.admin_resources for select 
  using (auth.uid() = admin_id);

-- 10. AUDIT LOGS (Security & Compliance)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.user_profiles(id),
  action text not null, -- e.g. 'delete_gallery', 'export_data', 'update_settings'
  entity_type text not null, -- e.g. 'gallery', 'client', 'system'
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- Admins can view their own audit logs (actions they performed)
create policy "Admins can view own audit logs" 
  on public.audit_logs for select 
  using (auth.uid() = actor_id);

-- System can insert logs (via Edge Functions)
-- Note: In a real scenario, this might be 'postgres' role only or specific service role

-- 11. ANALYTICS EVENTS (Optional)
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id),
  event_type text not null, -- e.g., 'share_gallery', 'view_photo'
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

create policy "Users can insert events" 
  on public.analytics_events for insert 
  with check (auth.uid() = user_id);

-- TRIGGER: Auto-create user profile on signup
-- This assumes Supabase Auth
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
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to validate profile completeness
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

-- Trigger to validate profile completeness on insert/update
drop trigger if exists validate_profile_completeness_trigger on public.user_profiles;
create trigger validate_profile_completeness_trigger
  before insert or update on public.user_profiles
  for each row execute procedure public.validate_profile_completeness();

-- 11. ADMIN SETTINGS (Configurable)
create table public.admin_settings (
  admin_id uuid primary key references public.user_profiles(id),
  mpesa_paybill text,
  mpesa_account_reference text,
  currency text default 'KES',
  watermark_text text,
  branding_color text,
  notification_template_upload text,
  notification_template_payment text,
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;

create policy "Admins can manage their settings" 
  on public.admin_settings for all 
  using (auth.uid() = admin_id);

-- 12. BTS MEDIA (Behind The Scenes)
create table public.bts_media (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text,
  visibility text not null check (visibility in ('global', 'restricted')),
  allowed_clients uuid[], -- Array of client user_ids if restricted
  created_at timestamptz not null default now()
);

alter table public.bts_media enable row level security;

create policy "Admins can manage their BTS" 
  on public.bts_media for all 
  using (auth.uid() = owner_admin_id);

create policy "Clients can view global BTS" 
  on public.bts_media for select 
  using (
    visibility = 'global'
  );

create policy "Clients can view restricted BTS if allowed" 
  on public.bts_media for select 
  using (
    visibility = 'restricted' AND 
    auth.uid() = ANY(allowed_clients)
  );

-- STORAGE POLICIES (Conceptual - to be applied in Storage settings)
-- Buckets: 'photos-watermarked', 'photos-clean', 'thumbnails'

-- 1. photos-watermarked
-- Policy: "Admins can upload"
-- (bucket_id = 'photos-watermarked' AND auth.uid() = (storage.foldername(name))[1]::uuid)
-- Policy: "Public/Clients can read"
-- true (or restricted to logged in users)

-- 2. photos-clean
-- Policy: "Admins can upload"
-- Policy: "Clients can read if paid"
-- This logic is complex for Storage RLS; simpler to use signed URLs generated by backend
-- Default Policy: "No public access", "Admins can access own folder"

-- 3. thumbnails
-- Policy: "Publicly readable" (for performance)
