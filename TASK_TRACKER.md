# Epix Visuals - Comprehensive Task Tracker

**Last Updated:** July 16, 2026  
**Supabase Project:** `gghqurnamjdxoriuuopf`  
**Deep Link Scheme:** `epix-visuals` / `epix-visuals-admin`

---

## Completed Tasks

### 1. Package Editor Fixes ✅
- [x] Added `cover_image_url`, `description`, `detailed_description`, `is_popular` columns to `packages` table
- [x] Created `package-images` storage bucket with RLS policies
- [x] Fixed deprecated `ImagePicker.MediaTypeOptions.Images` → `['images']`
- **Migration:** `20260714000007_add_packages_columns_and_storage.sql`

### 2. Settings Cleanup ✅
- [x] Removed duplicate `watermark.tsx` (kept `branding.tsx` which has embedded watermark + logo support)
- [x] Removed Portfolio from settings menu (kept in BTS announcements)
- [x] Marked USSD Settings as "Coming Soon" with alert
- [x] Removed `sms-management.tsx` (kept `messaging.tsx` which is newer with 4 tabs)
- [x] Updated all `sms-management` route references to `messaging`

### 3. Portfolio Upload RLS Fix ✅
- [x] Fixed RLS policies on `portfolio_items` table
- [x] Created clean INSERT/SELECT/UPDATE/DELETE policies for admins
- **Migration:** `20260714000008_fix_portfolio_rls.sql`

### 4. Pending Payment Feature ✅
- [x] Added `realUnpaidGalleries` state that queries real DB even in demo mode
- [x] Updated `pendingPaymentGalleries` useMemo to use real data
- **Files:** `home/index.tsx`, `gallery/index.tsx`

### 5. BTS Post Redirect Fix ✅
- [x] Fixed navigation params to include `type: 'bts'` when clicking BTS posts
- **File:** `bts-announcements.tsx`

### 6. Admin Email Confirmation ✅
- [x] Added `emailRedirectTo: 'epix-visuals-admin://auth/callback'` to signup
- [x] Enabled `enable_confirmations = true` in `config.toml`
- [x] Fixed Supabase URL/key in `lib/supabase.ts`
- **Dashboard Required:** Enable email confirmations in Supabase Auth settings

### 7. User Password Reset ✅
- [x] Replaced OTP flow with proper `resetPasswordForEmail`
- [x] Created `reset-password.tsx` deep link handler
- [x] Added `+native-intent.tsx` routing for reset-password
- [x] Registered screens in `_layout.tsx`
- **Flow:** Login → Forgot Password → Email → Deep Link → New Password

### 8. Transaction Page Upgrade ✅
- [x] Resend Receipt via SMS
- [x] Export CSV (web + native)
- [x] Date Range Filter (Today, 7/30 days, This/Last Month)
- [x] Transaction Detail Modal with full info
- [x] Pull-to-Refresh
- [x] Better Empty State
- [x] Total Revenue stat card
- [x] Retry Failed transactions
- **File:** `mpesa-transactions.tsx`

### 9. Reviews Screen Upgrade ✅
- [x] Stats header (average rating, total reviews, 5-star count)
- [x] Rating distribution bar chart
- [x] Filter chips (All, Featured, 5★-1★)
- [x] Review cards with avatar, name, rating, text, date
- [x] Feature/unfeature reviews
- [x] Reply to reviews (modal with text input)
- [x] Delete reviews with confirmation
- [x] Empty state
- **File:** `reviews.tsx`
- **Migration Needed:** Add `is_featured`, `response`, `response_at` columns to `reviews` table

### 10. Notification Screen Fix ✅
- [x] Created `notification_preferences` table
- [x] Added History tab with real notification data
- [x] Mark read/unread functionality
- [x] Real-time subscription for new notifications
- [x] Pull-to-refresh
- [x] Preferences tab loads from/saves to DB
- **Migration:** `20260716000000_admin_notification_preferences.sql`

### 11. Social Media Integration ✅
- [x] Working OAuth flow for Instagram, Facebook, TikTok
- [x] Connected accounts display with profile info
- [x] Share gallery to social platforms
- [x] Auto-post settings for new galleries/BTS
- [x] Post history with status
- [x] Disconnect with confirmation
- [x] Token refresh for expired connections
- **Edge Functions:** `social-connect`, `social-callback`, `share-tiktok`
- **File:** `social.tsx`
- **Env Vars Needed:** `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`

### 12. Referrals Screen ✅
- [x] Tier system (Bronze/Silver/Gold)
- [x] Referral code with copy + regenerate
- [x] Shareable link with deep link
- [x] Stats dashboard (total, successful, pending, credits)
- [x] Referral history with user list
- [x] Credit balance display
- [x] QR code generation
- [x] Share buttons (native, WhatsApp, SMS)
- **File:** `referrals.tsx`

### 13. Support Chat Upgrade ✅
- [x] Per-admin chat channels with master admin
- [x] Message types (text, image, file)
- [x] Read receipts (double-check gold when read)
- [x] Typing indicators with animation
- [x] Quick replies (8 predefined messages)
- [x] Issue categories (General, Billing, Technical, Feature Request, Bug)
- [x] Priority levels (Low/Medium/High/Urgent)
- [x] Search messages
- [x] Notification badge for unread count
- [x] WhatsApp fallback
- **Migration:** `20260716000001_upgrade_support_chat.sql`
- **File:** `support.tsx`

