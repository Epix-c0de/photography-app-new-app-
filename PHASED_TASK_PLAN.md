# Epix Visuals — Phased Development Plan

**Project:** Epix Visuals Photography Platform  
**Supabase:** `gghqurnamjdxoriuuopf`  
**Deep Link:** `epix-visuals` / `epix-visuals-admin`  
**Last Updated:** July 16, 2026

---

## PHASE 1 — CRITICAL FIXES (Do First)

These are blocking issues. Nothing else works until these are resolved.

### 1.1 Run All Pending Migrations
Open Supabase SQL Editor and run these IN ORDER:

```sql
-- 1. Package columns + storage bucket
-- Run: split-apps/admin-app/supabase/migrations/20260714000007_add_packages_columns_and_storage.sql

-- 2. Portfolio RLS fix
-- Run: split-apps/admin-app/supabase/migrations/20260714000008_fix_portfolio_rls.sql

-- 3. Admin notification preferences
-- Run: split-apps/admin-app/supabase/migrations/20260716000000_admin_notification_preferences.sql

-- 4. Reviews upgrade
-- Run: split-apps/admin-app/supabase/migrations/20260716000004_reviews_upgrade.sql

-- 5. Support chat upgrade
-- Run: split-apps/admin-app/supabase/migrations/20260716000002_upgrade_support_chat.sql

-- 6. SMS credit system
-- Run: split-apps/admin-app/supabase/migrations/20260716000003_sms_credit_packages.sql

-- 7. Platform settings RLS fix
-- Run: split-apps/user-app/supabase/migrations/20260714000006_nuclear_platform_settings_rls.sql

-- 8. Platform domain seed
-- Run: split-apps/user-app/supabase/migrations/20260714000003_seed_platform_domain.sql
```

### 1.2 Supabase Dashboard Config
- [ ] **Auth → Providers → Email:** Toggle ON "Confirm email"
- [ ] **Auth → URL Configuration:** Add `epix-visuals-admin://auth/callback` to Redirect URLs
- [ ] **Auth → URL Configuration:** Add `epix-visuals://reset-password` to Redirect URLs
- [ ] **Storage → Buckets:** Verify `package-images` and `support-media` exist
- [ ] **SQL Editor:** Set `platform_domain` in `platform_settings` to your domain

### 1.3 Portfolio Upload Fix
- [ ] Run migration `20260714000008_fix_portfolio_rls.sql`
- [ ] Test: Create portfolio item → should succeed (no more RLS error)
- **File:** `split-apps/admin-app/app/(admin)/portfolio.tsx`

### 1.4 Package Editor Fix
- [ ] Run migration `20260714000007_add_packages_columns_and_storage.sql`
- [ ] Test: Edit package → add cover image → save → should succeed
- **File:** `split-apps/admin-app/app/(admin)/settings/package-editor.tsx`

### 1.5 Admin Email Confirmation
- [ ] Enable email confirmations in Supabase dashboard
- [ ] Test: Create new admin account → check email for confirmation link
- **File:** `split-apps/admin-app/app/admin/signup.tsx`

### 1.6 User Password Reset
- [ ] Test: Login screen → "Forgot Password" → enter email → check inbox
- [ ] Test: Click link → deep link opens app → enter new password
- **Files:** `split-apps/user-app/app/forgot-password.tsx`, `reset-password.tsx`

### 1.7 Pending Payment Banner
- [ ] Test: User app → Home screen → should show real unpaid galleries (not demo data)
- [ ] Test: User app → Gallery screen → should show real unpaid galleries
- **Files:** `split-apps/user-app/app/(tabs)/home/index.tsx`, `gallery/index.tsx`

### 1.8 BTS Post Redirect
- [ ] Test: Admin → BTS tab → click published post → should navigate to details
- **File:** `split-apps/admin-app/app/(admin)/bts-announcements.tsx`

**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

## PHASE 2 — SETTINGS SCREENS (Core Functionality)

Upgrade all settings screens to production quality.

### 2.1 Transaction Page
- [x] Search + status filter
- [x] Date range filter (Today, 7/30 days, This/Last Month)
- [x] Transaction detail modal (tap to see full info)
- [x] Resend receipt via SMS
- [x] Export CSV
- [x] Retry failed transactions
- [x] Better empty state
- [x] Total revenue stat
- **File:** `split-apps/admin-app/app/(admin)/settings/mpesa-transactions.tsx` (1452 lines)
- **Status:** ✅ Complete

### 2.2 SMS Management
- [x] Removed duplicate `sms-management.tsx`
- [x] Kept `messaging.tsx` (newer, 4 tabs, 2267 lines)
- [x] Credits balance display
- [x] Buy credits via M-Pesa
- [x] Super admin: credit packages, balances, revenue
- [x] Compose, Templates, History, Analytics tabs
- [x] Updated all route references
- **File:** `split-apps/admin-app/app/(admin)/settings/messaging.tsx`
- **Status:** ✅ Complete

