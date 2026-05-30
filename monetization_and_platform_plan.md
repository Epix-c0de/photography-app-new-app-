# Epix Visuals Studios — Monetization & Platform Expansion Plan

> **Project:** Epix Visuals Studios Photography SaaS  
> **Supabase Project:** `gghqurnamjdxoriuuopf`  
> **Super Admin:** `epixshots002@gmail.com` (lifetime free access)  
> **Date:** May 2026

---

## Table of Contents

1. [Vision Summary](#1-vision-summary)
2. [Phase 1 — Database & Storage Foundation](#2-phase-1--database--storage-foundation)
3. [Phase 2 — Monetization: Admin Subscription System](#3-phase-2--monetization-admin-subscription-system)
4. [Phase 3 — App Modifications](#4-phase-3--app-modifications)
5. [Phase 4 — Web Onboarding Site for Photographers](#5-phase-4--web-onboarding-site-for-photographers)
6. [Phase 5 — Super Admin Dashboard (Web)](#6-phase-5--super-admin-dashboard-web)
7. [Phase 6 — Photographer Web Dashboard](#7-phase-6--photographer-web-dashboard)
8. [Super Admin Exemption](#8-super-admin-exemption)
9. [Data Model Changes Summary](#9-data-model-changes-summary)
10. [Implementation Order](#10-implementation-order)

---

## 1. Vision Summary

Transform the app from a single-photographer tool into a **multi-tenant SaaS platform** for photographers in Kenya.

| Who | What they get |
|-----|--------------|
| **Super Admin** (`epixshots002@gmail.com`) | Full platform control, no subscription fee, lifetime access |
| **Photographer (Admin)** | Pays KES 500/month, gets the full admin app + web dashboard |
| **Client (User)** | Free — downloads photos, chats with their photographer(s) |

### Core Business Rules

- A photographer pays **KES 500/month** via M-Pesa to activate their account
- A client can be tied to **multiple photographers** (each photographer sees only their own clients)
- Gallery share links use a **unique access code** that auto-links the client to that photographer
- BTS posts are **global by default** — visible to all clients — unless the photographer marks them as `admin_only`
- Chat is **per-photographer** — if a client has multiple photographers, the chat screen becomes a thread list

---

## 2. Phase 1 — Database & Storage Foundation

**Status:** In Progress  
**Files:** `supabase/migrations/`, Supabase SQL Editor

### 2.1 Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `client-photos` | No | Gallery photos (signed URLs) |
| `thumbnails` | No | Auto-generated thumbnails |
| `avatars` | Yes | User/admin profile pictures |
| `bts-media` | Yes | BTS posts and portfolio media |
| `brand-assets` | Yes | Logos, watermark images |

**SQL file:** `supabase/migrations/20260601000000_storage_buckets.sql`

### 2.2 Missing Tables to Create

```sql
-- Already exists, needs new columns:
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_lifetime BOOLEAN DEFAULT false;

-- New table: subscription payment history
CREATE TABLE admin_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 500,
  currency TEXT DEFAULT 'KES',
  mpesa_transaction_id TEXT,
  checkout_request_id TEXT,
  status TEXT DEFAULT 'pending', -- pending | success | failed
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- New table: audit log (already referenced in settings)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES user_profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Phase 2 — Monetization: Admin Subscription System

**Status:** Planned

### 3.1 Signup Flow

```
Photographer visits onboarding site
  → Fills in name, email, phone, studio name
  → Clicks "Start Free Trial" or "Subscribe Now"
  → M-Pesa STK push sent to their phone (KES 500)
  → On payment success:
      - Supabase Auth account created
      - user_profiles row inserted with role='admin'
      - subscription_status='active'
      - subscription_expires_at = NOW() + 30 days
      - Welcome SMS sent with app download link
```

### 3.2 Monthly Renewal

- A `pg_cron` job runs daily at midnight checking for expired subscriptions
- If `subscription_expires_at < NOW()` and `is_lifetime = false`:
  - Set `subscription_status = 'expired'`
  - Admin app shows a payment screen on next login
  - Galleries remain intact — only admin access is blocked
- On renewal payment:
  - `subscription_expires_at` extended by 30 days
  - `subscription_status` set back to `'active'`

### 3.3 Subscription Gate in Admin App

In `split-apps/admin-app/app/_layout.tsx` (or `AuthContext`):
```typescript
if (user.role === 'admin' && user.subscription_status === 'expired') {
  router.replace('/subscription-expired'); // new screen
}
```

The `subscription-expired` screen shows:
- "Your subscription expired on [date]"
- M-Pesa payment button (KES 500)
- After payment → auto-activates and redirects to dashboard

### 3.4 Super Admin Exemption

```sql
UPDATE user_profiles
SET 
  role = 'super_admin',
  subscription_status = 'active',
  subscription_expires_at = '2099-12-31 23:59:59+00',
  is_lifetime = true
WHERE email = 'epixshots002@gmail.com';
```

The subscription check skips `super_admin` role entirely:
```typescript
if (user.role === 'super_admin') return; // never blocked
```

---

## 4. Phase 3 — App Modifications

**Status:** Planned

### 4.1 Multi-Photographer Client Linking

**How it works today:** A client is tied to one photographer via `clients.owner_admin_id`.

**How it will work:** A client can have multiple `clients` rows — one per photographer. The `user_id` is the same, but `owner_admin_id` differs.

- Gallery share link: `https://app.epixvisuals.co/unlock?code=ABC123`
- When a client opens this link and logs in, `ensureLinkedRecordsForCurrentUser()` creates a `clients` row for that photographer automatically
- Each photographer sees only their own `clients` rows (already enforced by `owner_admin_id` filter — Fix 8)

### 4.2 Chat Screen — Multi-Photographer Thread List

**Current behavior:** Single chat thread between client and their photographer.

**New behavior:**
- If client has messages from only 1 photographer → chat screen stays exactly as it is now (no change)
- If client has messages from 2+ photographers → chat screen transforms into a **thread list**:
  - Each row shows: photographer avatar, studio name, last message preview, unread count
  - Tapping a row opens the individual chat thread (same UI as current)

**Implementation:**
- `ClientService.messaging.getThreads()` — new method that groups messages by `owner_admin_id`
- If `threads.length <= 1` → render current `ChatScreen` directly
- If `threads.length > 1` → render `ChatThreadListScreen` first

### 4.3 BTS Visibility — Global vs Admin-Only

**Database change:**
```sql
ALTER TABLE bts_posts ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'global';
-- 'global' = all clients see it
-- 'admin_only' = only clients of that photographer see it
```

**Client app filter:**
```typescript
// In ClientService.bts.list():
.or(`visibility.eq.global,and(visibility.eq.admin_only,owner_admin_id.eq.${myAdminId})`)
```

**Admin app:** Add a toggle when creating a BTS post — "Visible to all clients" (default) vs "My clients only"

---

## 5. Phase 4 — Web Onboarding Site for Photographers

**Status:** Planned  
**Tech Stack:** Next.js 14 + Tailwind CSS + Supabase JS

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page — features, pricing (KES 500/mo), testimonials |
| `/signup` | Photographer registration form |
| `/pay` | M-Pesa payment page (STK push) |
| `/success` | Post-payment confirmation + app download links |
| `/login` | Photographer login (redirects to web dashboard) |

### Signup Flow

1. Photographer fills form: name, email, phone, studio name
2. Clicks "Pay KES 500 & Get Started"
3. STK push sent to their phone
4. Page polls for payment confirmation (same pattern as PaymentModal)
5. On success: Supabase account created, welcome SMS sent, redirect to `/success`

### Hosting

- Deploy to Vercel (free tier)
- Domain: `app.epixvisuals.co` or `join.epixvisuals.co`

---

## 6. Phase 5 — Super Admin Dashboard (Web)

**Status:** Planned  
**Tech Stack:** Next.js 14 + Tailwind + Supabase (service role key — server-side only)

### Features

| Feature | Description |
|---------|-------------|
| Photographers list | All admins, subscription status, expiry date, revenue generated |
| Subscription management | Manually activate/deactivate/extend any photographer |
| Platform analytics | Total clients, galleries, revenue, active subscriptions |
| Payment history | All `admin_subscriptions` records with M-Pesa transaction IDs |
| BTS moderation | View/delete any BTS post across all photographers |
| Support tickets | View messages flagged by clients |

### Access Control

- Only accessible when logged in as `super_admin`
- Uses Supabase service role key on the server (never exposed to browser)
- Route: `https://admin.epixvisuals.co`

---

## 7. Phase 6 — Photographer Web Dashboard

**Status:** Planned  
**Tech Stack:** Next.js 14 + Tailwind + Supabase JS (anon key, RLS enforced)

### Features

| Feature | Description |
|---------|-------------|
| Gallery upload | Drag-and-drop bulk upload — easier than mobile for 200+ photos |
| Client management | Add clients, view their galleries, send access codes |
| Bookings | View/manage bookings calendar |
| Analytics | Revenue, gallery views, client activity |
| Settings | Branding, watermark, M-Pesa setup |
| Subscription | View current plan, renew, payment history |

### Upload Flow (Web)

1. Photographer selects client → creates gallery
2. Drags photos into upload zone (supports 100+ files)
3. Progress bar per file + overall progress
4. On complete → access code displayed + share link copied to clipboard
5. Option to send access code via SMS directly from the dashboard

### Access Control

- Only accessible when logged in as `admin` or `super_admin`
- `subscription_status` must be `active` — otherwise redirect to renewal page
- Route: `https://dashboard.epixvisuals.co`

---

## 8. Super Admin Exemption

To ensure `epixshots002@gmail.com` never gets blocked by the subscription gate:

```sql
-- Run this in Supabase SQL Editor after Phase 1 migration
UPDATE user_profiles
SET 
  role = 'super_admin',
  subscription_status = 'active',
  subscription_expires_at = '2099-12-31 23:59:59+00',
  is_lifetime = true
WHERE email = 'epixshots002@gmail.com';
```

In the admin app `AuthContext`, the subscription check is:
```typescript
const isSubscriptionValid = 
  user.role === 'super_admin' ||        // always valid
  user.is_lifetime === true ||           // lifetime accounts
  (user.subscription_status === 'active' && 
   new Date(user.subscription_expires_at) > new Date());
```

---

## 9. Data Model Changes Summary

| Table | Change | Phase |
|-------|--------|-------|
| `user_profiles` | Add `subscription_status`, `subscription_expires_at`, `is_lifetime` | 1 |
| `admin_subscriptions` | New table — payment history per admin | 1 |
| `admin_audit_log` | New table — admin action history | 1 |
| `bts_posts` | Add `visibility` column (`global` / `admin_only`) | 3 |
| `storage.buckets` | Create 5 buckets with RLS policies | 1 |

---

## 10. Implementation Order

```
Phase 1 (Now)
  ├── Run storage buckets SQL ✓ (in progress)
  ├── Run subscription columns migration
  ├── Run admin_audit_log migration
  └── Set super admin exemption

Phase 2 (Next)
  ├── Admin app: subscription gate screen
  ├── Admin app: subscription renewal M-Pesa flow
  └── Edge Function: process_admin_subscription

Phase 3 (App changes)
  ├── BTS visibility column + UI toggle
  ├── Client chat: multi-photographer thread list
  └── Gallery share link: auto-link client to photographer

Phase 4 (Web onboarding)
  ├── Next.js project setup
  ├── Landing page
  ├── Signup + M-Pesa payment flow
  └── Deploy to Vercel

Phase 5 (Super admin dashboard)
  ├── Next.js project setup
  ├── Photographers management
  ├── Platform analytics
  └── Deploy to Vercel

Phase 6 (Photographer web dashboard)
  ├── Next.js project setup
  ├── Bulk photo upload
  ├── Client & gallery management
  └── Deploy to Vercel
```

---

*Document created May 2026 — Epix Visuals Studios Platform Expansion*
