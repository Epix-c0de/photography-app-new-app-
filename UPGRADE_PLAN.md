# Epix Visuals Platform — Complete Upgrade Plan

## Table of Contents
- [Phase 0: Critical Fixes & Infrastructure](#phase-0)
- [Phase 1: Compression Pipeline (Mobile + Web)](#phase-1)
- [Phase 2: Payment & Pricing — M-Pesa Integration](#phase-2)
- [Phase 3: Communication — SMS & WhatsApp](#phase-3)
- [Phase 4: Content & Sharing — Offline + USSD](#phase-4)
- [Phase 5: Business Features — Calendar, Reviews, Watermarks](#phase-5)
- [Phase 6: Growth — Referrals, Social, Google](#phase-6)
- [Phase 7: New Pages & Features](#phase-7)
- [Tech Stack Reference](#tech-stack)
- [Database Schema Additions](#schema-additions)

---

<a id="phase-0"></a>
## Phase 0: Critical Fixes & Infrastructure
**Priority: IMMEDIATE | Est: 2-3 days**

### 0.1 — Fix Hardcoded Domains
Every file that references `epixvisuals.co.ke` or `epx.vc` must fetch from `platform_settings` table.

**Files to fix:**
- `photographer-dashboard/src/lib/shareable-links.ts` — line 33, 79
- `contexts/BrandingContext.tsx` — line 60-64 (DEFAULTS)
- `supabase/functions/generate-short-url/index.ts` — line 69
- `web-onboarding/src/app/success/page.tsx` — line 14
- `web-onboarding/src/app/login/page.tsx` — line 171

**Approach:**
```typescript
// Create: lib/config.ts
export async function getPlatformUrl(): Promise<string> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'platform_domain')
    .single();
  return data?.value || 'https://epixvisuals.co.ke';
}
```

### 0.2 — Create Missing Database Tables
Run these migrations before anything else:

**File: `supabase/migrations/20250101000000_create_one_time_tokens.sql`** (already created)

**File: `supabase/migrations/20250101000001_create_short_urls.sql`** (already created)

**File: `supabase/migrations/20250101000002_create_payment_tables.sql`** (Phase 2)

**File: `supabase/migrations/20250101000003_create_installment_tables.sql`** (Phase 2)

### 0.3 — Fix Supabase Service Role Key Exposure
`photographer-dashboard/src/lib/supabase.ts` exports `createServiceClient()` which exposes the service role key in client bundles.

**Fix:** Move all service-role calls to API routes or Edge Functions. Remove the export from the client-side supabase.ts.

**Files:**
- `photographer-dashboard/src/lib/supabase.ts` — remove lines 14-25
- Move any direct `createServiceClient()` calls to `/api/*` routes

### 0.4 — Access Code Hashing
Gallery access codes stored in plaintext in `galleries` table.

**Migration:** Add `access_code_hash` column, migrate existing codes, drop plaintext column.

**Files:**
- `supabase/migrations/20250101000004_hash_access_codes.sql`
- `photographer-dashboard/src/app/dashboard/upload/page.tsx` — hash before insert
- `supabase/functions/verify-access-code/index.ts` — hash input, compare

### 0.5 — Environment Variables Audit
Ensure no secrets are in `NEXT_PUBLIC_*` vars:

| Variable | Location | Status |
|----------|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | ✅ OK (server only) |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | ✅ OK (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | ✅ OK (public) |
| `AFRICASTALKING_API_KEY` | `.env.local` | ⚠️ Add in Phase 3 |
| `MPESA_CONSUMER_KEY` | `.env.local` | ⚠️ Add in Phase 2 |
| `MPESA_CONSUMER_SECRET` | `.env.local` | ⚠️ Add in Phase 2 |

---

<a id="phase-1"></a>
## Phase 1: Compression Pipeline (Mobile + Web)
**Priority: HIGH | Est: 2-3 days**

### 1.1 — Web Dashboard Compression (DONE ✅)
Already implemented in `photographer-dashboard/src/app/dashboard/upload/page.tsx`

**Edge Function:** `supabase/functions/compress-image/index.ts`
**Client Lib:** `photographer-dashboard/src/lib/compression.ts`

**Remaining work:**
- [ ] Verify ImageMagick is available in Supabase Edge Functions
- [ ] Add fallback to client-side Canvas compression if Edge Function fails
- [ ] Add compression progress indicator in upload UI

### 1.2 — Admin Mobile App Compression (TODO)
Apply same compression to mobile upload.

**File:** `app/(admin)/upload/index.tsx`

**Changes needed:**
1. Import compression utility
2. Before uploading to Supabase Storage, compress images > 5MB
3. Use `expo-image-manipulator` for client-side compression (more reliable than Edge Function on mobile)
4. Show compression ratio in upload progress

**Implementation approach:**
```typescript
// In upload/index.tsx, modify the uploadPhoto function:
import * as ImageManipulator from 'expo-image-manipulator';

async function compressImage(uri: string, quality = 0.85): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 2400 } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

// In uploadPhoto function:
if (fileSize > 5 * 1024 * 1024) {
  // Compress before upload
  photoUri = await compressImage(photoUri);
}
```

### 1.3 — Compression Presets
| Preset | Max Width | Quality | Target Size | Use Case |
|--------|-----------|---------|-------------|----------|
| `thumbnail` | 400px | 80% | < 100KB | Gallery grid |
| `preview` | 1200px | 85% | < 500KB | Previews |
| `standard` | 2400px | 88% | < 5MB | Client delivery |
| `full` | 4000px | 90% | < 10MB | High-res delivery |

---

<a id="phase-2"></a>
## Phase 2: Payment & Pricing — M-Pesa Integration
**Priority: HIGH | Est: 5-7 days**

### 2.1 — M-Pesa Till Number Integration
Allow photographers to register their own Lipa Na M-Pesa Till numbers.

**New table: `photographer_till_numbers`**
```sql
CREATE TABLE photographer_till_numbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id),
  till_number TEXT NOT NULL,
  business_name TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Files to create:**
- `supabase/migrations/20250101000002_create_payment_tables.sql`
- `supabase/functions/mpesa-till-register/index.ts` — Register till with Safaricom
- `supabase/functions/mpesa-till-verify/index.ts` — Verify till ownership
- `supabase/functions/mpesa-stk-push/index.ts` — Initiate STK push to client's phone

**Files to modify:**
- `photographer-dashboard/src/app/dashboard/settings/page.tsx` — Add "M-Pesa Settings" section
- `photographer-dashboard/src/app/dashboard/galleries/[id]/page.tsx` — Add "Collect Payment" button
- `app/(admin)/settings/index.tsx` — Add till number management

**Flow:**
1. Photographer goes to Settings → M-Pesa → Add Till Number
2. System verifies till via Safaricom API
3. When creating gallery, photographer sets price
4. Client receives gallery link → clicks "Pay Now"
5. STK push sent to client's phone
6. On success, gallery unlocks

### 2.2 — M-Pesa Statement Generator
Auto-generate payment receipts after successful payment.

**New table: `payment_receipts`**
```sql
CREATE TABLE payment_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  gallery_id UUID REFERENCES galleries(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  transaction_id TEXT, -- M-Pesa transaction ID
  phone_number TEXT,
  receipt_number TEXT,
  status TEXT DEFAULT 'pending', -- pending, completed, failed
  receipt_html TEXT, -- Generated receipt HTML
  receipt_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Files to create:**
- `supabase/functions/generate-receipt/index.ts` — Generate HTML receipt
- `supabase/functions/mpesa-callback/index.ts` — Handle M-Pesa callback
- `photographer-dashboard/src/lib/receipt-generator.ts` — Client-side receipt builder
- `photographer-dashboard/src/components/ReceiptModal.tsx` — View/download receipt

**Receipt template:**
```
┌─────────────────────────────────────┐
│         EPIX VISUALS STUDIOS        │
│       Payment Receipt                │
│                                      │
│  Receipt No: RCP-2026-00001        │
│  Date: 29 June 2026                 │
│  ----------------------------------  │
│  Client: John Doe                    │
│  Phone: +254712345678               │
│  Gallery: Johnson Wedding 2026      │
│                                      │
│  Amount Paid: KES 15,000            │
│  Payment Method: M-Pesa             │
│  Transaction ID: QHK7B3XYZ1         │
│  Status: ✓ Completed                │
│  ----------------------------------  │
│  Thank you for your payment!        │
│  Studio: +254700111222              │
└─────────────────────────────────────┘
```

### 2.3 — Installment Payments
Allow clients to pay in parts (deposit + balance).

**New table: `installment_plans`**
```sql
CREATE TABLE installment_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gallery_id UUID REFERENCES galleries(id),
  photographer_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  total_amount DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NOT NULL,
  balance_amount DECIMAL(10,2) NOT NULL,
  number_of_installments INT DEFAULT 2,
  installment_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'active', -- active, completed, defaulted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE installment_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES installment_plans(id),
  installment_number INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  transaction_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, paid, overdue
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Files to create:**
- `supabase/migrations/20250101000003_create_installment_tables.sql`
- `supabase/functions/create-installment-plan/index.ts`
- `supabase/functions/process-installment/index.ts`
- `supabase/functions/check-overdue-installments/index.ts` — Cron job
- `photographer-dashboard/src/app/dashboard/installments/page.tsx` — Manage plans

**Files to modify:**
- `photographer-dashboard/src/app/dashboard/galleries/[id]/page.tsx` — Add "Split Payment" option
- `app/(user)/gallery/[id].tsx` — Show payment schedule to client

**Flow:**
1. Photographer creates gallery with KES 30,000 price
2. Selects "Allow Installments" → Sets deposit (KES 10,000) + 2 installments (KES 10,000 each)
3. Client receives gallery link → sees "Pay KES 10,000 deposit to unlock preview"
4. After deposit, client sees full gallery but photos are watermarked
5. Each installment unlocks higher resolution
6. After final payment, full resolution photos unlocked

---

<a id="phase-3"></a>
## Phase 3: Communication — SMS & WhatsApp
**Priority: HIGH | Est: 4-5 days**

### 3.1 — SMS via Africa's Talking
Send gallery notifications via cheap local SMS (KES 0.50/SMS).

**New environment variables:**
```
AFRICASTALKING_API_KEY=your_key
AFRICASTALKING_USERNAME=epixvisuals
AFRICASTALKING_SENDER_ID=EPIX
```

**New table: `sms_logs`**
```sql
CREATE TABLE sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
  provider_ref TEXT,
  cost DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Files to create:**
- `supabase/functions/send-sms/index.ts` — Africa's Talking integration
- `supabase/functions/sms-delivery-status/index.ts` — Callback handler
- `photographer-dashboard/src/lib/sms.ts` — Client-side SMS utilities
- `photographer-dashboard/src/app/dashboard/sms-history/page.tsx` — View sent SMS

**Files to modify:**
- `photographer-dashboard/src/app/dashboard/upload/page.tsx` — Add "Send SMS" toggle
- `photographer-dashboard/src/app/dashboard/clients/page.tsx` — Add SMS button per client
- `app/(admin)/upload/index.tsx` — Add SMS option on mobile upload

**SMS templates:**
```typescript
const templates = {
  galleryReady: `Hi {clientName}, your {galleryName} photos are ready! View them here: {link}. Use code: {code}`,
  paymentReminder: `Hi {clientName}, reminder: KES {amount} installment due for {galleryName}. Pay here: {link}`,
  galleryExpiring: `Hi {clientName}, your {galleryName} gallery will expire in {days} days. Download your photos: {link}`,
};
```

### 3.2 — WhatsApp Business API
Send gallery links via WhatsApp (most popular in Kenya).

**New environment variables:**
```
WHATSAPP_API_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id
```

**Files to create:**
- `supabase/functions/send-whatsapp/index.ts` — WhatsApp Business API integration
- `supabase/functions/whatsapp-webhook/index.ts` — Receive WhatsApp messages
- `photographer-dashboard/src/lib/whatsapp.ts` — Client-side WhatsApp utilities

**Files to modify:**
- `photographer-dashboard/src/app/dashboard/upload/page.tsx` — Add "Send WhatsApp" toggle
- `photographer-dashboard/src/app/dashboard/clients/page.tsx` — Add WhatsApp button
- `app/(user)/gallery/[id].tsx` — Add WhatsApp share button for clients

**WhatsApp message template:**
```
📸 *Epix Visuals Studios*

Hi {clientName}! 🎉

Your {galleryName} photos are ready to view and download.

🔗 View Gallery: {link}
🔑 Access Code: {code}

Thank you for choosing Epix Visuals! 📷

_Epix Visuals Studios_
_Nairobi, Kenya_
```

---

<a id="phase-4"></a>
## Phase 4: Content & Sharing — Offline + USSD
**Priority: MEDIUM | Est: 5-6 days**

### 4.1 — Safaricom-Optimized Compression
Extra compression for users on slow Safaricom data bundles.

**Target:** < 2MB for gallery thumbnails, < 5MB for full images

**Files to create:**
- `supabase/functions/compress-safaricom/index.ts` — Aggressive compression
- `photographer-dashboard/src/lib/safaricom-compress.ts` — Client-side

**Compression strategy:**
```typescript
const SAFARICOM_PRESETS = {
  // For 2G/3G networks (common in rural Kenya)
  ultraLow: { maxWidth: 800, quality: 0.6, format: 'webp' },
  // For 3G networks
  low: { maxWidth: 1200, quality: 0.75, format: 'jpeg' },
  // For 4G networks
  medium: { maxWidth: 1800, quality: 0.85, format: 'jpeg' },
  // For WiFi
  high: { maxWidth: 2400, quality: 0.9, format: 'jpeg' },
};
```

**Files to modify:**
- `app/(user)/gallery/[id].tsx` — Detect network speed, load appropriate quality
- `photographer-dashboard/src/app/dashboard/upload/page.tsx` — Add "Optimize for Safaricom" toggle

### 4.2 — Offline Gallery Mode
Cache gallery thumbnails for viewing on patchy networks.

**Files to create:**
- `lib/offline-cache.ts` — IndexedDB/SQLite cache manager
- `lib/network-detector.ts` — Detect network quality

**Files to modify:**
- `app/(user)/gallery/[id].tsx` — Cache thumbnails on first load
- `app/(user)/_layout.tsx` — Add offline indicator

**Implementation:**
```typescript
// Use expo-sqlite for offline caching
import * as SQLite from 'expo-sqlite';

const db = await SQLite.openDatabase('gallery_cache.db');

await db.execAsync(`
  CREATE TABLE IF NOT EXISTS cached_photos (
    id TEXT PRIMARY KEY,
    gallery_id TEXT,
    thumbnail_url TEXT,
    full_url TEXT,
    local_thumbnail_path TEXT,
    local_full_path TEXT,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
```

### 4.3 — USSD Access Codes
Clients dial `*123*CODE#` to get their gallery link via SMS.

**Files to create:**
- `supabase/functions/ussd-handler/index.ts` — Handle USSD requests
- `supabase/functions/send-ussd-sms/index.ts` — Send SMS with gallery link

**USSD flow:**
1. Client dials `*123*WEDDING123#`
2. USSD handler receives request
3. Looks up access code in `galleries` table
4. Sends SMS with gallery link to client's phone
5. Returns USSD confirmation message

**Files to modify:**
- `photographer-dashboard/src/app/dashboard/galleries/page.tsx` — Show USSD code for each gallery

---

<a id="phase-5"></a>
## Phase 5: Business Features — Calendar, Reviews, Watermarks
**Priority: MEDIUM | Est: 5-7 days**

### 5.1 — Event Calendar Integration
Sync with local events (weddings, graduations, holidays).

**New table: `events`**
```sql
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  title TEXT NOT NULL,
  event_type TEXT NOT NULL, -- wedding, portrait, corporate, event, graduation
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Kenyan holidays to pre-populate:**
- Jamhuri Day (Dec 12)
- Madaraka Day (Jun 1)
- Mashujaa Day (Oct 20)
- Utamaduni Day (Oct 10)
- Christmas (Dec 25-26)
- Easter
- Eid al-Fitr / Eid al-Adha

**Files to create:**
- `supabase/migrations/20250101000005_create_events.sql`
- `photographer-dashboard/src/app/dashboard/calendar/page.tsx` — Calendar view
- `lib/kenyan-holidays.ts` — Holiday data

**Files to modify:**
- `app/(admin)/_layout.tsx` — Add Calendar tab
- `photographer-dashboard/src/app/dashboard/layout.tsx` — Add Calendar nav item

### 5.2 — Client Reviews via M-Pesa
After payment, prompt client to leave a review.

**New table: `reviews`**
```sql
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  gallery_id UUID REFERENCES galleries(id),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Files to create:**
- `supabase/migrations/20250101000006_create_reviews.sql`
- `supabase/functions/send-review-request/index.ts` — Send review request after payment
- `app/(user)/review/[galleryId].tsx` — Client review page
- `photographer-dashboard/src/app/dashboard/reviews/page.tsx` — View/manage reviews

**Flow:**
1. Client pays for gallery
2. 24 hours later, system sends SMS/WhatsApp: "How was your experience? Leave a review: {link}"
3. Client rates 1-5 stars and writes review
4. Review appears on photographer's portfolio (if public)

### 5.3 — Portfolio Watermark with Studio Name
Comply with Kenyan photography association requirements.

**Already partially implemented in BrandingContext. Enhance with:**

**Files to modify:**
- `contexts/BrandingContext.tsx` — Add watermark positioning options
- `photographer-dashboard/src/app/dashboard/settings/page.tsx` — Watermark preview
- `app/(user)/gallery/[id].tsx` — Apply watermark on client view

**Watermark presets:**
```typescript
const WATERMARK_PRESETS = {
  center: { position: 'center', opacity: 0.3, rotation: 45 },
  bottomRight: { position: 'bottom-right', opacity: 0.4, rotation: 0 },
  bottomLeft: { position: 'bottom-left', opacity: 0.4, rotation: 0 },
  tiled: { position: 'tiled', opacity: 0.15, rotation: 45 },
};
```

---

<a id="phase-6"></a>
## Phase 6: Growth — Referrals, Social, Google
**Priority: LOW | Est: 5-7 days**

### 6.1 — Referral Program
"Refer another photographer, earn KES 100 credit"

**New table: `referrals`**
```sql
CREATE TABLE referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id),
  referred_id UUID REFERENCES auth.users(id),
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, completed, rewarded
  reward_amount DECIMAL(10,2) DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rewarded_at TIMESTAMPTZ
);
```

**Files to create:**
- `supabase/migrations/20250101000007_create_referrals.sql`
- `supabase/functions/process-referral/index.ts`
- `photographer-dashboard/src/app/dashboard/referrals/page.tsx` — Referral dashboard
- `web-onboarding/src/app/signup/page.tsx` — Add referral code field

**Referral flow:**
1. Photographer gets unique referral code (e.g., `EPX-JOHN-1234`)
2. Shares with other photographers
3. When referred photographer signs up and pays KES 500:
   - Referrer gets KES 100 credit
   - Referred gets first month free (or discount)

### 6.2 — Instagram/Facebook Auto-Share
Post BTS content directly to social media.

**Files to create:**
- `supabase/functions/share-instagram/index.ts` — Instagram Graph API
- `supabase/functions/share-facebook/index.ts` — Facebook Graph API
- `photographer-dashboard/src/app/dashboard/social/page.tsx` — Social media manager

**Files to modify:**
- `app/(admin)/bts-announcements.tsx` — Add "Share to Instagram/Facebook" buttons
- `photographer-dashboard/src/app/dashboard/bts/page.tsx` — Add social share options

**Flow:**
1. Photographer creates BTS post
2. Clicks "Share to Instagram"
3. Authorizes Instagram account (one-time)
4. Post published to Instagram with hashtags

### 6.3 — Google Business Profile Integration
Show galleries on Google Maps for local discovery.

**Files to create:**
- `supabase/functions/google-business-sync/index.ts`
- `photographer-dashboard/src/app/dashboard/google-business/page.tsx`

**Files to modify:**
- `photographer-dashboard/src/app/dashboard/portfolio/page.tsx` — Add "Sync to Google" button

---

<a id="phase-7"></a>
## Phase 7: New Pages & Features

### 7.1 — Admin Mobile App (New Pages)

| Page | Route | Description |
|------|-------|-------------|
| **Galleries** | `(admin)/galleries` | List all galleries with search/filter |
| **Calendar** | `(admin)/calendar` | Event schedule view |
| **Reviews** | `(admin)/reviews` | Client reviews and ratings |
| **Analytics** | `(admin)/analytics` | Upload stats, popular galleries |
| **Referrals** | `(admin)/referrals` | Referral codes and earnings |
| **SMS History** | `(admin)/sms-history` | View sent SMS logs |
| **Social** | `(admin)/social` | Instagram/Facebook management |
| **USSD Codes** | `(admin)/ussd` | Generate USSD codes for galleries |

**Files to create:**
- `app/(admin)/galleries/index.tsx`
- `app/(admin)/calendar/index.tsx`
- `app/(admin)/reviews/index.tsx`
- `app/(admin)/analytics/index.tsx`
- `app/(admin)/referrals/index.tsx`
- `app/(admin)/sms-history/index.tsx`
- `app/(admin)/social/index.tsx`
- `app/(admin)/ussd/index.tsx`

### 7.2 — Photographer Dashboard (New Pages)

| Page | Route | Description |
|------|-------|-------------|
| **Installments** | `/dashboard/installments` | Manage payment plans |
| **Calendar** | `/dashboard/calendar` | Event schedule |
| **Reviews** | `/dashboard/reviews` | Client reviews |
| **Referrals** | `/dashboard/referrals` | Referral program |
| **SMS History** | `/dashboard/sms-history` | View sent SMS |
| **Social** | `/dashboard/social` | Social media management |
| **Google Business** | `/dashboard/google-business` | Google Maps integration |
| **Receipts** | `/dashboard/receipts` | Payment receipts |
| **Reports** | `/dashboard/reports` | Financial reports |

**Files to create:**
- `photographer-dashboard/src/app/dashboard/installments/page.tsx`
- `photographer-dashboard/src/app/dashboard/calendar/page.tsx`
- `photographer-dashboard/src/app/dashboard/reviews/page.tsx`
- `photographer-dashboard/src/app/dashboard/referrals/page.tsx`
- `photographer-dashboard/src/app/dashboard/sms-history/page.tsx`
- `photographer-dashboard/src/app/dashboard/social/page.tsx`
- `photographer-dashboard/src/app/dashboard/google-business/page.tsx`
- `photographer-dashboard/src/app/dashboard/receipts/page.tsx`
- `photographer-dashboard/src/app/dashboard/reports/page.tsx`

### 7.3 — Super Admin Dashboard (New Pages)

| Page | Route | Description |
|------|-------|-------------|
| **Revenue** | `/dashboard/revenue` | Enhanced with M-Pesa data |
| **SMS Analytics** | `/dashboard/sms-analytics` | SMS delivery rates, costs |
| **Referral Analytics** | `/dashboard/referrals` | Referral program performance |
| **Fraud Detection** | `/dashboard/fraud` | Suspicious payment patterns |
| **Platform Health** | `/dashboard/health` | System status, API usage |
| **Feature Flags** | `/dashboard/features` | Enable/disable features |
| **Bulk SMS** | `/dashboard/bulk-sms` | Send SMS to all photographers |
| **Content Moderation** | `/dashboard/moderation` | Review flagged content |

**Files to create:**
- `super-admin-dashboard/src/app/dashboard/sms-analytics/page.tsx`
- `super-admin-dashboard/src/app/dashboard/referrals/page.tsx`
- `super-admin-dashboard/src/app/dashboard/health/page.tsx`
- `super-admin-dashboard/src/app/dashboard/features/page.tsx`
- `super-admin-dashboard/src/app/dashboard/bulk-sms/page.tsx`
- `super-admin-dashboard/src/app/dashboard/moderation/page.tsx`

---

<a id="tech-stack"></a>
## Tech Stack Reference

| Layer | Technology | Notes |
|-------|------------|-------|
| Mobile App | Expo / React Native | `app/` directory |
| Photographer Dashboard | Next.js 14.2.3 | `photographer-dashboard/` |
| Super Admin Dashboard | Next.js | `super-admin-dashboard/` |
| Web Onboarding | Next.js | `web-onboarding/` |
| Backend | Supabase | 98 migrations, 48 Edge Functions |
| Database | PostgreSQL (Supabase) | With RLS policies |
| Storage | Supabase Storage | `client-photos` bucket |
| Auth | Supabase Auth | Email/password + magic links |
| Payments | M-Pesa (Safaricom) | STK push + Till numbers |
| SMS | Africa's Talking | KES 0.50/SMS |
| WhatsApp | WhatsApp Business API | Free for business accounts |
| Hosting | Vercel/Netlify | For web dashboards |
| Image Processing | ImageMagick / expo-image-manipulator | Compression |
| Short URLs | Custom / bit.ly | Branded short links |

---

<a id="schema-additions"></a>
## Database Schema Additions Summary

### New Tables (Phases 2-7)

| Table | Phase | Purpose |
|-------|-------|---------|
| `one_time_tokens` | 0 | Login redirect tokens |
| `short_urls` | 0 | Branded short URLs |
| `photographer_till_numbers` | 2 | M-Pesa till numbers |
| `payment_receipts` | 2 | Payment receipts |
| `installment_plans` | 2 | Payment plans |
| `installment_payments` | 2 | Individual installments |
| `sms_logs` | 3 | SMS delivery logs |
| `events` | 5 | Calendar events |
| `reviews` | 5 | Client reviews |
| `referrals` | 6 | Referral program |
| `photo_favorites` | 7 | User photo favorites |
| `download_history` | 7 | Gallery download history |
| `invoices` | 7 | Payment invoices |
| `member_benefits` | 7 | Member tier & rewards |
| `support_tickets` | 7 | Support ticket system |
| `faqs` | 7 | FAQ knowledge base |
| `receipt_settings` | 7 | Receipt customization settings |

### New Columns (Existing Tables)

| Table | Column | Phase |
|-------|--------|-------|
| `galleries` | `allow_installments` | 2 |
| `galleries` | `installment_deposit` | 2 |
| `galleries` | `usd_code` | 4 |
| `galleries` | `whatsapp_link` | 3 |
| `user_profiles` | `referral_code` | 6 |
| `user_profiles` | `referral_credits` | 6 |
| `user_profiles` | `sms_credits` | 3 |
| `brand_settings` | `brand_slug` | 0 |
| `brand_settings` | `custom_domain` | 0 |

---

## Implementation Order

```
Phase 0 (Fixes) ──────────────────────────────────┐
                                                   │
Phase 1 (Compression) ────────────────────────────┤
                                                   │
Phase 2 (M-Pesa) ─────────────────────────────────┤
                                                   │
Phase 3 (SMS/WhatsApp) ───────────────────────────┤
                                                   │
Phase 4 (Offline/USSD) ───────────────────────────┤
                                                   │
Phase 5 (Calendar/Reviews) ────────────────────────┤
                                                   │
Phase 6 (Referrals/Social/Google) ─────────────────┤
                                                   │
Phase 7 (New Pages) ──────────────────────────── ✅ DONE

All phases complete — including security fixes, super admin pages, and integrations.
```

**Total estimated time:** 4-6 weeks for full implementation

---

## Notes for Implementing Agent

1. **Always check existing code before writing new code** — Many features may already be partially implemented
2. **Follow existing code conventions** — Match the style of surrounding files
3. **Test each phase before moving to next** — Run `npm run lint` and `npm run typecheck`
4. **Update this file** as you complete each task — Check off items in the lists
5. **Never hardcode domains** — Always fetch from `platform_settings` table
6. **Use existing Supabase patterns** — Follow the style of existing Edge Functions
7. **Update BrandingContext** when adding new brand-related settings
8. **Create migrations for all new tables** — Number them sequentially