### 2.3 Branding Page
- [x] 4-tab layout (Brand, Design, Social, Contact)
- [x] Live preview with phone mockup
- [x] Logo upload with crop
- [x] Color picker (presets + custom hex)
- [x] Watermark configuration
- [x] Social media links (7 platforms)
- [x] Contact information
- [x] Save status indicator
- **File:** `split-apps/admin-app/app/(admin)/settings/branding.tsx` (1422 lines)
- **Status:** ✅ Complete

### 2.4 Delivery Gateways
- [x] 4 cloud storage providers (Supabase, Cloudinary, AWS S3, Google Cloud)
- [x] Gateway configuration
- [x] Migration tool between providers
- [x] CDN settings
- [x] Auto-cleanup with retention policies
- [x] Storage stats
- **File:** `split-apps/admin-app/app/(admin)/settings/delivery.tsx` (1681 lines)
- **Status:** ✅ Complete

### 2.5 Notification Screen
- [x] History tab with real notification data
- [x] Mark read/unread
- [x] Real-time subscription
- [x] Preferences tab (load/save to DB)
- [x] Pull-to-refresh
- **File:** `split-apps/admin-app/app/(admin)/settings/notifications.tsx` (701 lines)
- **Status:** ✅ Complete

### 2.6 Settings Cleanup
- [x] Deleted `watermark.tsx` (branding.tsx has better watermark)
- [x] Deleted `sms-management.tsx` (messaging.tsx is newer)
- [x] Removed Portfolio from settings menu
- [x] USSD Settings marked "Coming Soon"
- [x] Updated `_layout.tsx` routes
- **Status:** ✅ Complete

**Phase 2 Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

## PHASE 3 — FEATURE SCREENS (Admin)

Implement the remaining admin feature screens.

### 3.1 Reviews Screen
- [x] Stats header (avg rating, total, 5-star count)
- [x] Rating distribution bar chart
- [x] Filter chips (All, Featured, 5★-1★)
- [x] Review cards with avatar, rating, text, date
- [x] Feature/unfeature reviews
- [x] Reply to reviews (modal)
- [x] Delete reviews with confirmation
- [x] Empty state
- **File:** `split-apps/admin-app/app/(admin)/reviews.tsx` (669 lines)
- **Status:** ✅ Complete

### 3.2 Referrals Screen
- [x] Tier system (Bronze/Silver/Gold)
- [x] Referral code with copy + regenerate
- [x] Shareable link with deep link
- [x] Stats dashboard
- [x] Referral history
- [x] Credit balance
- [x] QR code generation
- [x] Share buttons (native, WhatsApp, SMS)
- **File:** `split-apps/admin-app/app/(admin)/referrals.tsx` (666 lines)
- **Status:** ✅ Complete

### 3.3 Support Chat
- [x] Per-admin chat channels
- [x] Message types (text, image, file)
- [x] Read receipts
- [x] Typing indicators
- [x] Quick replies
- [x] Issue categories
- [x] Priority levels
- [x] Search messages
- [x] WhatsApp fallback
- **File:** `split-apps/admin-app/app/(admin)/support.tsx` (1232 lines)
- **Status:** ✅ Complete

### 3.4 Social Media Integration
- [x] OAuth for Instagram, Facebook, TikTok
- [x] Connected accounts display
- [x] Share gallery to social
- [x] Auto-post settings
- [x] Post history
- [x] Disconnect with confirmation
- [x] Token refresh
- **Edge Functions:** `social-connect`, `social-callback`, `share-tiktok`
- **File:** `split-apps/admin-app/app/(admin)/social.tsx` (1185 lines)
- **Status:** ✅ Complete

**Phase 3 Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

## PHASE 4 — USER APP FIXES

Fix the user-facing issues.

### 4.1 Gallery Detail Thumbnails
- [ ] Verify photo URLs are being signed correctly
- [ ] Add debug logging to trace URL resolution
- [ ] Add visual placeholder for failed images
- **File:** `split-apps/admin-app/app/(admin)/clients/gallery/[id].tsx`
- **Status:** ⬜ In Progress

### 4.2 Gallery List Thumbnails
- [ ] Verify cover photos load correctly
- [ ] Test with real uploaded photos
- **File:** `split-apps/admin-app/app/(admin)/upload/index.tsx`
- **Status:** ⬜ Not Started

### 4.3 User App Notifications
- [ ] Verify notifications load from backend
- [ ] Test notification actions (redirect to gallery/payment)
- **File:** `split-apps/user-app/app/notifications.tsx`
- **Status:** ⬜ Not Started

**Phase 4 Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

## PHASE 5 — SMS ENGINE FULL REDESIGN

Complete SMS system across all apps.

### 5.1 Super Admin Dashboard
- [ ] SMS credit package management (create/edit/delete)
- [ ] View all admin balances
- [ ] Manual credit adjustment
- [ ] SMS revenue tracking
- [ ] Gateway configuration
- **File:** `super-admin-dashboard/src/app/dashboard/page.tsx`
- **Status:** ⬜ Not Started