### 14. SMS Gateway Redesign ✅
- [x] Credits balance display
- [x] Buy credits via M-Pesa (STK push)
- [x] Credit packages (set by super admin)
- [x] Compose SMS (deducts credits)
- [x] History with delivery status
- [x] Templates management
- [x] Super admin: revenue tracking, admin balances, manual adjustments
- **Migration:** `20260716000001_sms_credit_packages.sql`
- **File:** `messaging.tsx`

### 15. Branding Page Upgrade ✅
- [x] 4-tab layout (Brand, Design, Social, Contact)
- [x] Live preview with phone mockup
- [x] Logo upload with crop
- [x] Color picker (presets + custom hex)
- [x] Watermark configuration
- [x] Social media links (7 platforms)
- [x] Contact information
- [x] Save status indicator with sync time
- **File:** `branding.tsx`

### 16. Delivery Cloud Storage ✅
- [x] Storage stats (files, size, bandwidth)
- [x] 4 cloud providers (Supabase, Cloudinary, AWS S3, Google Cloud)
- [x] Gateway configuration modal
- [x] Migration tool between providers
- [x] CDN settings (provider, domain, cache TTL)
- [x] Auto-cleanup with retention policies
- **File:** `delivery.tsx`

---

## Pending Migrations (Run in SQL Editor)

```sql
-- 1. Package columns + storage bucket
-- File: 20260714000007_add_packages_columns_and_storage.sql

-- 2. Portfolio RLS fix
-- File: 20260714000008_fix_portfolio_rls.sql

-- 3. Admin notification preferences
-- File: 20260716000000_admin_notification_preferences.sql

-- 4. Support chat upgrade
-- File: 20260716000001_upgrade_support_chat.sql

-- 5. SMS credit packages
-- File: 20260716000001_sms_credit_packages.sql

-- 6. Reviews columns (run manually):
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS response_at TIMESTAMPTZ;

-- 7. Platform settings RLS nuclear fix
-- File: 20260714000006_nuclear_platform_settings_rls.sql

-- 8. Platform domain seed
-- File: 20260714000003_seed_platform_domain.sql

-- 9. Super admin role fix
-- File: 20260714000004_fix_super_admin_rls.sql
```

---

## Dashboard Configuration Required

### Supabase Dashboard
1. **Authentication → Providers → Email:** Enable "Confirm email" toggle
2. **Authentication → URL Configuration:** Add `epix-visuals-admin://auth/callback` to Redirect URLs
3. **Storage → Buckets:** Ensure `package-images`, `support-media` buckets exist (migrations create them)
4. **Set `platform_domain`** in platform_settings table to your domain (e.g., `studio.epix.co`)

### Environment Variables (Edge Functions)
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`
- `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`
- `OPENAI_API_KEY` (for AI features if needed)

---

## File Changes Summary

### Admin App - Settings
| File | Action | Lines |
|------|--------|-------|
| `settings/index.tsx` | Updated | Removed watermark/portfolio, USSD coming soon |
| `settings/_layout.tsx` | Updated | Removed watermark route |
| `settings/watermark.tsx` | **Deleted** | Replaced by branding.tsx |
| `settings/sms-management.tsx` | **Deleted** | Replaced by messaging.tsx |
| `settings/messaging.tsx` | Rewritten | SMS refill engine + super admin |
| `settings/mpesa-transactions.tsx` | Rewritten | Full upgrade with features |
| `settings/branding.tsx` | Rewritten | 4-tab layout + live preview |
| `settings/delivery.tsx` | Rewritten | Cloud storage + CDN + migration |
| `settings/notifications.tsx` | Rewritten | Real backend + history |
| `settings/package-editor.tsx` | Fixed | ImagePicker + cover_image_url |

### Admin App - Screens
| File | Action | Lines |
|------|--------|-------|
| `reviews.tsx` | Rewritten | Full review management |
| `referrals.tsx` | Rewritten | Tier system + QR + credits |
| `support.tsx` | Rewritten | Full chat with typing/read receipts |
| `social.tsx` | Rewritten | OAuth + 3 platforms + auto-post |
| `bts-announcements.tsx` | Fixed | BTS post redirect |

### User App
| File | Action |
|------|--------|
| `app/forgot-password.tsx` | Fixed | Proper resetPasswordForEmail |
| `app/reset-password.tsx` | **New** | Deep link handler |
| `app/+native-intent.tsx` | Updated | Reset password routing |
| `app/_layout.tsx` | Updated | Registered new screens |
| `(tabs)/home/index.tsx` | Fixed | Real unpaid galleries |
| `(tabs)/gallery/index.tsx` | Fixed | Real unpaid galleries |

### Migrations Created
| File | Purpose |
|------|---------|
| `20260714000007_add_packages_columns_and_storage.sql` | Package columns + bucket |
| `20260714000008_fix_portfolio_rls.sql` | Portfolio RLS fix |
| `20260716000000_admin_notification_preferences.sql` | Notification prefs table |
| `20260716000001_upgrade_support_chat.sql` | Support chat columns |
| `20260716000001_sms_credit_packages.sql` | SMS credit system |

### Edge Functions Created
| Function | Purpose |
|----------|---------|
| `social-connect` | Generate OAuth URLs |
| `social-callback` | Handle OAuth callbacks |
| `share-tiktok` | Post to TikTok |
