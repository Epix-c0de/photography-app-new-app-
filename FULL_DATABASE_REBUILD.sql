-- ============================================================
-- COMPLETE DATABASE REBUILD — Epix Visuals Platform
-- Run this in Supabase SQL Editor to rebuild everything from scratch
-- WARNING: This will drop and recreate ALL tables, policies, functions, and triggers
-- ============================================================

-- ============================================
-- 0. CLEANUP (drop everything to start fresh)
-- ============================================
-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS validate_profile_completeness_trigger ON public.user_profiles;
DROP TRIGGER IF EXISTS trigger_sync_password_changed ON auth.users;
DROP TRIGGER IF EXISTS trigger_unlock_photos ON public.payments;
DROP TRIGGER IF EXISTS trigger_payment_refund ON public.payments;
DROP TRIGGER IF EXISTS trigger_log_client_assignment ON public.clients;
DROP TRIGGER IF EXISTS trigger_close_unassigned_session ON public.clients;
DROP TRIGGER IF EXISTS trg_gallery_published ON public.galleries;
DROP TRIGGER IF EXISTS trg_payment_received ON public.galleries;
DROP TRIGGER IF EXISTS trg_review_received ON public.reviews;
DROP TRIGGER IF EXISTS trg_support_reply ON public.support_messages;
DROP TRIGGER IF EXISTS trg_sms_low_balance ON public.sms_credits;
DROP TRIGGER IF EXISTS trigger_package_notification ON public.packages;
DROP TRIGGER IF EXISTS portfolio_items_updated_at ON public.portfolio_items;
DROP TRIGGER IF EXISTS update_portfolio_items_updated_at ON public.portfolio_items;
DROP TRIGGER IF EXISTS update_announcements_updated_at ON public.announcements;
DROP TRIGGER IF EXISTS trigger_update_unassigned_sessions_updated_at ON public.unassigned_user_sessions;
DROP TRIGGER IF EXISTS on_bts_comment_delete ON public.bts_comments;
DROP TRIGGER IF EXISTS on_announcement_comment_delete ON public.announcement_comments;
DROP TRIGGER IF EXISTS on_portfolio_comment_delete ON public.portfolio_comments;
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
DROP TRIGGER IF EXISTS update_watermark_settings_updated_at ON public.watermark_settings;
DROP TRIGGER IF EXISTS update_payment_settings_updated_at ON public.payment_settings;
DROP TRIGGER IF EXISTS update_mpesa_transactions_updated_at ON public.mpesa_transactions;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.validate_profile_completeness() CASCADE;
DROP FUNCTION IF EXISTS public.sync_password_changed_timestamp() CASCADE;
DROP FUNCTION IF EXISTS public.unlock_photos_on_payment() CASCADE;
DROP FUNCTION IF EXISTS public.handle_payment_refund() CASCADE;
DROP FUNCTION IF EXISTS public.lock_gallery_on_refund(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_gallery_unlock_status(UUID,UUID) CASCADE;
DROP FUNCTION IF EXISTS public.manually_unlock_gallery(UUID,UUID,TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.log_client_assignment() CASCADE;
DROP FUNCTION IF EXISTS public.close_unassigned_session_on_assignment() CASCADE;
DROP FUNCTION IF EXISTS public.notify_gallery_published() CASCADE;
DROP FUNCTION IF EXISTS public.notify_payment_received() CASCADE;
DROP FUNCTION IF EXISTS public.notify_review_received() CASCADE;
DROP FUNCTION IF EXISTS public.notify_support_reply() CASCADE;
DROP FUNCTION IF EXISTS public.notify_sms_low_balance() CASCADE;
DROP FUNCTION IF EXISTS public.notify_package_update() CASCADE;
DROP FUNCTION IF EXISTS public.decrement_bts_comment_count() CASCADE;
DROP FUNCTION IF EXISTS public.decrement_announcement_comment_count() CASCADE;
DROP FUNCTION IF EXISTS public.decrement_portfolio_comment_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_portfolio_items_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_announcements_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_unassigned_sessions_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.validate_photographer_code(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.assign_client_to_photographer(UUID,TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.client_needs_assignment(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.client_needs_assignment() CASCADE;
DROP FUNCTION IF EXISTS public.auto_assign_on_login(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.auto_assign_on_login() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_subscription_active(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.activate_admin_subscription(UUID,TEXT,TEXT,INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_photographer_storage_metrics(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.detect_fraud_patterns() CASCADE;
DROP FUNCTION IF EXISTS public.get_revenue_metrics(TIMESTAMPTZ,TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.init_upload_session(UUID,UUID,TEXT,INTEGER,BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.bump_upload_session(UUID,INTEGER,INTEGER,TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.complete_upload_session(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.emit_event(TEXT,JSONB,UUID,UUID,UUID) CASCADE;
DROP FUNCTION IF EXISTS public.create_client_notification(UUID,UUID,public.notification_kind,TEXT,TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_gallery_notification(UUID,UUID,TEXT,TEXT,TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.handle_mpesa_callback(TEXT,TEXT,INTEGER,TEXT,TIMESTAMPTZ,TEXT,JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.record_event(TEXT,UUID,UUID,UUID,JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.reserve_gallery_payment(UUID,UUID,TEXT,NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.release_due_galleries() CASCADE;
DROP FUNCTION IF EXISTS public.run_greeting_schedules() CASCADE;
DROP FUNCTION IF EXISTS public.update_delivery_status(UUID,UUID,TEXT,BOOLEAN,TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.increment_views(UUID,TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.increment_clicks(UUID,TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.unlock_gallery_for_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.unlock_gallery_and_link(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_profile_by_phone(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_biometric_setting(BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.set_pin_hash(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.remove_pin_lock() CASCADE;
DROP FUNCTION IF EXISTS public.get_unassigned_user_analytics(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_photographer_conversion_report() CASCADE;
DROP FUNCTION IF EXISTS public.get_photo_download_url(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.toggle_photographer_original_download(UUID,BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.suspend_photographer(UUID,TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.unsuspend_photographer(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_photographer_full_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.complete_sms_purchase(UUID,UUID,INTEGER,NUMERIC,TEXT,TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_event_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_review_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_calendar_events(UUID,INTEGER,INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.update_delivery_status(UUID,UUID,TEXT,BOOLEAN,TIMESTAMPTZ) CASCADE;

-- Drop views
DROP VIEW IF EXISTS public.revenue_pipeline CASCADE;
DROP VIEW IF EXISTS public.v_total_unassigned_users CASCADE;
DROP VIEW IF EXISTS public.v_avg_time_to_assignment CASCADE;
DROP VIEW IF EXISTS public.v_conversion_rate_per_photographer CASCADE;
DROP VIEW IF EXISTS public.v_top_viewed_content CASCADE;
DROP VIEW IF EXISTS public.v_assignment_source_distribution CASCADE;
DROP VIEW IF EXISTS public.v_failed_attempt_counts CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.data_export_requests CASCADE;
DROP TABLE IF EXISTS public.feature_flags CASCADE;
DROP TABLE IF EXISTS public.event_clients CASCADE;
DROP TABLE IF EXISTS public.event_reminders CASCADE;
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.support_channels CASCADE;
DROP TABLE IF EXISTS public.support_messages CASCADE;
DROP TABLE IF EXISTS public.sms_credit_packages CASCADE;
DROP TABLE IF EXISTS public.sms_purchase_transactions CASCADE;
DROP TABLE IF EXISTS public.sms_credits CASCADE;
DROP TABLE IF EXISTS public.platform_payment_settings CASCADE;
DROP TABLE IF EXISTS public.fraud_flags CASCADE;
DROP TABLE IF EXISTS public.client_assignment_log CASCADE;
DROP TABLE IF EXISTS public.unassigned_user_sessions CASCADE;
DROP TABLE IF EXISTS public.admin_subscriptions CASCADE;
DROP TABLE IF EXISTS public.admin_audit_log CASCADE;
DROP TABLE IF EXISTS public.platform_settings CASCADE;
DROP TABLE IF EXISTS public.portfolio_comments CASCADE;
DROP TABLE IF EXISTS public.portfolio_bookmarks CASCADE;
DROP TABLE IF EXISTS public.portfolio_items CASCADE;
DROP TABLE IF EXISTS public.bts_bookmarks CASCADE;
DROP TABLE IF EXISTS public.announcement_bookmarks CASCADE;
DROP TABLE IF EXISTS public.bts_comments CASCADE;
DROP TABLE IF EXISTS public.announcement_comments CASCADE;
DROP TABLE IF EXISTS public.bts_likes CASCADE;
DROP TABLE IF EXISTS public.gallery_shares CASCADE;
DROP TABLE IF EXISTS public.gallery_delivery_status CASCADE;
DROP TABLE IF EXISTS public.gallery_views CASCADE;
DROP TABLE IF EXISTS public.unlocked_galleries CASCADE;
DROP TABLE IF EXISTS public.bts_posts CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.watermark_settings CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.photos CASCADE;
DROP TABLE IF EXISTS public.gallery_photos CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.upload_sessions CASCADE;
DROP TABLE IF EXISTS public.upload_logs CASCADE;
DROP TABLE IF EXISTS public.photo_processing_jobs CASCADE;
DROP TABLE IF EXISTS public.access_code_attempts CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.sms_logs CASCADE;
DROP TABLE IF EXISTS public.galleries CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.packages CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.payment_settings CASCADE;
DROP TABLE IF EXISTS public.mpesa_transactions CASCADE;
DROP TABLE IF EXISTS public.mpesa_logs CASCADE;
DROP TABLE IF EXISTS public.event_log CASCADE;
DROP TABLE IF EXISTS public.storage_usage CASCADE;
DROP TABLE IF EXISTS public.client_lifetime_stats CASCADE;
DROP TABLE IF EXISTS public.bulk_jobs CASCADE;
DROP TABLE IF EXISTS public.greeting_schedules CASCADE;
DROP TABLE IF EXISTS public.admin_resources CASCADE;
DROP TABLE IF EXISTS public.admin_settings CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.analytics_events CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS public.photo_upload_status CASCADE;
DROP TYPE IF EXISTS public.upload_session_status CASCADE;
DROP TYPE IF EXISTS public.gallery_upload_status CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.payment_provider CASCADE;
DROP TYPE IF EXISTS public.sms_delivery_status CASCADE;
DROP TYPE IF EXISTS public.notification_kind CASCADE;

-- Drop storage buckets
DELETE FROM storage.buckets WHERE id IN ('client-photos','thumbnails','avatars','bts-media','brand-assets','portfolio','package-images','support-media');

-- Drop ALL remaining storage policies
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'storage'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Drop ALL remaining RLS policies on public tables
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

RAISE NOTICE '=== Cleanup complete. Building fresh schema... ===';


-- ============================================
-- 1. CUSTOM TYPES
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_upload_status') THEN
    CREATE TYPE public.photo_upload_status AS ENUM ('pending', 'uploaded', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_session_status') THEN
    CREATE TYPE public.upload_session_status AS ENUM ('initializing', 'uploading', 'completed', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gallery_upload_status') THEN
    CREATE TYPE public.gallery_upload_status AS ENUM ('pending', 'uploading', 'completed', 'failed', 'corrupted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('pending', 'success', 'failed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
    CREATE TYPE public.payment_provider AS ENUM ('mpesa');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sms_delivery_status') THEN
    CREATE TYPE public.sms_delivery_status AS ENUM ('queued', 'sent', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_kind') THEN
    CREATE TYPE public.notification_kind AS ENUM ('upload', 'payment_success', 'payment_failed', 'announcement', 'system');
  END IF;
END $$;


-- ============================================
-- 2. TABLES
-- ============================================

-- 2.1 USER PROFILES
CREATE TABLE public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'client', 'super_admin')),
  name text,
  phone text unique,
  email text,
  avatar_url text,
  pin_hash text,
  biometric_enabled boolean default false,
  phone_verified boolean not null default false,
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  subscription_status text not null default 'inactive',
  subscription_expires_at timestamptz,
  is_lifetime boolean not null default false,
  trial_ends_at timestamptz,
  photographer_code text unique,
  password_changed_at timestamptz default now(),
  last_password_change_reminder timestamptz,
  "2fa_enabled" boolean default false,
  "2fa_secret" text default null,
  "2fa_backup_codes" text[] default null,
  allow_original_download boolean not null default false,
  is_suspended boolean not null default false,
  suspended_at timestamptz,
  suspended_reason text
);

-- 2.2 CLIENTS
CREATE TABLE public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  user_id uuid references public.user_profiles(id),
  name text not null default '',
  phone text,
  email text,
  notes text,
  total_paid numeric not null default 0,
  last_shoot_date timestamptz,
  preferred_package text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  loyalty_level text not null default 'Bronze' check (loyalty_level in ('Bronze', 'Silver', 'Gold', 'Platinum')),
  avatar_url text
);

-- 2.3 GALLERIES
CREATE TABLE public.galleries (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  client_id uuid not null references public.clients(id),
  name text not null,
  cover_photo_url text,
  access_code text unique not null,
  is_paid boolean not null default false,
  is_locked boolean not null default true,
  price numeric not null default 0,
  shoot_type text,
  scheduled_release timestamptz,
  created_at timestamptz not null default now(),
  client_name text,
  client_phone text,
  created_by_admin_id uuid not null references public.user_profiles(id),
  expires_at timestamptz,
  is_active boolean not null default false,
  total_photos integer not null default 0,
  expected_file_count integer not null default 0,
  estimated_total_size bigint,
  upload_status public.gallery_upload_status not null default 'pending',
  sms_sent boolean not null default false,
  whatsapp_sent boolean not null default false,
  payment_status text default 'pending',
  paid_at timestamptz,
  payment_amount decimal(10,2),
  release_at timestamptz,
  is_locked_until_release boolean not null default false,
  status text default 'locked'
);

-- 2.4 GALLERY PHOTOS
CREATE TABLE public.gallery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'image/jpeg',
  width integer,
  height integer,
  is_watermarked boolean NOT NULL DEFAULT false,
  upload_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_locked boolean DEFAULT TRUE,
  unlocked_at timestamptz,
  optimized_photo_url text
);

-- 2.5 PHOTOS (legacy table)
CREATE TABLE public.photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  storage_path text not null,
  variant text not null check (variant in ('watermarked', 'clean')),
  width int,
  height int,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  file_url text,
  file_name text,
  file_size integer,
  mime_type text,
  checksum text,
  medium_url text,
  thumbnail_url text,
  upload_status public.photo_upload_status NOT NULL DEFAULT 'pending'
);

-- 2.6 MESSAGES
CREATE TABLE public.messages (
  id uuid default gen_random_uuid() primary key,
  owner_admin_id uuid references public.user_profiles(id) not null,
  client_id uuid references public.user_profiles(id) not null,
  sender_role text check (sender_role in ('admin', 'client')) not null,
  content text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- 2.7 PACKAGES
CREATE TABLE public.packages (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  name text not null,
  price numeric not null default 0,
  sms_included int not null default 0,
  storage_limit_gb numeric not null default 0,
  features jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cover_image_url text,
  description text,
  detailed_description text,
  is_popular boolean not null default false,
  category text
);

-- 2.8 BOOKINGS
CREATE TABLE public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id),
  package_id uuid references public.packages(id),
  status text not null check (status in ('booked', 'confirmed', 'completed', 'editing', 'ready')),
  date text not null,
  time text not null,
  location text not null,
  created_at timestamptz not null default now(),
  owner_admin_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

-- 2.9 PAYMENTS
CREATE TABLE public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  client_id uuid not null references public.clients(id),
  gallery_id uuid references public.galleries(id),
  amount numeric not null,
  currency text not null default 'KES',
  status public.payment_status not null default 'pending',
  provider public.payment_provider not null default 'mpesa',
  checkout_request_id text,
  merchant_request_id text,
  mpesa_receipt_number text,
  mpesa_checkout_request_id text,
  phone_number text,
  client_phone text,
  transaction_date timestamptz,
  raw_callback_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_status_check check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded'))
);

-- 2.10 NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id),
  type text not null,
  title text not null,
  body text not null,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  client_id uuid references public.clients(id),
  gallery_id uuid references public.galleries(id),
  message text,
  notification_type public.notification_kind,
  is_read boolean not null default false,
  access_code text,
  sent_status text default 'pending' check (sent_status in ('pending', 'sent', 'delivered', 'failed')),
  owner_admin_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

-- 2.11 SMS LOGS
CREATE TABLE public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  owner_admin_id uuid not null references public.user_profiles(id),
  client_id uuid references public.clients(id),
  phone_number text not null,
  message text not null,
  status text not null default 'queued',
  cost numeric,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  gallery_id uuid references public.galleries(id),
  client_phone text,
  message_body text,
  sent_by_admin_id uuid references public.user_profiles(id),
  delivery_status public.sms_delivery_status not null default 'queued',
  fallback_whatsapp_triggered boolean not null default false
);

-- 2.12 ADMIN RESOURCES
CREATE TABLE public.admin_resources (
  admin_id uuid primary key references public.user_profiles(id),
  sms_balance int not null default 0,
  storage_used_bytes bigint not null default 0,
  storage_limit_bytes bigint not null default 5368709120,
  subscription_tier text default 'free',
  updated_at timestamptz not null default now()
);

-- 2.13 AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.user_profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- 2.14 ANALYTICS EVENTS
CREATE TABLE public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id),
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- 2.15 ADMIN SETTINGS
CREATE TABLE public.admin_settings (
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

-- 2.16 BTS POSTS
CREATE TABLE public.bts_posts (
  id uuid primary key default gen_random_uuid(),
  title text,
  media_url text not null,
  media_type text check (media_type in ('image', 'video')) not null,
  category text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  scheduled_for timestamptz,
  music_url text,
  views_count integer not null default 0,
  clicks_count integer not null default 0,
  target_audience text[],
  is_active boolean not null default true,
  shoot_type text,
  created_by uuid REFERENCES auth.users(id),
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  admin_id uuid,
  video_url text,
  caption text,
  music_track_url text,
  video_thumbnail_url text,
  media_aspect_ratio float,
  shares_count integer not null default 0,
  visibility text default 'global',
  bookmarks_count integer default 0,
  owner_admin_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE
);

-- 2.17 ANNOUNCEMENTS
CREATE TABLE public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  tag text,
  cta text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  content_html text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  category text,
  created_by uuid REFERENCES auth.users(id),
  comments_count integer not null default 0,
  body_html text,
  created_by_admin uuid,
  is_published boolean not null default true,
  video_thumbnail_url text,
  media_aspect_ratio float,
  views_count integer not null default 0,
  shares_count integer not null default 0,
  visibility text default 'global',
  bookmarks_count integer default 0,
  owner_admin_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now()
);

-- 2.18 BTS COMMENTS
CREATE TABLE public.bts_comments (
  id uuid primary key default gen_random_uuid(),
  bts_id uuid REFERENCES public.bts_posts(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  comment text not null,
  created_at timestamptz not null default now(),
  post_id uuid,
  comment_text text,
  is_admin_reply boolean not null default false,
  parent_comment_id uuid REFERENCES public.bts_comments(id) ON DELETE SET NULL
);

-- 2.19 ANNOUNCEMENT COMMENTS
CREATE TABLE public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  comment text not null,
  created_at timestamptz not null default now(),
  comment_text text,
  is_admin_reply boolean not null default false,
  parent_comment_id uuid REFERENCES public.announcement_comments(id) ON DELETE SET NULL
);

-- 2.20 BTS LIKES
CREATE TABLE public.bts_likes (
  id uuid default gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  bts_id uuid REFERENCES public.bts_posts(id) ON DELETE CASCADE,
  created_at timestamptz not null default now(),
  client_id uuid,
  post_id uuid,
  PRIMARY KEY (user_id, bts_id)
);

-- 2.21 BTS BOOKMARKS
CREATE TABLE public.bts_bookmarks (
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  bts_id uuid REFERENCES public.bts_posts(id) ON DELETE CASCADE,
  created_at timestamptz default now(),
  PRIMARY KEY (user_id, bts_id)
);

-- 2.22 ANNOUNCEMENT BOOKMARKS
CREATE TABLE public.announcement_bookmarks (
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  created_at timestamptz default now(),
  PRIMARY KEY (user_id, announcement_id)
);

-- 2.23 PORTFOLIO ITEMS
CREATE TABLE public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  description text,
  photo_url text not null,
  category text not null default 'Other',
  is_featured boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  video_thumbnail_url text,
  media_aspect_ratio float,
  views_count integer not null default 0,
  shares_count integer not null default 0,
  owner_admin_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  comments_count integer DEFAULT 0,
  bookmarks_count integer DEFAULT 0
);

-- 2.24 PORTFOLIO BOOKMARKS
CREATE TABLE public.portfolio_bookmarks (
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  portfolio_item_id uuid REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
  created_at timestamptz default now(),
  PRIMARY KEY (user_id, portfolio_item_id)
);

-- 2.25 PORTFOLIO COMMENTS
CREATE TABLE public.portfolio_comments (
  id uuid default gen_random_uuid() primary key,
  portfolio_item_id uuid REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.26 EVENTS (Calendar)
CREATE TABLE public.events (
  id uuid default gen_random_uuid() primary key,
  photographer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text not null,
  event_type text not null check (event_type in ('wedding', 'portrait', 'corporate', 'event', 'graduation', 'other')),
  event_date date not null,
  event_time time,
  end_time time,
  location text,
  notes text,
  status text default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  reminder_sent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata jsonb,
  admin_id uuid REFERENCES public.user_profiles(id),
  gallery_id uuid REFERENCES public.galleries(id),
  is_busy boolean default true,
  reminder_date timestamptz
);

-- 2.27 EVENT CLIENTS
CREATE TABLE public.event_clients (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  client_id uuid not null references public.user_profiles(id) on delete cascade,
  notified boolean default false,
  reminder_sent boolean default false,
  created_at timestamptz not null default now(),
  UNIQUE(event_id, client_id)
);

-- 2.28 EVENT REMINDERS
CREATE TABLE public.event_reminders (
  id uuid default gen_random_uuid() primary key,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  reminder_type text not null check (reminder_type in ('sms', 'whatsapp', 'email', 'push')),
  reminder_date timestamptz not null,
  message text,
  status text default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- 2.29 REVIEWS
CREATE TABLE public.reviews (
  id uuid default gen_random_uuid() primary key,
  photographer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  gallery_id uuid REFERENCES public.galleries(id) ON DELETE SET NULL,
  rating int check (rating >= 1 and rating <= 5) not null,
  review_text text,
  review_source text default 'web' check (review_source in ('web', 'sms', 'whatsapp', 'ussd')),
  is_public boolean default true,
  is_verified boolean default false,
  helpful_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  quality_rating int check (quality_rating >= 1 and quality_rating <= 5),
  speed_rating int check (speed_rating >= 1 and speed_rating <= 5),
  professionalism_rating int check (professionalism_rating >= 1 and professionalism_rating <= 5),
  communication_rating int check (communication_rating >= 1 and communication_rating <= 5),
  status text default 'approved' check (status in ('pending', 'approved', 'rejected')),
  admin_response text,
  admin_responded_at timestamptz,
  is_featured boolean default false,
  response text,
  response_at timestamptz
);

-- 2.30 WATERMARK SETTINGS
CREATE TABLE public.watermark_settings (
  id uuid default gen_random_uuid() primary key,
  photographer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE unique,
  is_enabled boolean default true,
  watermark_text text,
  watermark_position text default 'bottomRight' check (watermark_position in ('center', 'bottomRight', 'bottomLeft', 'topRight', 'topLeft', 'tiled')),
  watermark_opacity decimal(3,2) default 0.30,
  watermark_rotation int default 0,
  watermark_scale decimal(3,2) default 1.00,
  watermark_color text default '#FFFFFF',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.31 GALLERY SHARES
CREATE TABLE public.gallery_shares (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  share_token text not null unique,
  caption text,
  background_music_url text,
  download_app_link text,
  created_at timestamptz not null default now()
);

-- 2.32 UNLOCKED GALLERIES
CREATE TABLE public.unlocked_galleries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id),
  gallery_id uuid not null references public.galleries(id),
  unlocked_at timestamptz not null default now(),
  unique(user_id, gallery_id)
);

-- 2.33 GALLERY VIEWS
CREATE TABLE public.gallery_views (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id),
  user_id uuid not null references public.user_profiles(id),
  viewed_at timestamptz not null default now(),
  unique(gallery_id, user_id)
);

-- 2.34 GALLERY DELIVERY STATUS
CREATE TABLE public.gallery_delivery_status (
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

-- 2.35 UPLOAD SESSIONS
CREATE TABLE public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid references public.galleries(id) on delete set null,
  admin_id uuid not null references public.user_profiles(id),
  status public.upload_session_status not null default 'initializing',
  total_files integer not null,
  uploaded_files integer not null default 0,
  failed_files integer not null default 0,
  parallel_upload_limit integer not null default 5,
  estimated_total_size bigint,
  created_at timestamptz not null default now()
);

-- 2.36 UPLOAD LOGS
CREATE TABLE public.upload_logs (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  file_name text,
  status text not null,
  message text,
  created_at timestamptz not null default now()
);

-- 2.37 PHOTO PROCESSING JOBS
CREATE TABLE public.photo_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.38 ACCESS CODE ATTEMPTS
CREATE TABLE public.access_code_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier text not null unique,
  attempts integer not null default 0,
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.39 PAYMENT SETTINGS
CREATE TABLE public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.user_profiles(id),
  mpesa_shortcode text,
  mpesa_consumer_key text,
  mpesa_consumer_secret text,
  mpesa_passkey text,
  callback_url text,
  payment_recipient_display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  environment text default 'sandbox' check (environment in ('sandbox', 'production')),
  confirmation_url text,
  validation_url text,
  initiator_name text,
  initiator_password text
);

-- 2.40 MPESA TRANSACTIONS
CREATE TABLE public.mpesa_transactions (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid references public.galleries(id),
  client_id uuid references public.user_profiles(id),
  phone_number text not null,
  amount numeric not null,
  mpesa_receipt text unique,
  merchant_request_id text unique,
  checkout_request_id text unique,
  status text default 'pending' check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.41 MPESA LOGS
CREATE TABLE public.mpesa_logs (
  id uuid primary key default gen_random_uuid(),
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now()
);

-- 2.42 EVENT LOG
CREATE TABLE public.event_log (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  payload jsonb,
  gallery_id uuid references public.galleries(id),
  client_id uuid references public.clients(id),
  admin_id uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

-- 2.43 STORAGE USAGE
CREATE TABLE public.storage_usage (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.user_profiles(id),
  total_bytes_used bigint not null default 0,
  total_galleries integer not null default 0,
  total_photos integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 2.44 CLIENT LIFETIME STATS
CREATE TABLE public.client_lifetime_stats (
  client_id uuid primary key references public.clients(id) on delete cascade,
  total_galleries integer not null default 0,
  total_paid_amount numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- 2.45 BULK JOBS
CREATE TABLE public.bulk_jobs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.user_profiles(id),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  progress integer not null default 0,
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.46 GREETING SCHEDULES
CREATE TABLE public.greeting_schedules (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.user_profiles(id),
  client_id uuid not null references public.clients(id),
  send_at timestamptz not null,
  message_template text not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.47 PLATFORM SETTINGS
CREATE TABLE public.platform_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now(),
  admin_app_url text default 'https://admin.epixvisuals.app',
  client_app_url text default 'https://app.epixvisuals.app',
  admin_onboarding_url text default 'https://join.epixvisuals.app',
  deep_link_scheme text default 'epix-visuals'
);

-- 2.48 ADMIN SUBSCRIPTIONS
CREATE TABLE public.admin_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.user_profiles(id) on delete cascade,
  amount integer not null default 500,
  currency text not null default 'KES',
  mpesa_transaction_id text,
  checkout_request_id text,
  status text not null default 'pending',
  period_start timestamptz,
  period_end timestamptz,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.49 ADMIN AUDIT LOG
CREATE TABLE public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb,
  ip_address text,
  created_at timestamptz not null default now(),
  entity_type text,
  entity_id uuid,
  changes jsonb,
  description text
);

-- 2.50 SUPPORT MESSAGES
CREATE TABLE public.support_messages (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.user_profiles(id) on delete cascade,
  super_admin_id uuid references public.user_profiles(id) on delete set null,
  content text not null,
  sender_role text not null check (sender_role in ('photographer', 'admin', 'super_admin', 'master_admin')),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  message_type text not null default 'text' check (message_type in ('text', 'image', 'file')),
  category text not null default 'general' check (category in ('general', 'billing', 'technical', 'feature_request', 'bug_report')),
  priority text check (priority in ('low', 'medium', 'high', 'urgent')),
  media_url text,
  file_name text,
  read_at timestamptz,
  channel_id uuid
);

-- 2.51 SUPPORT CHANNELS
CREATE TABLE public.support_channels (
  id uuid default gen_random_uuid() primary key,
  photographer_id uuid not null references public.user_profiles(id) on delete cascade,
  status text default 'open',
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  UNIQUE(photographer_id)
);

-- 2.52 NOTIFICATION PREFERENCES
CREATE TABLE public.notification_preferences (
  id uuid default gen_random_uuid() primary key,
  photographer_id uuid not null references public.user_profiles(id) on delete cascade,
  push_enabled boolean default true,
  email_enabled boolean default true,
  sms_enabled boolean default true,
  payment_alerts boolean default true,
  booking_alerts boolean default true,
  message_alerts boolean default true,
  gallery_alerts boolean default true,
  client_alerts boolean default true,
  weekly_report boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  UNIQUE(photographer_id)
);

-- 2.53 SMS CREDIT PACKAGES
CREATE TABLE public.sms_credit_packages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  sms_count integer not null,
  price numeric not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2.54 SMS PURCHASE TRANSACTIONS
CREATE TABLE public.sms_purchase_transactions (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid not null references public.user_profiles(id),
  package_id uuid references public.sms_credit_packages(id),
  sms_count integer not null,
  amount numeric not null,
  status text default 'pending',
  mpesa_receipt text,
  phone_number text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- 2.55 SMS CREDITS
CREATE TABLE public.sms_credits (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid not null references public.user_profiles(id) unique,
  balance integer default 0,
  total_purchased integer default 0,
  total_used integer default 0,
  updated_at timestamptz default now()
);

-- 2.56 PLATFORM PAYMENT SETTINGS
CREATE TABLE public.platform_payment_settings (
  id uuid primary key default gen_random_uuid(),
  mpesa_consumer_key text,
  mpesa_consumer_secret text,
  mpesa_passkey text,
  mpesa_shortcode text,
  mpesa_type text check (mpesa_type in ('paybill', 'till')),
  mpesa_account_reference text,
  subscription_monthly_price decimal(10,2) not null default 500.00,
  subscription_quarterly_price decimal(10,2) not null default 1350.00,
  subscription_annual_price decimal(10,2) not null default 4800.00,
  lifetime_price decimal(10,2) not null default 0.00,
  platform_commission_percentage decimal(5,2) not null default 10.00,
  payment_gateway text default 'mpesa' check (payment_gateway in ('mpesa', 'stripe', 'paystack')),
  test_mode boolean not null default true,
  payment_success_webhook_url text,
  payment_failed_webhook_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.user_profiles(id)
);

-- 2.57 FRAUD FLAGS
CREATE TABLE public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  flagged_user_id uuid not null references public.user_profiles(id) on delete cascade,
  flagged_by uuid not null references public.user_profiles(id),
  flag_type text not null check (flag_type in ('suspicious_activity', 'payment_fraud', 'content_violation', 'spam', 'impersonation', 'other')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  description text not null,
  status text not null default 'active' check (status in ('active', 'resolved', 'dismissed')),
  resolution_notes text,
  resolved_by uuid references public.user_profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.58 CLIENT ASSIGNMENT LOG
CREATE TABLE public.client_assignment_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.user_profiles(id) on delete cascade,
  admin_id uuid not null references public.user_profiles(id) on delete cascade,
  photographer_code text not null,
  assigned_via text check (assigned_via in ('code_entry', 'qr_scan', 'invite_link', 'admin_invite')),
  created_at timestamptz not null default now()
);

-- 2.59 UNASSIGNED USER SESSIONS
CREATE TABLE public.unassigned_user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_start timestamptz not null default now(),
  session_end timestamptz,
  content_views jsonb default '{}',
  code_entry_attempts integer default 0,
  assigned_at timestamptz,
  assigned_via text check (assigned_via in ('code_entry', 'qr_scan', 'invite_link', 'admin_invite')),
  time_to_assignment_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.60 FEATURE FLAGS
CREATE TABLE public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  label text not null,
  description text,
  category text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.61 DATA EXPORT REQUESTS
CREATE TABLE public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id),
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  export_data jsonb,
  error_message text
);


-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_photographer_code ON public.user_profiles(photographer_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_biometric ON public.user_profiles(biometric_enabled) WHERE biometric_enabled = true;
CREATE INDEX IF NOT EXISTS idx_user_profiles_pin ON public.user_profiles(id) WHERE pin_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_owner_admin ON public.clients(owner_admin_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);

CREATE INDEX IF NOT EXISTS idx_galleries_owner ON public.galleries(owner_admin_id);
CREATE INDEX IF NOT EXISTS idx_galleries_client ON public.galleries(client_id);
CREATE INDEX IF NOT EXISTS idx_galleries_access_code ON public.galleries(access_code);
CREATE INDEX IF NOT EXISTS idx_galleries_client_phone ON public.galleries(client_phone);
CREATE INDEX IF NOT EXISTS idx_galleries_created_by_admin ON public.galleries(created_by_admin_id);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_gallery_id ON public.gallery_photos(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_upload_order ON public.gallery_photos(upload_order);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_no_optimized ON public.gallery_photos(gallery_id) WHERE optimized_photo_url IS NULL;

CREATE INDEX IF NOT EXISTS idx_photos_gallery_id ON public.photos(gallery_id);
CREATE INDEX IF NOT EXISTS idx_photos_gallery_created_at ON public.photos(gallery_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_owner_admin ON public.messages(owner_admin_id);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_admin_client ON public.messages(owner_admin_id, client_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at desc);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON public.messages(client_id, sender_role, is_read);

CREATE INDEX IF NOT EXISTS idx_packages_owner ON public.packages(owner_admin_id);
CREATE INDEX IF NOT EXISTS idx_packages_category ON public.packages(category) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner_admin_id ON public.bookings(owner_admin_id);

CREATE INDEX IF NOT EXISTS idx_payments_owner ON public.payments(owner_admin_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_gallery ON public.payments(gallery_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_phone ON public.payments(client_phone);
CREATE UNIQUE INDEX IF NOT EXISTS payments_checkout_request_id_key ON public.payments(checkout_request_id) WHERE checkout_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_client_id ON public.notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_gallery_id ON public.notifications(gallery_id);
CREATE INDEX IF NOT EXISTS idx_notifications_access_code ON public.notifications(access_code);
CREATE INDEX IF NOT EXISTS idx_notifications_owner_admin_id ON public.notifications(owner_admin_id);

CREATE INDEX IF NOT EXISTS idx_sms_logs_owner ON public.sms_logs(owner_admin_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_client_phone ON public.sms_logs(client_phone);

CREATE INDEX IF NOT EXISTS idx_bts_posts_created_by ON public.bts_posts(created_by);
CREATE INDEX IF NOT EXISTS idx_bts_posts_visibility ON public.bts_posts(visibility);
CREATE INDEX IF NOT EXISTS idx_bts_posts_visibility_created_by ON public.bts_posts(visibility, created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);

CREATE INDEX IF NOT EXISTS idx_bts_comments_post_id ON public.bts_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_bts_likes_post_id ON public.bts_likes(post_id);
CREATE UNIQUE INDEX IF NOT EXISTS bts_likes_client_post_key ON public.bts_likes(client_id, post_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_items_admin_id ON public.portfolio_items(admin_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_featured ON public.portfolio_items(admin_id, is_featured);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_category ON public.portfolio_items(admin_id, category);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_order ON public.portfolio_items(admin_id, display_order);
CREATE INDEX IF NOT EXISTS idx_portfolio_comments_item ON public.portfolio_comments(portfolio_item_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_comments_user ON public.portfolio_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_events_photographer ON public.events(photographer_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_date_busy ON public.events(event_date, status) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_event_clients_client ON public.event_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_event_clients_event ON public.event_clients(event_id);

CREATE INDEX IF NOT EXISTS idx_reviews_photographer ON public.reviews(photographer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_gallery ON public.reviews(gallery_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_is_featured ON public.reviews(is_featured);

CREATE INDEX IF NOT EXISTS idx_gallery_shares_gallery_id ON public.gallery_shares(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_shares_client_id ON public.gallery_shares(client_id);

CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_gallery_id ON public.events(gallery_id);
CREATE INDEX IF NOT EXISTS idx_events_client_id ON public.events(client_id);

CREATE INDEX IF NOT EXISTS idx_storage_usage_admin_id ON public.storage_usage(admin_id);
CREATE UNIQUE INDEX IF NOT EXISTS storage_usage_admin_id_key ON public.storage_usage(admin_id);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_admin_id ON public.bulk_jobs(admin_id);
CREATE INDEX IF NOT EXISTS idx_greeting_schedules_admin_id ON public.greeting_schedules(admin_id);
CREATE INDEX IF NOT EXISTS idx_greeting_schedules_send_at ON public.greeting_schedules(send_at);

CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_admin_id ON public.admin_subscriptions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_checkout_request_id ON public.admin_subscriptions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_admin_subscriptions_status ON public.admin_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_photographer ON public.support_messages(photographer_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_unread ON public.support_messages(photographer_id, sender_role, is_read);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON public.support_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_category ON public.support_messages(category);
CREATE INDEX IF NOT EXISTS idx_support_messages_priority ON public.support_messages(priority) WHERE priority IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_messages_type ON public.support_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_support_channels_photographer ON public.support_channels(photographer_id);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_photographer ON public.notification_preferences(photographer_id);

CREATE INDEX IF NOT EXISTS idx_sms_purchases_admin ON public.sms_purchase_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sms_credits_admin ON public.sms_credits(admin_id);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_user ON public.fraud_flags(flagged_user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_status ON public.fraud_flags(status);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_severity ON public.fraud_flags(severity);

CREATE INDEX IF NOT EXISTS idx_client_assignment_client ON public.client_assignment_log(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assignment_admin ON public.client_assignment_log(admin_id);

CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_user_id ON public.unassigned_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_session_start ON public.unassigned_user_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_assigned_at ON public.unassigned_user_sessions(assigned_at);
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_active ON public.unassigned_user_sessions(user_id, session_start DESC) WHERE session_end IS NULL AND assigned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_assigned_at_time ON public.unassigned_user_sessions(assigned_at, time_to_assignment_seconds) WHERE assigned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_assigned_via ON public.unassigned_user_sessions(assigned_via) WHERE assigned_via IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unassigned_sessions_failed_attempts ON public.unassigned_user_sessions(code_entry_attempts, session_start) WHERE assigned_at IS NULL AND code_entry_attempts > 0;

CREATE INDEX IF NOT EXISTS idx_event_log_event_name ON public.event_log(event_name);
CREATE INDEX IF NOT EXISTS idx_event_log_gallery_id ON public.event_log(gallery_id);

CREATE UNIQUE INDEX IF NOT EXISTS payment_settings_active_admin_idx ON public.payment_settings(admin_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bts_bookmarks_user ON public.bts_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bts_bookmarks_bts ON public.bts_bookmarks(bts_id);
CREATE INDEX IF NOT EXISTS idx_announcement_bookmarks_user ON public.announcement_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_bookmarks_announcement ON public.announcement_bookmarks(announcement_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_bookmarks_user ON public.portfolio_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_bookmarks_item ON public.portfolio_bookmarks(portfolio_item_id);


-- ============================================
-- 4. ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bts_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bts_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bts_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bts_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watermark_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocked_galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_delivery_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_lifetime_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.greeting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_purchase_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_assignment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unassigned_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;


-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- === user_profiles ===
CREATE POLICY "Admins can view all profiles" ON public.user_profiles FOR SELECT
  USING (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') in ('admin', 'super_admin'));
CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_update_own_security_settings" ON public.user_profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- === clients ===
CREATE POLICY "Admins can manage their own clients" ON public.clients FOR ALL USING (auth.uid() = owner_admin_id);
CREATE POLICY "Clients can view their own record" ON public.clients FOR SELECT USING (auth.uid() = user_id);

-- === galleries ===
CREATE POLICY "Admins can manage their own galleries" ON public.galleries FOR ALL USING (auth.uid() = owner_admin_id);
CREATE POLICY "Clients can view their galleries" ON public.galleries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.clients WHERE public.clients.id = public.galleries.client_id AND public.clients.user_id = auth.uid())
);

-- === gallery_photos ===
CREATE POLICY "Gallery owners can manage their photos" ON public.gallery_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.galleries g WHERE g.id = gallery_photos.gallery_id AND g.owner_admin_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.galleries g WHERE g.id = gallery_photos.gallery_id AND g.owner_admin_id = auth.uid()));
CREATE POLICY "Super admins can manage all photos" ON public.gallery_photos FOR ALL
  USING (auth.uid() IN (SELECT up.id FROM public.user_profiles up WHERE up.role IN ('admin', 'super_admin')))
  WITH CHECK (auth.uid() IN (SELECT up.id FROM public.user_profiles up WHERE up.role IN ('admin', 'super_admin')));
CREATE POLICY "Clients can view their photos" ON public.gallery_photos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.galleries g WHERE g.id = gallery_photos.gallery_id AND g.client_id IN (SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid())));

-- === photos ===
CREATE POLICY "Admins can manage photos" ON public.photos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.galleries g WHERE g.id = photos.gallery_id AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.galleries g WHERE g.id = photos.gallery_id AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())));

-- === messages ===
CREATE POLICY "Admins can view own messages" ON public.messages FOR SELECT TO authenticated
  USING (owner_admin_id = auth.uid() OR (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) = 'super_admin');
CREATE POLICY "Admins can insert messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_role = 'admin' AND owner_admin_id = auth.uid() AND (SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1) IN ('admin', 'super_admin'));
CREATE POLICY "Admins can update own messages" ON public.messages FOR UPDATE TO authenticated USING (owner_admin_id = auth.uid());
CREATE POLICY "Clients can view their messages" ON public.messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'client') AND client_id = auth.uid());
CREATE POLICY "Clients can insert their messages" ON public.messages FOR INSERT
  WITH CHECK (sender_role = 'client' AND client_id = auth.uid());

-- === packages ===
CREATE POLICY "Admins can manage their packages" ON public.packages FOR ALL USING (auth.uid() = owner_admin_id);
CREATE POLICY "Clients can view active packages" ON public.packages FOR SELECT USING (is_active = true);

-- === bookings ===
CREATE POLICY "Clients can view their own bookings" ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role in ('admin', 'super_admin')));
CREATE POLICY "Clients can create their own bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update any booking" ON public.bookings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role in ('admin', 'super_admin')));

-- === payments ===
CREATE POLICY "Admins can view payments for them" ON public.payments FOR SELECT USING (auth.uid() = owner_admin_id);
CREATE POLICY "Clients can view their own payments" ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients WHERE public.clients.id = public.payments.client_id AND public.clients.user_id = auth.uid()));

-- === notifications ===
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Clients can view notifications by client id" ON public.notifications FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = notifications.client_id AND c.user_id = auth.uid()));
CREATE POLICY "Clients can update notifications by client id" ON public.notifications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = notifications.client_id AND c.user_id = auth.uid()));
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')));

-- === sms_logs ===
CREATE POLICY "Admins can view their SMS logs" ON public.sms_logs FOR SELECT USING (auth.uid() = owner_admin_id);

-- === admin_resources ===
CREATE POLICY "Admins can view own resources" ON public.admin_resources FOR SELECT USING (auth.uid() = admin_id);

-- === audit_logs ===
CREATE POLICY "Admins can view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = actor_id);

-- === analytics_events ===
CREATE POLICY "Users can insert events" ON public.analytics_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- === admin_settings ===
CREATE POLICY "Admins can manage their settings" ON public.admin_settings FOR ALL USING (auth.uid() = admin_id);

-- === bts_posts ===
CREATE POLICY "Admins can manage their BTS" ON public.bts_posts FOR ALL USING (auth.uid() = admin_id OR auth.uid() = owner_admin_id OR auth.uid() = created_by);
CREATE POLICY "Anyone can view global BTS" ON public.bts_posts FOR SELECT USING (visibility IN ('global', 'admin_only'));
CREATE POLICY "Clients can view assigned BTS" ON public.bts_posts FOR SELECT USING (
  visibility = 'assigned_only' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = auth.uid() AND c.owner_admin_id = bts_posts.created_by)
);

-- === announcements ===
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL USING (auth.uid() = created_by_admin OR auth.uid() = created_by OR auth.uid() = owner_admin_id);
CREATE POLICY "Anyone can view active announcements" ON public.announcements FOR SELECT USING (is_active = true AND is_published = true);

-- === bts_comments ===
CREATE POLICY "Anyone can view BTS comments" ON public.bts_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert BTS comments" ON public.bts_comments FOR INSERT WITH CHECK (auth.uid() = client_id);

-- === announcement_comments ===
CREATE POLICY "Anyone can view announcement comments" ON public.announcement_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert announcement comments" ON public.announcement_comments FOR INSERT WITH CHECK (auth.uid() = client_id);

-- === bts_likes ===
CREATE POLICY "Users can view own likes" ON public.bts_likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own likes" ON public.bts_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.bts_likes FOR DELETE USING (auth.uid() = user_id);

-- === bts_bookmarks ===
CREATE POLICY "Users can view own bts bookmarks" ON public.bts_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bts bookmarks" ON public.bts_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bts bookmarks" ON public.bts_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- === announcement_bookmarks ===
CREATE POLICY "Users can view own announcement bookmarks" ON public.announcement_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own announcement bookmarks" ON public.announcement_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own announcement bookmarks" ON public.announcement_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- === portfolio_items ===
CREATE POLICY "admin_manage_portfolio" ON public.portfolio_items FOR ALL USING (admin_id = auth.uid() OR owner_admin_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "public_view_portfolio" ON public.portfolio_items FOR SELECT USING (true);

-- === portfolio_bookmarks ===
CREATE POLICY "Users can view own portfolio bookmarks" ON public.portfolio_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolio bookmarks" ON public.portfolio_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio bookmarks" ON public.portfolio_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- === portfolio_comments ===
CREATE POLICY "Users can view portfolio comments" ON public.portfolio_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert portfolio comments" ON public.portfolio_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolio comments" ON public.portfolio_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio comments" ON public.portfolio_comments FOR DELETE USING (auth.uid() = user_id);

-- === events ===
CREATE POLICY "Photographers can view their own events" ON public.events FOR SELECT USING (auth.uid() = photographer_id);
CREATE POLICY "Photographers can create their own events" ON public.events FOR INSERT WITH CHECK (auth.uid() = photographer_id);
CREATE POLICY "Photographers can update their own events" ON public.events FOR UPDATE USING (auth.uid() = photographer_id);
CREATE POLICY "Photographers can delete their own events" ON public.events FOR DELETE USING (auth.uid() = photographer_id);
CREATE POLICY "Admins can view events" ON public.events FOR SELECT USING (admin_id = auth.uid());
CREATE POLICY "Clients can view their events" ON public.events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = events.client_id AND c.user_id = auth.uid()));

-- === event_clients ===
CREATE POLICY "Admins manage event_clients" ON public.event_clients FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = event_clients.event_id AND events.photographer_id = auth.uid()));
CREATE POLICY "Clients view own event assignments" ON public.event_clients FOR SELECT USING (client_id = auth.uid());

-- === event_reminders ===
CREATE POLICY "Photographers can view reminders for their events" ON public.event_reminders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = event_reminders.event_id AND events.photographer_id = auth.uid()));
CREATE POLICY "System can create reminders" ON public.event_reminders FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update reminders" ON public.event_reminders FOR UPDATE USING (true);

-- === reviews ===
CREATE POLICY "Anyone can view public reviews" ON public.reviews FOR SELECT USING (is_public = true);
CREATE POLICY "Photographers can view their own reviews" ON public.reviews FOR SELECT USING (auth.uid() = photographer_id);
CREATE POLICY "Clients can create reviews" ON public.reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Photographers can update their own reviews" ON public.reviews FOR UPDATE USING (auth.uid() = photographer_id);

-- === watermark_settings ===
CREATE POLICY "Photographers can manage their own watermark" ON public.watermark_settings FOR ALL USING (auth.uid() = photographer_id);

-- === gallery_shares ===
CREATE POLICY "Clients can manage their shares" ON public.gallery_shares FOR ALL
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = gallery_shares.client_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = gallery_shares.client_id AND c.user_id = auth.uid()));

-- === unlocked_galleries ===
CREATE POLICY "Users can view their unlocked galleries" ON public.unlocked_galleries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can unlock galleries" ON public.unlocked_galleries FOR INSERT WITH CHECK (auth.uid() = user_id);

-- === gallery_views ===
CREATE POLICY "Users can view their gallery views" ON public.gallery_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all gallery views" ON public.gallery_views FOR SELECT
  USING (EXISTS (SELECT 1 FROM galleries WHERE galleries.id = gallery_views.gallery_id AND galleries.owner_admin_id = auth.uid()));
CREATE POLICY "Users can insert gallery views" ON public.gallery_views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert gallery views" ON public.gallery_views FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- === gallery_delivery_status ===
CREATE POLICY "Admins can view delivery status" ON public.gallery_delivery_status FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients WHERE public.clients.id = public.gallery_delivery_status.client_id AND public.clients.owner_admin_id = auth.uid()));

-- === upload_sessions ===
CREATE POLICY "Admins can manage upload sessions" ON public.upload_sessions FOR ALL USING (auth.uid() = admin_id) WITH CHECK (auth.uid() = admin_id);

-- === upload_logs ===
CREATE POLICY "Admins can manage upload logs" ON public.upload_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.galleries g WHERE g.id = upload_logs.gallery_id AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.galleries g WHERE g.id = upload_logs.gallery_id AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())));

-- === photo_processing_jobs ===
CREATE POLICY "Admins can manage photo processing jobs" ON public.photo_processing_jobs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.photos p JOIN public.galleries g ON g.id = p.gallery_id WHERE p.id = photo_processing_jobs.photo_id AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.photos p JOIN public.galleries g ON g.id = p.gallery_id WHERE p.id = photo_processing_jobs.photo_id AND (g.created_by_admin_id = auth.uid() OR g.owner_admin_id = auth.uid())));

-- === payment_settings ===
CREATE POLICY "Admins can manage payment settings" ON public.payment_settings FOR ALL USING (auth.uid() = admin_id) WITH CHECK (auth.uid() = admin_id);

-- === mpesa_transactions ===
CREATE POLICY "Admins view all transactions" ON public.mpesa_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Clients view their own transactions" ON public.mpesa_transactions FOR SELECT USING (auth.uid() = client_id);

-- === mpesa_logs ===
CREATE POLICY "Admins view logs" ON public.mpesa_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- === event_log ===
CREATE POLICY "Admins can view their events" ON public.event_log FOR SELECT USING (admin_id = auth.uid());

-- === storage_usage ===
CREATE POLICY "Admins can manage storage usage" ON public.storage_usage FOR ALL USING (auth.uid() = admin_id) WITH CHECK (auth.uid() = admin_id);

-- === client_lifetime_stats ===
CREATE POLICY "Clients can view lifetime stats" ON public.client_lifetime_stats FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_lifetime_stats.client_id AND c.user_id = auth.uid()));
CREATE POLICY "Admins can view lifetime stats" ON public.client_lifetime_stats FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_lifetime_stats.client_id AND c.owner_admin_id = auth.uid()));

-- === bulk_jobs ===
CREATE POLICY "Admins can manage bulk jobs" ON public.bulk_jobs FOR ALL USING (auth.uid() = admin_id) WITH CHECK (auth.uid() = admin_id);

-- === greeting_schedules ===
CREATE POLICY "Admins can manage greetings" ON public.greeting_schedules FOR ALL USING (auth.uid() = admin_id) WITH CHECK (auth.uid() = admin_id);

-- === platform_settings ===
CREATE POLICY "super_admin_manage_platform_settings" ON public.platform_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "authenticated_read_platform_settings" ON public.platform_settings FOR SELECT USING (auth.role() = 'authenticated');

-- === admin_subscriptions ===
CREATE POLICY "Admins can view own subscriptions" ON public.admin_subscriptions FOR SELECT TO authenticated USING (admin_id = auth.uid());
CREATE POLICY "Service role can manage subscriptions" ON public.admin_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- === admin_audit_log ===
CREATE POLICY "Admins can view own audit log" ON public.admin_audit_log FOR SELECT TO authenticated USING (admin_id = auth.uid());
CREATE POLICY "Service role can manage audit log" ON public.admin_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can insert own audit entries" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (admin_id = auth.uid());

-- === support_messages ===
CREATE POLICY "photographer_own_support_messages" ON public.support_messages FOR ALL USING (photographer_id = auth.uid());
CREATE POLICY "super_admin_all_support_messages" ON public.support_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "admin_own_support_messages" ON public.support_messages FOR UPDATE USING (photographer_id = auth.uid());

-- === support_channels ===
CREATE POLICY "Admins manage own support channel" ON public.support_channels FOR ALL USING (auth.uid() = photographer_id);

-- === notification_preferences ===
CREATE POLICY "Admins manage own notification prefs" ON public.notification_preferences FOR ALL USING (auth.uid() = photographer_id);

-- === sms_credit_packages ===
CREATE POLICY "Super admin manages credit packages" ON public.sms_credit_packages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Anyone can view active credit packages" ON public.sms_credit_packages FOR SELECT USING (is_active = true);

-- === sms_purchase_transactions ===
CREATE POLICY "Admins view own purchases" ON public.sms_purchase_transactions FOR SELECT USING (auth.uid() = admin_id);
CREATE POLICY "Admins insert own purchases" ON public.sms_purchase_transactions FOR INSERT WITH CHECK (auth.uid() = admin_id);

-- === sms_credits ===
CREATE POLICY "Admins view own credits" ON public.sms_credits FOR SELECT USING (auth.uid() = admin_id);

-- === platform_payment_settings ===
CREATE POLICY "super_admin_manage_payment_settings" ON public.platform_payment_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- === fraud_flags ===
CREATE POLICY "super_admin_manage_flags" ON public.fraud_flags FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- === client_assignment_log ===
CREATE POLICY "admins_view_own_assignments" ON public.client_assignment_log FOR SELECT
  USING (admin_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- === unassigned_user_sessions ===
CREATE POLICY "Super admins can view all unassigned sessions" ON public.unassigned_user_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Users can view own unassigned sessions" ON public.unassigned_user_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can insert unassigned sessions" ON public.unassigned_user_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "System can update unassigned sessions" ON public.unassigned_user_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- === feature_flags ===
CREATE POLICY "Anyone can read feature flags" ON public.feature_flags FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Super admin can manage feature flags" ON public.feature_flags FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- === data_export_requests ===
CREATE POLICY "Users can view own export requests" ON public.data_export_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create export requests" ON public.data_export_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can update export requests" ON public.data_export_requests FOR UPDATE USING (true);


-- ============================================
-- 6. STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('client-photos', 'client-photos', false, 52428800, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('thumbnails', 'thumbnails', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('bts-media', 'bts-media', true, 104857600, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('brand-assets', 'brand-assets', true, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('portfolio', 'portfolio', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('package-images', 'package-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('support-media', 'support-media', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- 7. STORAGE POLICIES
-- ============================================

-- client-photos
CREATE POLICY "Admins can upload client photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-photos' AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can read their client photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-photos' AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can update client photos" ON storage.objects FOR UPDATE
  USING (bucket_id = 'client-photos' AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
  WITH CHECK (bucket_id = 'client-photos' AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins can delete client photos" ON storage.objects FOR DELETE
  USING (bucket_id = 'client-photos' AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Clients can read their own gallery photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-photos' AND (
    EXISTS (SELECT 1 FROM clients c JOIN galleries g ON g.client_id = c.id WHERE c.user_id = auth.uid() AND (storage.foldername(storage.objects.name))[2] = g.id::text)
    OR EXISTS (SELECT 1 FROM unlocked_galleries ug JOIN galleries g ON g.id = ug.gallery_id WHERE ug.user_id = auth.uid() AND (storage.foldername(storage.objects.name))[2] = g.id::text)
  ));

-- thumbnails
CREATE POLICY "Admins can upload thumbnails" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thumbnails' AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Clients can read their own thumbnails" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'thumbnails' AND (
    EXISTS (SELECT 1 FROM clients c JOIN galleries g ON g.client_id = c.id WHERE c.user_id = auth.uid() AND (storage.foldername(storage.objects.name))[2] = g.id::text)
    OR EXISTS (SELECT 1 FROM unlocked_galleries ug JOIN galleries g ON g.id = ug.gallery_id WHERE ug.user_id = auth.uid() AND (storage.foldername(storage.objects.name))[2] = g.id::text)
  ));

-- avatars
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
CREATE POLICY "Avatars are publicly readable" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

-- bts-media
CREATE POLICY "Admins can upload BTS media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bts-media' AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "BTS media is publicly readable" ON storage.objects FOR SELECT TO public USING (bucket_id = 'bts-media');

-- brand-assets
CREATE POLICY "Admins can upload brand assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-assets' AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Brand assets are publicly readable" ON storage.objects FOR SELECT TO public USING (bucket_id = 'brand-assets');

-- portfolio
CREATE POLICY "admin_upload_portfolio" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'portfolio' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
CREATE POLICY "admin_read_portfolio" ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
CREATE POLICY "admin_update_portfolio" ON storage.objects FOR UPDATE
  USING (bucket_id = 'portfolio' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
CREATE POLICY "admin_delete_portfolio" ON storage.objects FOR DELETE
  USING (bucket_id = 'portfolio' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);

-- package-images
CREATE POLICY "Admins can upload package images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'package-images' AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Anyone can view package images" ON storage.objects FOR SELECT USING (bucket_id = 'package-images');
CREATE POLICY "Admins can delete package images" ON storage.objects FOR DELETE
  USING (bucket_id = 'package-images' AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- support-media
CREATE POLICY "support_media_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'support-media' AND auth.uid() IS NOT NULL);
CREATE POLICY "support_media_read" ON storage.objects FOR SELECT USING (bucket_id = 'support-media');


-- ============================================
-- 8. FUNCTIONS
-- ============================================

-- 8.1 Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8.2 Validate profile completeness
CREATE OR REPLACE FUNCTION public.validate_profile_completeness()
RETURNS trigger AS $$
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

DROP TRIGGER IF EXISTS validate_profile_completeness_trigger ON public.user_profiles;
CREATE TRIGGER validate_profile_completeness_trigger
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.validate_profile_completeness();

-- 8.3 Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_settings_updated_at BEFORE UPDATE ON public.payment_settings FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_mpesa_transactions_updated_at BEFORE UPDATE ON public.mpesa_transactions FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_watermark_settings_updated_at BEFORE UPDATE ON public.watermark_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8.4 Photographer code functions
CREATE OR REPLACE FUNCTION public.validate_photographer_code(p_code TEXT)
RETURNS TABLE (admin_id UUID, admin_name TEXT, admin_email TEXT) AS $$
BEGIN
  RETURN QUERY SELECT id as admin_id, name as admin_name, email as admin_email
  FROM user_profiles WHERE photographer_code = UPPER(p_code) AND role IN ('admin', 'super_admin') LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.assign_client_to_photographer(p_client_id UUID, p_photographer_code TEXT)
RETURNS JSONB AS $$
DECLARE v_admin_id UUID; v_admin_name TEXT;
BEGIN
  SELECT admin_id, admin_name INTO v_admin_id, v_admin_name FROM validate_photographer_code(p_photographer_code);
  IF v_admin_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid photographer code'); END IF;
  UPDATE clients SET owner_admin_id = v_admin_id WHERE user_id = p_client_id;
  IF NOT FOUND THEN INSERT INTO clients (user_id, owner_admin_id) VALUES (p_client_id, v_admin_id) ON CONFLICT (user_id) DO UPDATE SET owner_admin_id = v_admin_id; END IF;
  RETURN jsonb_build_object('success', true, 'admin_id', v_admin_id, 'admin_name', v_admin_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.5 Subscription functions
CREATE OR REPLACE FUNCTION public.is_admin_subscription_active(p_admin_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_role TEXT; v_is_lifetime BOOLEAN; v_status TEXT; v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT role, is_lifetime, subscription_status, subscription_expires_at INTO v_role, v_is_lifetime, v_status, v_expires_at FROM user_profiles WHERE id = p_admin_id;
  IF v_role = 'super_admin' THEN RETURN true; END IF;
  IF v_is_lifetime = true THEN RETURN true; END IF;
  IF v_status = 'active' AND v_expires_at > NOW() THEN RETURN true; END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_admin_subscription(p_admin_id UUID, p_checkout_request_id TEXT, p_mpesa_transaction_id TEXT, p_amount INTEGER DEFAULT 500)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_period_start TIMESTAMPTZ; v_period_end TIMESTAMPTZ; v_sub_id UUID;
BEGIN
  v_period_start := NOW(); v_period_end := NOW() + INTERVAL '30 days';
  UPDATE admin_subscriptions SET status = 'success', mpesa_transaction_id = p_mpesa_transaction_id, period_start = v_period_start, period_end = v_period_end, updated_at = NOW()
  WHERE checkout_request_id = p_checkout_request_id AND admin_id = p_admin_id AND status = 'pending' RETURNING id INTO v_sub_id;
  UPDATE user_profiles SET subscription_status = 'active', subscription_expires_at = v_period_end WHERE id = p_admin_id;
  INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, metadata)
  VALUES (p_admin_id, 'subscription_activated', 'admin_subscriptions', v_sub_id::text, jsonb_build_object('amount', p_amount, 'period_start', v_period_start, 'period_end', v_period_end, 'mpesa_transaction_id', p_mpesa_transaction_id));
  RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id, 'expires_at', v_period_end);
END;
$$;

-- 8.6 Upload session functions
CREATE OR REPLACE FUNCTION public.init_upload_session(admin_id uuid, client_id uuid, gallery_name text, total_files integer, estimated_total_size bigint DEFAULT NULL)
RETURNS TABLE(session_id uuid, access_code text, gallery_id uuid, parallel_upload_limit integer) LANGUAGE plpgsql AS $$
DECLARE v_session_id uuid; v_gallery_id uuid; v_access_code text; v_attempt int; v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; v_owner uuid;
BEGIN
  SELECT owner_admin_id INTO v_owner FROM public.clients WHERE id = client_id;
  IF v_owner IS NULL OR v_owner <> admin_id THEN RAISE EXCEPTION 'CLIENT_FORBIDDEN'; END IF;
  INSERT INTO public.upload_sessions (admin_id, status, total_files, estimated_total_size) VALUES (admin_id, 'initializing', total_files, estimated_total_size) RETURNING id INTO v_session_id;
  FOR v_attempt IN 1..10 LOOP
    SELECT string_agg(substr(v_chars, (floor(random() * length(v_chars)) + 1)::int, 1), '') INTO v_access_code FROM generate_series(1, 6);
    IF NOT EXISTS (SELECT 1 FROM public.galleries WHERE access_code = v_access_code) THEN
      INSERT INTO public.galleries (owner_admin_id, created_by_admin_id, client_id, name, access_code, is_locked, is_paid, price, status, is_active, upload_status, expected_file_count, estimated_total_size)
      VALUES (admin_id, admin_id, client_id, gallery_name, v_access_code, true, false, 0, 'locked', false, 'pending', total_files, estimated_total_size) RETURNING id INTO v_gallery_id;
      UPDATE public.upload_sessions SET gallery_id = v_gallery_id WHERE id = v_session_id;
      RETURN QUERY SELECT v_session_id, v_access_code, v_gallery_id, 5; RETURN;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'ACCESS_CODE_GENERATION_FAILED';
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_upload_session(session_id uuid, uploaded_delta integer, failed_delta integer, new_status text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.upload_sessions SET uploaded_files = uploaded_files + uploaded_delta, failed_files = failed_files + failed_delta, status = COALESCE(new_status, status) WHERE id = session_id;
END;
$$;

-- 8.7 Complete upload session
CREATE OR REPLACE FUNCTION public.complete_upload_session(session_id uuid)
RETURNS TABLE(gallery_id uuid, uploaded_files integer, failed_files integer, total_files integer) LANGUAGE plpgsql AS $$
DECLARE v_gallery_id uuid; v_uploaded integer; v_failed integer; v_total integer; v_client_id uuid; v_client_name text; v_owner_admin_id uuid; v_bytes bigint;
BEGIN
  SELECT gallery_id, uploaded_files, failed_files, total_files INTO v_gallery_id, v_uploaded, v_failed, v_total FROM public.upload_sessions WHERE id = session_id FOR UPDATE;
  IF v_gallery_id IS NULL THEN RAISE EXCEPTION 'SESSION_GALLERY_MISSING'; END IF;
  IF v_uploaded + v_failed < v_total THEN RAISE EXCEPTION 'UPLOADS_INCOMPLETE'; END IF;
  UPDATE public.galleries SET total_photos = v_uploaded, is_active = CASE WHEN release_at IS NULL OR release_at <= now() THEN is_active ELSE false END, is_locked_until_release = CASE WHEN release_at IS NULL OR release_at <= now() THEN false ELSE true END WHERE id = v_gallery_id RETURNING owner_admin_id INTO v_owner_admin_id;
  SELECT COALESCE(SUM(file_size), 0) INTO v_bytes FROM public.photos WHERE gallery_id = v_gallery_id AND upload_status = 'uploaded';
  INSERT INTO public.storage_usage (admin_id, total_bytes_used, total_galleries, total_photos, updated_at) VALUES (v_owner_admin_id, v_bytes, 1, v_uploaded, now()) ON CONFLICT (admin_id) DO UPDATE SET total_bytes_used = public.storage_usage.total_bytes_used + EXCLUDED.total_bytes_used, total_galleries = public.storage_usage.total_galleries + EXCLUDED.total_galleries, total_photos = public.storage_usage.total_photos + EXCLUDED.total_photos, updated_at = now();
  UPDATE public.upload_sessions SET status = 'completed' WHERE id = session_id;
  SELECT client_id, client_name INTO v_client_id, v_client_name FROM public.galleries WHERE id = v_gallery_id;
  IF v_client_id IS NOT NULL THEN
    PERFORM public.create_client_notification(v_client_id, v_gallery_id, 'upload', 'Your Photos Are Ready', COALESCE('Hello ' || v_client_name || ', your photos are ready.', 'Your photos are ready.'));
    PERFORM public.emit_event('GALLERY_UPLOADED', jsonb_build_object('gallery_id', v_gallery_id, 'client_id', v_client_id), v_gallery_id, v_client_id, NULL);
    INSERT INTO public.client_lifetime_stats (client_id, total_galleries, total_paid_amount, updated_at) VALUES (v_client_id, 1, 0, now()) ON CONFLICT (client_id) DO UPDATE SET total_galleries = public.client_lifetime_stats.total_galleries + 1, updated_at = now();
  END IF;
  RETURN QUERY SELECT v_gallery_id, v_uploaded, v_failed, v_total;
END;
$$;

-- 8.8 Photo auto-unlock on payment
CREATE OR REPLACE FUNCTION public.unlock_photos_on_payment()
RETURNS TRIGGER AS $$
DECLARE v_gallery_id UUID; v_client_id UUID; v_photo_count INTEGER;
BEGIN
  IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
    v_gallery_id := NEW.gallery_id; v_client_id := NEW.client_id;
    UPDATE gallery_photos SET is_locked = FALSE, unlocked_at = NOW() WHERE gallery_id = v_gallery_id AND is_locked = TRUE;
    GET DIAGNOSTICS v_photo_count = ROW_COUNT;
    UPDATE galleries SET payment_status = 'paid', paid_at = NOW(), payment_amount = NEW.amount WHERE id = v_gallery_id;
    INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, metadata)
    SELECT g.owner_admin_id, 'photos_unlocked', 'gallery', v_gallery_id, jsonb_build_object('gallery_id', v_gallery_id, 'client_id', v_client_id, 'payment_id', NEW.id, 'amount', NEW.amount, 'photos_unlocked', v_photo_count) FROM galleries g WHERE g.id = v_gallery_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unlock_photos ON public.payments;
CREATE TRIGGER trigger_unlock_photos AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW WHEN (NEW.status = 'success') EXECUTE FUNCTION public.unlock_photos_on_payment();

-- 8.9 Handle payment refund
CREATE OR REPLACE FUNCTION public.lock_gallery_on_refund(p_payment_id UUID) RETURNS VOID AS $$
DECLARE v_gallery_id UUID;
BEGIN
  SELECT gallery_id INTO v_gallery_id FROM payments WHERE id = p_payment_id;
  IF v_gallery_id IS NOT NULL THEN
    UPDATE gallery_photos SET is_locked = TRUE, unlocked_at = NULL WHERE gallery_id = v_gallery_id;
    UPDATE galleries SET payment_status = 'refunded', paid_at = NULL WHERE id = v_gallery_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_payment_refund() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'refunded' OR NEW.status = 'cancelled') AND OLD.status = 'paid' THEN PERFORM lock_gallery_on_refund(NEW.id); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_refund ON public.payments;
CREATE TRIGGER trigger_payment_refund AFTER UPDATE ON public.payments FOR EACH ROW WHEN (NEW.status IN ('refunded', 'cancelled')) EXECUTE FUNCTION public.handle_payment_refund();

-- 8.10 Client assignment trigger
CREATE OR REPLACE FUNCTION public.log_client_assignment() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_admin_id IS NOT NULL AND (OLD.owner_admin_id IS NULL OR OLD.owner_admin_id != NEW.owner_admin_id) THEN
    INSERT INTO client_assignment_log (client_id, admin_id, photographer_code, assigned_via)
    SELECT NEW.user_id, NEW.owner_admin_id, up.photographer_code, 'code_entry' FROM user_profiles up WHERE up.id = NEW.owner_admin_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_client_assignment ON public.clients;
CREATE TRIGGER trigger_log_client_assignment AFTER UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_client_assignment();

-- 8.11 Close unassigned session on assignment
CREATE OR REPLACE FUNCTION public.close_unassigned_session_on_assignment() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_session_start TIMESTAMPTZ;
BEGIN
  IF OLD.owner_admin_id IS NULL AND NEW.owner_admin_id IS NOT NULL THEN
    SELECT session_start INTO v_session_start FROM public.unassigned_user_sessions WHERE user_id = NEW.user_id AND session_end IS NULL AND assigned_at IS NULL ORDER BY session_start DESC LIMIT 1;
    IF v_session_start IS NOT NULL THEN
      UPDATE public.unassigned_user_sessions SET session_end = NOW(), assigned_at = NOW(), assigned_via = COALESCE((SELECT assigned_via FROM public.client_assignment_log WHERE client_id = NEW.id ORDER BY created_at DESC LIMIT 1), 'unknown'), time_to_assignment_seconds = EXTRACT(EPOCH FROM (NOW() - session_start))::INTEGER, updated_at = NOW() WHERE user_id = NEW.user_id AND session_start = v_session_start AND session_end IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_close_unassigned_session ON public.clients;
CREATE TRIGGER trigger_close_unassigned_session AFTER UPDATE ON public.clients FOR EACH ROW WHEN (OLD.owner_admin_id IS DISTINCT FROM NEW.owner_admin_id) EXECUTE FUNCTION public.close_unassigned_session_on_assignment();

-- 8.12 Notification triggers
CREATE OR REPLACE FUNCTION public.notify_gallery_published() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, client_id, title, body, type, data)
    SELECT c.user_id, NEW.client_id, 'Gallery Ready!', 'Your ' || COALESCE(NEW.shoot_type, 'photo') || ' gallery "' || COALESCE(NEW.name, 'Gallery') || '" is ready to view.', 'gallery', jsonb_build_object('galleryId', NEW.id, 'accessCode', NEW.access_code) FROM clients c WHERE c.id = NEW.client_id AND c.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_gallery_published ON galleries;
CREATE TRIGGER trg_gallery_published AFTER INSERT ON galleries FOR EACH ROW EXECUTE FUNCTION notify_gallery_published();

CREATE OR REPLACE FUNCTION public.notify_payment_received() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_paid = true AND (OLD.is_paid IS NULL OR OLD.is_paid = false) THEN
    INSERT INTO notifications (user_id, title, body, type, data) VALUES (NEW.owner_admin_id, 'Payment Received!', 'Client has paid KES ' || COALESCE(NEW.price::text, '0') || ' for gallery "' || COALESCE(NEW.name, 'Gallery') || '".', 'payment', jsonb_build_object('galleryId', NEW.id, 'amount', NEW.price));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_payment_received ON galleries;
CREATE TRIGGER trg_payment_received AFTER UPDATE ON galleries FOR EACH ROW WHEN (NEW.is_paid = true AND (OLD.is_paid IS NULL OR OLD.is_paid = false)) EXECUTE FUNCTION notify_payment_received();

CREATE OR REPLACE FUNCTION public.notify_review_received() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT NEW.photographer_id, 'New Review', 'You received a ' || NEW.rating || '-star review.', 'system', jsonb_build_object('reviewId', NEW.id, 'rating', NEW.rating) WHERE NEW.photographer_id IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_review_received ON reviews;
CREATE TRIGGER trg_review_received AFTER INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION notify_review_received();

CREATE OR REPLACE FUNCTION public.notify_support_reply() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_role = 'super_admin' THEN
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT sc.photographer_id, 'Support Reply', 'You have a new reply from support.', 'system', jsonb_build_object('channelId', NEW.channel_id) FROM support_channels sc WHERE sc.id = NEW.channel_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_support_reply ON support_messages;
CREATE TRIGGER trg_support_reply AFTER INSERT ON support_messages FOR EACH ROW EXECUTE FUNCTION notify_support_reply();

CREATE OR REPLACE FUNCTION public.notify_sms_low_balance() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance < 10 AND (OLD.balance IS NULL OR OLD.balance >= 10) THEN
    INSERT INTO notifications (user_id, title, body, type, data) VALUES (NEW.admin_id, 'SMS Credits Low', 'You have only ' || NEW.balance || ' SMS credits remaining.', 'system', jsonb_build_object('balance', NEW.balance));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sms_low_balance ON sms_credits;
CREATE TRIGGER trg_sms_low_balance AFTER UPDATE ON sms_credits FOR EACH ROW WHEN (NEW.balance < 10 AND (OLD.balance IS NULL OR OLD.balance >= 10)) EXECUTE FUNCTION notify_sms_low_balance();

CREATE OR REPLACE FUNCTION public.notify_package_update() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_active != NEW.is_active AND NEW.is_active = true) THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    SELECT up.id, CASE WHEN TG_OP = 'INSERT' THEN 'New Package Available!' ELSE 'Package Updated!' END, CASE WHEN TG_OP = 'INSERT' THEN 'A new photography package "' || NEW.name || '" is now available.' ELSE 'The package "' || NEW.name || '" has been updated.' END, 'package_update', jsonb_build_object('package_id', NEW.id, 'package_name', NEW.name, 'price', NEW.price) FROM public.user_profiles up WHERE up.role IN ('client', 'user');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_package_notification ON public.packages;
CREATE TRIGGER trigger_package_notification AFTER INSERT OR UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION notify_package_update();

-- 8.13 Comment count triggers
CREATE OR REPLACE FUNCTION public.decrement_bts_comment_count() RETURNS TRIGGER AS $$
BEGIN UPDATE bts_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.bts_id; RETURN OLD; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_bts_comment_delete ON bts_comments;
CREATE TRIGGER on_bts_comment_delete AFTER DELETE ON bts_comments FOR EACH ROW EXECUTE FUNCTION decrement_bts_comment_count();

CREATE OR REPLACE FUNCTION public.decrement_announcement_comment_count() RETURNS TRIGGER AS $$
BEGIN UPDATE announcements SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.announcement_id; RETURN OLD; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_announcement_comment_delete ON announcement_comments;
CREATE TRIGGER on_announcement_comment_delete AFTER DELETE ON announcement_comments FOR EACH ROW EXECUTE FUNCTION decrement_announcement_comment_count();

CREATE OR REPLACE FUNCTION public.decrement_portfolio_comment_count() RETURNS TRIGGER AS $$
BEGIN UPDATE portfolio_items SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.portfolio_item_id; RETURN OLD; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_portfolio_comment_delete ON portfolio_comments;
CREATE TRIGGER on_portfolio_comment_delete AFTER DELETE ON portfolio_comments FOR EACH ROW EXECUTE FUNCTION decrement_portfolio_comment_count();

-- 8.14 Portfolio and announcements updated_at triggers
CREATE OR REPLACE FUNCTION public.update_portfolio_items_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_portfolio_items_updated_at ON public.portfolio_items;
CREATE TRIGGER update_portfolio_items_updated_at BEFORE UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION update_portfolio_items_updated_at();

CREATE OR REPLACE FUNCTION public.update_announcements_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_announcements_updated_at ON public.announcements;
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION update_announcements_updated_at();

-- 8.15 Unassigned sessions updated_at trigger
CREATE OR REPLACE FUNCTION public.update_unassigned_sessions_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_update_unassigned_sessions_updated_at ON public.unassigned_user_sessions;
CREATE TRIGGER trigger_update_unassigned_sessions_updated_at BEFORE UPDATE ON public.unassigned_user_sessions FOR EACH ROW EXECUTE FUNCTION public.update_unassigned_sessions_updated_at();

-- 8.16 Event and helper functions
CREATE OR REPLACE FUNCTION public.emit_event(p_event_name text, p_payload jsonb, p_gallery_id uuid, p_client_id uuid, p_admin_id uuid)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.event_log (event_name, payload, gallery_id, client_id, admin_id) VALUES (p_event_name, p_payload, p_gallery_id, p_client_id, p_admin_id); END; $$;

CREATE OR REPLACE FUNCTION public.create_client_notification(p_client_id uuid, p_gallery_id uuid, p_type public.notification_kind, p_title text, p_message text)
RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE v_id uuid; BEGIN INSERT INTO public.notifications (client_id, gallery_id, notification_type, title, message, is_read) VALUES (p_client_id, p_gallery_id, p_type, p_title, p_message, false) RETURNING id INTO v_id; RETURN v_id; END; $$;

CREATE OR REPLACE FUNCTION public.record_event(p_event_type text, p_client_id uuid, p_gallery_id uuid, p_admin_id uuid, p_metadata jsonb)
RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE v_id uuid; BEGIN INSERT INTO public.events (event_type, client_id, gallery_id, admin_id, metadata) VALUES (p_event_type, p_client_id, p_gallery_id, p_admin_id, p_metadata) RETURNING id INTO v_id; RETURN v_id; END; $$;

CREATE OR REPLACE FUNCTION public.reserve_gallery_payment(p_gallery_id uuid, p_client_id uuid, p_client_phone text, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE v_payment_id uuid; v_owner_admin_id uuid; BEGIN PERFORM pg_advisory_xact_lock(hashtext(p_gallery_id::text)); IF EXISTS (SELECT 1 FROM public.payments WHERE gallery_id = p_gallery_id AND status = 'success') THEN RAISE EXCEPTION 'GALLERY_ALREADY_PAID'; END IF; SELECT owner_admin_id INTO v_owner_admin_id FROM public.galleries WHERE id = p_gallery_id; INSERT INTO public.payments (owner_admin_id, client_id, gallery_id, amount, currency, status, provider, client_phone, phone_number) VALUES (v_owner_admin_id, p_client_id, p_gallery_id, p_amount, 'KES', 'pending', 'mpesa', p_client_phone, p_client_phone) RETURNING id INTO v_payment_id; RETURN v_payment_id; END; $$;

CREATE OR REPLACE FUNCTION public.release_due_galleries() RETURNS integer LANGUAGE plpgsql AS $$ DECLARE v_updated integer; BEGIN UPDATE public.galleries SET is_active = true, is_locked_until_release = false WHERE release_at IS NOT NULL AND release_at <= now() AND is_paid = true AND is_active = false; GET DIAGNOSTICS v_updated = ROW_COUNT; RETURN v_updated; END; $$;

CREATE OR REPLACE FUNCTION public.update_delivery_status(p_gallery_id uuid, p_client_id uuid, p_field text, p_value boolean default null, p_timestamp timestamptz default null)
RETURNS void AS $$ BEGIN INSERT INTO public.gallery_delivery_status (gallery_id, client_id, sms_sent, notification_sent, gallery_viewed) VALUES (p_gallery_id, p_client_id, case when p_field = 'sms_sent' then coalesce(p_value, false) else false end, case when p_field = 'notification_sent' then coalesce(p_value, false) else false end, case when p_field = 'gallery_viewed' then coalesce(p_value, false) else false end) ON CONFLICT (gallery_id, client_id) DO UPDATE SET sms_sent = case when p_field = 'sms_sent' then coalesce(p_value, gallery_delivery_status.sms_sent) else gallery_delivery_status.sms_sent end, notification_sent = case when p_field = 'notification_sent' then coalesce(p_value, gallery_delivery_status.notification_sent) else gallery_delivery_status.notification_sent end, gallery_viewed = case when p_field = 'gallery_viewed' then coalesce(p_value, gallery_delivery_status.gallery_viewed) else gallery_delivery_status.gallery_viewed end, updated_at = now(); end; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.17 Feed functions
CREATE OR REPLACE FUNCTION public.increment_views(row_id UUID, table_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE format('UPDATE public.%I SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1', table_name) USING row_id; END; $$;

CREATE OR REPLACE FUNCTION public.increment_clicks(row_id UUID, table_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE format('UPDATE public.%I SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = $1', table_name) USING row_id; END; $$;

GRANT EXECUTE ON FUNCTION public.increment_views(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_clicks(UUID, TEXT) TO authenticated, anon;

-- 8.18 Gallery unlock and link
CREATE OR REPLACE FUNCTION public.unlock_gallery_for_user(p_gallery_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id uuid; BEGIN SELECT auth.uid() INTO v_user_id; IF v_user_id IS NULL THEN RETURN false; END IF; INSERT INTO public.unlocked_galleries (user_id, gallery_id) VALUES (v_user_id, p_gallery_id) ON CONFLICT (user_id, gallery_id) DO nothing; RETURN true; END;
$$;

CREATE OR REPLACE FUNCTION public.unlock_gallery_and_link(p_access_code TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id UUID; v_gallery galleries%ROWTYPE; v_client clients%ROWTYPE; v_phone TEXT;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT * INTO v_gallery FROM public.galleries WHERE UPPER(access_code) = UPPER(TRIM(p_access_code)) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Gallery not found for that access code'); END IF;
  IF v_gallery.client_id IS NOT NULL THEN
    SELECT * INTO v_client FROM public.clients WHERE id = v_gallery.client_id;
    IF FOUND AND v_client.user_id IS NULL THEN UPDATE public.clients SET user_id = v_user_id WHERE id = v_client.id; END IF;
    SELECT phone INTO v_phone FROM public.user_profiles WHERE id = v_user_id;
    IF v_phone IS NOT NULL THEN UPDATE public.clients SET user_id = v_user_id WHERE user_id IS NULL AND owner_admin_id IS NOT NULL AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(v_phone, '[^0-9]', '', 'g'); END IF;
  END IF;
  RETURN jsonb_build_object('success', true, 'gallery_id', v_gallery.id, 'gallery_name', v_gallery.name, 'is_locked', v_gallery.is_locked, 'is_paid', v_gallery.is_paid, 'price', v_gallery.price, 'client_id', v_gallery.client_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_by_phone(p_phone TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_profile user_profiles%ROWTYPE;
BEGIN SELECT * INTO v_profile FROM public.user_profiles WHERE REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g') LIMIT 1;
IF NOT FOUND THEN RETURN NULL; END IF; RETURN jsonb_build_object('id', v_profile.id, 'name', v_profile.name, 'avatar_url', v_profile.avatar_url, 'phone', v_profile.phone);
END;
$$;

-- 8.19 Security RPC functions
CREATE OR REPLACE FUNCTION public.update_biometric_setting(p_enabled BOOLEAN) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN UPDATE user_profiles SET biometric_enabled = p_enabled, updated_at = NOW() WHERE id = auth.uid(); IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF; RETURN jsonb_build_object('success', true); END; $$;
CREATE OR REPLACE FUNCTION public.set_pin_hash(p_pin_hash TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN UPDATE user_profiles SET pin_hash = p_pin_hash, updated_at = NOW() WHERE id = auth.uid(); IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF; RETURN jsonb_build_object('success', true); END; $$;
CREATE OR REPLACE FUNCTION public.remove_pin_lock() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN UPDATE user_profiles SET pin_hash = NULL, updated_at = NOW() WHERE id = auth.uid(); IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF; RETURN jsonb_build_object('success', true); END; $$;

GRANT EXECUTE ON FUNCTION public.update_biometric_setting(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pin_hash(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_pin_lock() TO authenticated;

-- 8.20 Auto-assign on login
CREATE OR REPLACE FUNCTION public.auto_assign_on_login(p_mobile_number TEXT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID; v_client_record RECORD; v_admin_name TEXT;
BEGIN
  v_user_id := auth.uid(); IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'auto_assigned', false, 'error', 'Not authenticated'); END IF;
  SELECT * INTO v_client_record FROM public.clients WHERE user_id = v_user_id LIMIT 1;
  IF v_client_record.owner_admin_id IS NOT NULL THEN SELECT name INTO v_admin_name FROM public.user_profiles WHERE id = v_client_record.owner_admin_id; RETURN jsonb_build_object('success', true, 'auto_assigned', false, 'admin_id', v_client_record.owner_admin_id, 'admin_name', v_admin_name, 'message', 'Already assigned'); END IF;
  SELECT * INTO v_client_record FROM public.clients WHERE (phone = p_mobile_number OR COALESCE(mobile_number, '') = p_mobile_number) AND owner_admin_id IS NOT NULL AND (user_id IS NULL OR user_id = v_user_id) ORDER BY created_at DESC LIMIT 1;
  IF v_client_record.id IS NULL THEN RETURN jsonb_build_object('success', true, 'auto_assigned', false, 'message', 'No matching client record found'); END IF;
  IF v_client_record.user_id IS NULL THEN UPDATE public.clients SET user_id = v_user_id, updated_at = NOW() WHERE id = v_client_record.id; END IF;
  INSERT INTO public.client_assignment_log (client_id, admin_id, photographer_code, assigned_via, created_at) SELECT v_client_record.id, v_client_record.owner_admin_id, COALESCE(up.photographer_code, ''), 'admin_invite', NOW() FROM public.user_profiles up WHERE up.id = v_client_record.owner_admin_id;
  SELECT name INTO v_admin_name FROM public.user_profiles WHERE id = v_client_record.owner_admin_id;
  RETURN jsonb_build_object('success', true, 'auto_assigned', true, 'admin_id', v_client_record.owner_admin_id, 'admin_name', v_admin_name, 'client_id', v_client_record.id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'auto_assigned', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_assign_on_login(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_needs_assignment() RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID; v_owner_admin_id UUID; BEGIN v_user_id := auth.uid(); IF v_user_id IS NULL THEN RETURN true; END IF; SELECT owner_admin_id INTO v_owner_admin_id FROM public.clients WHERE user_id = v_user_id LIMIT 1; RETURN (v_owner_admin_id IS NULL); EXCEPTION WHEN OTHERS THEN RETURN true; END;
$$;
GRANT EXECUTE ON FUNCTION public.client_needs_assignment() TO authenticated;

-- 8.21 Photo download optimization
CREATE OR REPLACE FUNCTION public.get_photo_download_url(p_photo_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID := auth.uid(); v_photo RECORD; v_gallery RECORD; v_photographer RECORD; v_use_original BOOLEAN; v_url TEXT;
BEGIN
  SELECT gp.id, gp.photo_url, gp.optimized_photo_url, gp.gallery_id INTO v_photo FROM public.gallery_photos gp WHERE gp.id = p_photo_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Photo not found'); END IF;
  SELECT g.id, g.owner_admin_id, g.is_paid, g.is_locked, g.client_id INTO v_gallery FROM public.galleries g WHERE g.id = v_photo.gallery_id;
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF v_gallery.owner_admin_id = v_user_id THEN RETURN jsonb_build_object('success', true, 'url', v_photo.photo_url, 'is_original', true); END IF;
  IF v_gallery.is_locked THEN RETURN jsonb_build_object('success', false, 'error', 'Gallery is locked'); END IF;
  SELECT allow_original_download INTO v_photographer FROM public.user_profiles WHERE id = v_gallery.owner_admin_id;
  v_use_original := COALESCE(v_photographer.allow_original_download, false);
  IF v_use_original THEN v_url := v_photo.photo_url; ELSE v_url := COALESCE(v_photo.optimized_photo_url, v_photo.photo_url); END IF;
  RETURN jsonb_build_object('success', true, 'url', v_url, 'is_original', v_use_original OR v_photo.optimized_photo_url IS NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_photo_download_url(UUID) TO authenticated;

-- 8.22 Super admin functions
CREATE OR REPLACE FUNCTION public.get_photographer_storage_metrics(p_admin_id UUID)
RETURNS TABLE (total_photos BIGINT, total_storage_bytes BIGINT, gallery_count BIGINT, avg_photo_size_bytes BIGINT) AS $$
BEGIN RETURN QUERY SELECT COUNT(gp.id)::BIGINT, COALESCE(SUM(gp.file_size), 0)::BIGINT, COUNT(DISTINCT g.id)::BIGINT, CASE WHEN COUNT(gp.id) > 0 THEN (COALESCE(SUM(gp.file_size), 0) / COUNT(gp.id))::BIGINT ELSE 0 END FROM galleries g LEFT JOIN gallery_photos gp ON gp.gallery_id = g.id WHERE g.owner_admin_id = p_admin_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.toggle_photographer_original_download(p_photographer_id UUID, p_allow BOOLEAN) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF; UPDATE user_profiles SET allow_original_download = p_allow WHERE id = p_photographer_id; RETURN FOUND; END; $$;
GRANT EXECUTE ON FUNCTION public.toggle_photographer_original_download(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.suspend_photographer(p_photographer_id UUID, p_reason TEXT DEFAULT NULL) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF; UPDATE user_profiles SET is_suspended = true, suspended_at = NOW(), suspended_reason = p_reason, subscription_status = 'suspended' WHERE id = p_photographer_id; RETURN FOUND; END; $$;
GRANT EXECUTE ON FUNCTION public.suspend_photographer(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.unsuspend_photographer(p_photographer_id UUID) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin') THEN RAISE EXCEPTION 'Unauthorized'; END IF; UPDATE user_profiles SET is_suspended = false, suspended_at = NULL, suspended_reason = NULL, subscription_status = CASE WHEN subscription_expires_at > NOW() THEN 'active' ELSE 'inactive' END WHERE id = p_photographer_id; RETURN FOUND; END; $$;
GRANT EXECUTE ON FUNCTION public.unsuspend_photographer(UUID) TO authenticated;

-- 8.23 SMS purchase function
CREATE OR REPLACE FUNCTION complete_sms_purchase(p_admin_id UUID, p_package_id UUID, p_sms_count INTEGER, p_amount NUMERIC, p_receipt TEXT, p_phone TEXT) RETURNS void AS $$ BEGIN
  INSERT INTO public.sms_purchase_transactions (admin_id, package_id, sms_count, amount, status, mpesa_receipt, phone_number, completed_at) VALUES (p_admin_id, p_package_id, p_sms_count, p_amount, 'completed', p_receipt, p_phone, now());
  INSERT INTO public.sms_credits (admin_id, balance, total_purchased, updated_at) VALUES (p_admin_id, p_sms_count, p_sms_count, now()) ON CONFLICT (admin_id) DO UPDATE SET balance = sms_credits.balance + p_sms_count, total_purchased = sms_credits.total_purchased + p_sms_count, updated_at = now();
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8.24 Calendar and review stats
CREATE OR REPLACE FUNCTION public.get_event_stats(p_photographer_id UUID) RETURNS TABLE (total_events BIGINT, upcoming_events BIGINT, completed_events BIGINT, this_month_events BIGINT) AS $$ BEGIN RETURN QUERY SELECT COUNT(*), COUNT(*) FILTER (WHERE event_date >= CURRENT_DATE AND status = 'completed'), COUNT(*) FILTER (WHERE status = 'completed'), COUNT(*) FILTER (WHERE event_date >= date_trunc('month', CURRENT_DATE) AND event_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month') FROM events WHERE photographer_id = p_photographer_id; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_review_stats(p_photographer_id UUID) RETURNS TABLE (total_reviews BIGINT, average_rating DECIMAL(3,2), five_star_count BIGINT, four_star_count BIGINT, three_star_count BIGINT, two_star_count BIGINT, one_star_count BIGINT) AS $$ BEGIN RETURN QUERY SELECT COUNT(*), COALESCE(AVG(rating), 0)::DECIMAL(3,2), COUNT(*) FILTER (WHERE rating = 5), COUNT(*) FILTER (WHERE rating = 4), COUNT(*) FILTER (WHERE rating = 3), COUNT(*) FILTER (WHERE rating = 2), COUNT(*) FILTER (WHERE rating = 1) FROM reviews WHERE photographer_id = p_photographer_id AND is_verified = true; END; $$ LANGUAGE plpgsql;


-- ============================================
-- 9. VIEWS
-- ============================================

CREATE OR REPLACE VIEW public.revenue_pipeline AS
SELECT DATE_TRUNC('month', subs.created_at) as month, 'subscription' as revenue_type, COUNT(DISTINCT subs.admin_id) as transaction_count, SUM(subs.amount) as gross_revenue, SUM(subs.amount) as net_revenue, NULL::TEXT as payment_method
FROM admin_subscriptions subs WHERE subs.status = 'success' GROUP BY month;

CREATE OR REPLACE VIEW public.v_total_unassigned_users AS
SELECT up.id AS user_id, up.name, up.email, up.created_at AS registered_at,
  (SELECT MIN(uss.session_start) FROM public.unassigned_user_sessions uss WHERE uss.user_id = up.id) AS first_seen_at,
  COALESCE((SELECT SUM(uss.code_entry_attempts) FROM public.unassigned_user_sessions uss WHERE uss.user_id = up.id), 0) AS total_code_attempts
FROM public.user_profiles up LEFT JOIN public.clients c ON c.user_id = up.id WHERE up.role = 'client' AND (c.owner_admin_id IS NULL OR c.id IS NULL);

CREATE OR REPLACE VIEW public.v_avg_time_to_assignment AS
SELECT NULL::UUID AS photographer_id, 'platform_wide'::TEXT AS photographer_name, AVG(time_to_assignment_seconds)::NUMERIC(12,2) AS avg_seconds, (AVG(time_to_assignment_seconds) / 3600)::NUMERIC(10,2) AS avg_hours, (AVG(time_to_assignment_seconds) / 86400)::NUMERIC(10,2) AS avg_days, MIN(time_to_assignment_seconds)::INTEGER AS min_seconds, MAX(time_to_assignment_seconds)::INTEGER AS max_seconds, COUNT(*)::BIGINT AS total_assigned_sessions FROM public.unassigned_user_sessions WHERE assigned_at IS NOT NULL AND time_to_assignment_seconds IS NOT NULL
UNION ALL
SELECT up.id, up.name, AVG(uss.time_to_assignment_seconds)::NUMERIC(12,2), (AVG(uss.time_to_assignment_seconds) / 3600)::NUMERIC(10,2), (AVG(uss.time_to_assignment_seconds) / 86400)::NUMERIC(10,2), MIN(uss.time_to_assignment_seconds)::INTEGER, MAX(uss.time_to_assignment_seconds)::INTEGER, COUNT(*)::BIGINT FROM public.unassigned_user_sessions uss JOIN public.clients c ON c.user_id = uss.user_id AND c.owner_admin_id IS NOT NULL JOIN public.user_profiles up ON up.id = c.owner_admin_id WHERE uss.assigned_at IS NOT NULL AND uss.time_to_assignment_seconds IS NOT NULL GROUP BY up.id, up.name ORDER BY total_assigned_sessions DESC;

CREATE OR REPLACE VIEW public.v_failed_attempt_counts AS
SELECT COUNT(*)::BIGINT AS total_failed_sessions, SUM(code_entry_attempts)::BIGINT AS total_failed_attempts, ROUND(AVG(code_entry_attempts)::NUMERIC, 2) AS avg_attempts_per_session, MAX(code_entry_attempts)::INTEGER AS max_attempts_in_session, COUNT(CASE WHEN code_entry_attempts = 1 THEN 1 END)::BIGINT AS sessions_with_1_attempt, COUNT(CASE WHEN code_entry_attempts BETWEEN 2 AND 3 THEN 1 END)::BIGINT AS sessions_with_2_3_attempts, COUNT(CASE WHEN code_entry_attempts BETWEEN 4 AND 9 THEN 1 END)::BIGINT AS sessions_with_4_9_attempts, COUNT(CASE WHEN code_entry_attempts >= 10 THEN 1 END)::BIGINT AS sessions_with_10_plus_attempts, COUNT(CASE WHEN session_start >= NOW() - INTERVAL '7 days' THEN 1 END)::BIGINT AS failed_sessions_last_7_days, COUNT(CASE WHEN session_start >= NOW() - INTERVAL '30 days' THEN 1 END)::BIGINT AS failed_sessions_last_30_days FROM public.unassigned_user_sessions WHERE assigned_at IS NULL AND code_entry_attempts > 0;


-- ============================================
-- 10. SEED DATA
-- ============================================

-- Platform settings
INSERT INTO platform_settings (key, value) VALUES
  ('platform_mpesa_till', ''), ('platform_mpesa_account_ref', 'EPIX'), ('platform_whatsapp_number', ''),
  ('platform_subscription_amount', '500'), ('platform_app_name', 'Epix Visuals Studios'),
  ('platform_support_email', 'epixshots002@gmail.com'), ('platform_app_android_link', ''), ('platform_app_ios_link', ''),
  ('platform_admin_app_android_link', ''), ('platform_admin_app_ios_link', ''), ('platform_deep_link_scheme', 'epixvisuals')
ON CONFLICT (key) DO NOTHING;

-- Default SMS credit packages
INSERT INTO public.sms_credit_packages (name, sms_count, price) VALUES ('Starter', 100, 200), ('Growth', 250, 450), ('Professional', 500, 800), ('Enterprise', 1000, 1500) ON CONFLICT DO NOTHING;

-- Feature flags
INSERT INTO public.feature_flags (key, enabled, label, description, category) VALUES
  ('bts_posts', true, 'BTS Posts', 'Behind-the-scenes content from photographers', 'content'),
  ('announcements', true, 'Announcements', 'Platform and photographer announcements', 'content'),
  ('portfolio', true, 'Portfolio', 'Photographer portfolio showcase', 'content'),
  ('galleries', true, 'Galleries', 'Client photo galleries', 'content'),
  ('messaging', true, 'Messaging', 'Client-admin messaging system', 'communication'),
  ('sms_notifications', true, 'SMS Notifications', 'SMS alerts for bookings and updates', 'communication'),
  ('whatsapp', false, 'WhatsApp Integration', 'WhatsApp Business messaging', 'communication'),
  ('bookings', true, 'Bookings', 'Photography session bookings', 'commerce'),
  ('payments', true, 'Payments', 'M-Pesa payment processing', 'commerce'),
  ('packages', true, 'Packages', 'Photography service packages', 'commerce'),
  ('cloud_storage', true, 'Cloud Storage', 'Cloud-based photo storage and delivery', 'infrastructure'),
  ('social_sharing', true, 'Social Sharing', 'Share content to social platforms', 'social'),
  ('referrals', false, 'Referral System', 'Client referral program', 'growth'),
  ('analytics', true, 'Analytics', 'Platform usage analytics', 'insights')
ON CONFLICT (key) DO NOTHING;

-- Platform payment settings
INSERT INTO public.platform_payment_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- Set super admin (update email if needed)
UPDATE user_profiles SET role = 'super_admin', subscription_status = 'active', subscription_expires_at = '2099-12-31 23:59:59+00', is_lifetime = true WHERE email = 'epixshots002@gmail.com';

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';

RAISE NOTICE '=== DATABASE REBUILD COMPLETE ===';