### 5.2 Admin SMS Gateway
- [ ] Credits balance display
- [ ] Buy credits via M-Pesa
- [ ] SMS compose (deducts credits)
- [ ] Templates management
- [ ] History with delivery status
- [ ] Analytics (sent, delivered, failed)
- **File:** `split-apps/admin-app/app/(admin)/settings/messaging.tsx`
- **Status:** ✅ Complete

### 5.3 User SMS Receipts
- [ ] Gallery access code SMS
- [ ] Payment confirmation SMS
- [ ] Booking confirmation SMS
- **Files:** Various edge functions
- **Status:** ⬜ Not Started

**Phase 5 Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

## PHASE 6 — POLISH & TESTING

Final quality pass.

### 6.1 Type Checking
- [ ] Run `npx tsc --noEmit` on admin-app
- [ ] Run `npx tsc --noEmit` on user-app
- [ ] Fix all TypeScript errors
- **Status:** ⬜ Not Started

### 6.2 Lint Check
- [ ] Run `npx eslint` on both apps
- [ ] Fix all lint warnings
- **Status:** ⬜ Not Started

### 6.3 E2E Testing
- [ ] Test full admin flow: Login → Create Gallery → Upload → Share
- [ ] Test full user flow: Login → View Gallery → Pay → Download
- [ ] Test password reset flow
- [ ] Test SMS sending flow
- [ ] Test social media sharing
- **Status:** ⬜ Not Started

### 6.4 Performance
- [ ] Check for memory leaks in realtime subscriptions
- [ ] Verify image loading performance
- [ ] Test pagination on large datasets
- **Status:** ⬜ Not Started

**Phase 6 Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete

---

## Migrations Summary

| # | File | Purpose | Status |
|---|------|---------|--------|
| 1 | `20260714000007_add_packages_columns_and_storage.sql` | Package columns + bucket | ✅ Created |
| 2 | `20260714000008_fix_portfolio_rls.sql` | Portfolio RLS fix | ✅ Created |
| 3 | `20260716000000_admin_notification_preferences.sql` | Notification prefs | ✅ Created |
| 4 | `20260716000004_reviews_upgrade.sql` | Reviews columns | ✅ Created |
| 5 | `20260716000002_upgrade_support_chat.sql` | Support chat | ✅ Created |
| 6 | `20260716000003_sms_credit_packages.sql` | SMS credits | ✅ Created |

**Run order:** 1 → 2 → 3 → 4 → 5 → 6

---

## Files Modified Summary

| File | Lines | Status |
|------|-------|--------|
| `settings/index.tsx` | 354 | ✅ Updated |
| `settings/watermark.tsx` | — | ✅ Deleted |
| `settings/sms-management.tsx` | — | ✅ Deleted |
| `settings/messaging.tsx` | 2267 | ✅ Rewritten |
| `settings/mpesa-transactions.tsx` | 1452 | ✅ Rewritten |
| `settings/branding.tsx` | 1422 | ✅ Rewritten |
| `settings/delivery.tsx` | 1681 | ✅ Rewritten |
| `settings/notifications.tsx` | 701 | ✅ Rewritten |
| `settings/package-editor.tsx` | 630 | ✅ Fixed |
| `reviews.tsx` | 669 | ✅ Rewritten |
| `referrals.tsx` | 666 | ✅ Rewritten |
| `support.tsx` | 1232 | ✅ Rewritten |
| `social.tsx` | 1185 | ✅ Rewritten |
| `bts-announcements.tsx` | — | ✅ Fixed |
| `user-app/forgot-password.tsx` | 269 | ✅ Fixed |
| `user-app/reset-password.tsx` | 130 | ✅ Created |
| `user-app/+native-intent.tsx` | 43 | ✅ Updated |
| `home/index.tsx` | 1859 | ✅ Fixed |
| `gallery/index.tsx` | — | ✅ Fixed |

---

## Known Issues

### `useNativeDriver: true` on Web
- **64 instances** across user-app files
- `useNativeDriver: true` causes warnings/errors on web
- Fix: Replace with `useNativeDriver: Platform.OS !== 'web'` in all Animated calls
- Files affected: signup, roadblock, home, gallery, chat, login, notifications, profile, payment-success, index, onboarding, forgot-password, auth-required, UpdateBanner, ProfileEditModal, PaymentModal
- **Priority: Medium** — Functional on web but causes console warnings

### `expo-file-system/legacy` Import on Web
- **Fixed:** gallery/index.tsx now uses conditional `require('expo-file-system')` for native only
- **Also fixed:** Root `app/(tabs)/gallery/index.tsx` (monolithic app)

---

## How to Use This File

1. **Start with Phase 1** — Run migrations, configure dashboard, test critical fixes
2. **Phase 2-3** are already complete (code written)
3. **Phase 4** needs testing with real data
4. **Phase 5** needs super admin dashboard work
5. **Phase 6** is the final polish pass

Check off items as you complete them. Mark status as:
- ⬜ Not Started
- 🔄 In Progress
- ✅ Complete
- ❌ Blocked (add note why)
