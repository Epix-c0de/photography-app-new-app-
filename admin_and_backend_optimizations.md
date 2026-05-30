# Admin App & Backend — Full Audit & Optimization Report

> **Project:** Epix Visuals Studios Photography App  
> **Supabase Project:** `gghqurnamjdxoriuuopf`  
> **Date:** May 2026  
> **Scope:** Admin app screens, backend services, payment flows, upgrade recommendations

---

## Table of Contents

1. [Admin Screen-by-Screen Audit](#1-admin-screen-by-screen-audit)
2. [Backend Services Audit — AdminService](#2-backend-services-audit--adminservice)
3. [Backend Services Audit — ClientService](#3-backend-services-audit--clientservice)
4. [Payment Flow Audit — PaymentModal](#4-payment-flow-audit--paymentmodal)
5. [Edge Functions Audit](#5-edge-functions-audit)
6. [Priority Fix List](#6-priority-fix-list)
7. [Upgrade Recommendations](#7-upgrade-recommendations)
8. [Summary Table](#8-summary-table)

---

## 1. Admin Screen-by-Screen Audit


### 1.1 Dashboard (`app/(admin)/dashboard/index.tsx`)

**What Works**
- Loads real analytics from `AdminService.dashboard.getAnalytics()` on mount
- Displays total revenue, today's revenue, this month's revenue
- Shows stat cards: Clients, Galleries, Conversion Rate, Repeat Rate
- Engagement analytics: Views, Likes, Comments, Link Clicks
- SMS balance card with refill shortcut
- Pending payments list (unpaid galleries)
- Upcoming bookings list
- Quick action buttons: Upload Gallery, Add Client, Pending Pay, Today's Shoots
- Revenue bar chart (animated, weekly view)
- Admin guard check via `verifyAdminGuard('open_dashboard')` before rendering

**What's Broken / Issues**
- `viewMode` state and `BusinessForecast` component were removed but the JSX still references `viewMode === 'overview'` and `viewMode === 'forecast'` conditionals — this causes a **ReferenceError** at runtime. The `forecastSummary` block and `BusinessForecast` render are dead code that must be cleaned up.
- Revenue chart uses `weeklyRevenuePlaceholder` (all zeros) — no real weekly breakdown is fetched from the DB. The `+0%` badge is hardcoded.
- `upcomingBookings` is always set to `[]` — the bookings fetch is not wired up on the dashboard.
- `conversionRate` and `repeatClientRate` are returned from `AdminService.dashboard.getAnalytics()` but the calculation logic in that service needs verification.
- Engagement stats (views, likes, comments, clicks) depend on `portfolio_items` and `gallery_photos` tables having proper counters — these may be zero if the counters are not being incremented.

**Upgrade Suggestions**
- Replace placeholder chart with real weekly revenue data fetched from `payments` table grouped by day.
- Add a "Today's Shoots" count pulled from `bookings` where `date = today`.
- Add a real-time subscription on `payments` so the revenue card updates live without a page refresh.
- Add a storage usage card showing GB used vs. Supabase plan limit.


### 1.2 Clients (`app/(admin)/clients/index.tsx`)

**What Works**
- Lists all clients from `AdminService.clients.list()` (merges `user_profiles` + `clients` CRM table)
- Shows client name, phone, email, loyalty level, total spent
- Upload shortcut button navigates to `/upload` with client pre-selected
- Client gallery view accessible via `clients/gallery/[id].tsx`

**What's Broken / Issues**
- `total_galleries` is always `0` — the service does not count galleries per client. It needs a join or a separate count query.
- `total_spent` maps to `crmData?.total_paid` but `total_paid` is only updated when a payment is manually confirmed — it does not auto-update from `mpesa_transactions`.
- Clients created via the app signup (no CRM record yet) show `id: temp-{uuid}` — these temp IDs can cause issues if passed to gallery creation before a real `clients` row exists.
- No search/filter functionality on the clients list.
- No pagination — if there are 200+ clients, the entire list loads at once.

**Upgrade Suggestions**
- Add a gallery count column: `SELECT COUNT(*) FROM galleries WHERE client_id = ?`
- Add search bar with debounced filter on name/phone/email.
- Add pagination or infinite scroll (load 20 at a time).
- Add a "Last Active" column showing the most recent message or gallery unlock date.


### 1.3 Bookings (`app/(admin)/admin-bookings/index.tsx`)

**What Works**
- Loads bookings from `AdminService.bookings.list()` with client profile join
- Filter chips: All / Pending / Confirmed / Completed / Cancelled with live counts
- Booking cards show client avatar, name, phone, date, time, location, package, status
- Confirm / Reschedule / Complete / Cancel / Re-open actions
- Reschedule modal with inline calendar picker
- Booking actions modal (tap card → modal with status buttons)
- Calendar manager modal for setting admin availability (available / busy / partial)
- Sends in-app notification to client on status change
- Packages button in header navigates to `/settings/package-editor`

**What's Broken / Issues**
- `booking.amount` is always `0` — the transform maps `amount: 0` with a comment "We'll need to get this from packages table". The packages join is missing.
- `booking.depositPaid` is always `false` — no deposit tracking is implemented.
- `booking.type` is hardcoded to `'Session'` — the actual shoot type is not pulled from the booking or package.
- `clientId` mapping uses `userIdToClientId` from a separate clients query, but if a client has no `clients` row yet, `clientId` will be `undefined` — notifications will silently fail.
- The calendar availability feature writes to `admin_calendar_availability` table — verify this table exists in migrations.
- No SMS notification sent on reschedule (only in-app notification).

**Upgrade Suggestions**
- Fix the packages join: add `packages (name, price, shoot_type)` to the bookings select query.
- Add deposit tracking: a `deposit_paid` boolean column on `bookings` table.
- Send SMS on booking confirmation and reschedule via `AdminService.notifications.sendSms()`.
- Add a Kanban view (drag-and-drop columns: Pending → Confirmed → Completed).


### 1.4 Inbox (`app/(admin)/inbox/index.tsx`)

**What Works**
- Real-time message subscription via Supabase channel
- Unread badge count on the Inbox tab icon (updated live)
- Admin presence ping every 15 seconds via broadcast channel
- Messages marked as read when opened

**What's Broken / Issues**
- The unread count in `_layout.tsx` queries `messages` with `sender_role=eq.client` and `is_read=eq.false` — but does not filter by `owner_admin_id`. If multiple admins exist, all admins see each other's unread counts.
- No thread list — the inbox likely shows a flat message list rather than grouped conversations per client.
- No file/image attachment support in messages.

**Upgrade Suggestions**
- Filter unread count by `owner_admin_id = user.id`.
- Add conversation threading: group messages by `client_id` and show a thread list with last message preview.
- Add image attachment support using Supabase Storage.

### 1.5 BTS & Announcements (`app/(admin)/bts-announcements.tsx`)

**What Works**
- Create BTS posts and announcements
- Accessible from the "Create" tab in the nav bar
- Post details accessible via navigation (hidden from nav bar as `post-details`)

**What's Broken / Issues**
- No image/video upload progress indicator.
- No scheduled post feature visible in the UI (the DB supports `scheduled_for` but the UI may not expose it).
- No draft saving — if the admin navigates away mid-post, content is lost.

**Upgrade Suggestions**
- Add scheduled post date/time picker.
- Add draft auto-save to AsyncStorage.
- Add post preview before publishing.


### 1.6 Upload (`app/(admin)/upload.tsx`)

**What Works**
- Gallery creation with client selection
- Direct photo upload via `AdminService.gallery.uploadPhotoDirect()`
- Watermark toggle per gallery
- Access code generation (unique, collision-checked)
- Cover photo auto-set to first uploaded photo
- Accessible from Clients tab via shortcut button

**What's Broken / Issues**
- No chunked/resumable upload — large RAW files (50MB+) will fail on slow connections with no recovery.
- No background upload — navigating away from the screen cancels all in-progress uploads.
- No upload progress per file — only a global spinner.
- No duplicate detection at the UI level (the service generates a SHA-256 checksum but only in the Edge Function path, not the direct upload path).
- The `admin_upload_init` / `admin_upload_file` / `admin_upload_confirm` Edge Function path is available but the UI uses `uploadPhotoDirect` which bypasses it entirely.

**Upgrade Suggestions**
- Switch to the Edge Function upload path (`admin_upload_init` → `admin_upload_file` → `admin_upload_confirm`) for proper chunking and checksum deduplication.
- Add per-file progress bars using `XMLHttpRequest` upload events.
- Implement background upload using Expo's `expo-background-fetch` or a task queue stored in AsyncStorage.
- Add a "Resume Upload" button if the app is closed mid-upload.

### 1.7 Settings (`app/(admin)/settings/index.tsx`)

**What Works**
- Three tabs: General, Links, Security & Login
- Branding settings (brand name, tagline, app display name) — saved to `branding_settings` table via `BrandingContext`
- Watermark settings (text, opacity, rotation, size, position) with live preview
- Auto-SMS on upload toggle (saved to AsyncStorage)
- Auto-lock galleries toggle (saved to AsyncStorage)
- Screenshot protection toggle
- Dark mode toggle (UI only, no system effect)
- SMS refill via M-Pesa STK push (`buy_sms` Edge Function)
- Test SMS send (`send_sms` Edge Function)
- Custom links (share app link, access code delivery link) — saved to `admin_settings` table
- Change email / change password forms
- Activity log (hardcoded mock data — not real)
- Logout with confirmation

**What's Broken / Issues**
- Activity log is hardcoded mock data (`activityLog` array with static strings). It is not fetched from any real audit log table.
- `autoSmsOnUpload` and `autoLockGalleries` are saved to AsyncStorage only — they are not synced to the `admin_settings` table, so they reset if the app is reinstalled.
- The `Links` tab and the `Watermark` section in the `General` tab both contain the same share/access code link inputs — this is a duplicate UI bug.
- `screenshotProtection` toggle saves to branding but has no actual native implementation (Expo does not natively block screenshots without a custom native module).
- `darkModeOnly` toggle has no effect — it does not change the app theme.
- Change email flow calls `supabase.auth.updateUser()` but does not handle the OTP verification step properly (the `emailOtp` field exists in state but the submit handler is not shown in the visible code).
- `adminPhone` falls back to a hardcoded `'+254711111111'` if the user has no phone — SMS refill would go to the wrong number.

**Upgrade Suggestions**
- Replace hardcoded activity log with a real query: `SELECT * FROM admin_audit_log WHERE admin_id = ? ORDER BY created_at DESC LIMIT 20`.
- Sync `autoSmsOnUpload` and `autoLockGalleries` to `admin_settings` table on toggle.
- Remove the duplicate link inputs from the Watermark section (keep only in the Links tab).
- Add a real audit log table and trigger that records admin actions (login, gallery create, payment confirm, etc.).


### 1.8 Package Editor (`app/(admin)/settings/package-editor.tsx`)

**What Works**
- Accessible from the Bookings screen header (Packages button)
- Create, edit, delete photography packages
- Packages are stored in the `packages` table and used in the booking flow

**What's Broken / Issues**
- Package prices are not automatically reflected in booking `amount` field (see Bookings audit above).
- No package categories or shoot type tags.
- No ability to set a package as "featured" or "most popular" for the client-facing booking screen.

**Upgrade Suggestions**
- Add a `is_featured` flag to packages.
- Add package categories (Wedding, Portrait, Corporate, etc.).
- Show a live preview of how the package card looks to clients.

---

## 2. Backend Services Audit — AdminService

**File:** `split-apps/admin-app/services/admin.ts`

### 2.1 Profile & Auth

| Method | Status | Notes |
|--------|--------|-------|
| `profile.get()` | ✅ Works | Fetches from `user_profiles` |
| `profile.update()` | ✅ Works | Updates name/avatar |
| `profile.uploadAvatar()` | ✅ Works | Uploads to `avatars` bucket |
| `ensureAdminProfile()` | ✅ Works | Self-heals role if wrong, creates profile if missing |

**Issue:** `ensureAdminProfile()` is called on every gallery/client create. This adds an extra DB round-trip on every write operation. Consider caching the result for the session duration.


### 2.2 Client Management

| Method | Status | Notes |
|--------|--------|-------|
| `clients.list()` | ✅ Works | Merges `user_profiles` + `clients` CRM |
| `clients.listAll()` | ✅ Works | Used for modals (Inbox, Upload) |
| `clients.create()` | ✅ Works | 15s timeout guard, inserts to `clients` |
| `clients.update()` | ✅ Works | Updates CRM fields |
| `clients.subscribe()` | ✅ Works | Real-time channel on `clients` table |

**Issues:**
- `clients.list()` does not count galleries per client (`total_galleries: 0` always).
- `clients.list()` fetches ALL `user_profiles` with `role='client'` regardless of `owner_admin_id`. In a multi-admin setup, Admin A sees Admin B's clients. Add `.eq('owner_admin_id', user.id)` filter on the `clients` join.
- `total_spent` maps to `crmData?.total_paid` but this field is not auto-updated from payment confirmations.

### 2.3 Gallery Management

| Method | Status | Notes |
|--------|--------|-------|
| `gallery.list()` | ✅ Works | Fetches all galleries, generates signed URLs |
| `gallery.create()` | ✅ Works | Uses Edge Function `admin_upload_init` |
| `gallery.createSimple()` | ✅ Works | Direct DB insert, bypasses Edge Functions |
| `gallery.uploadPhotoDirect()` | ✅ Works | Direct Storage + DB insert |
| `gallery.uploadPhoto()` | ✅ Works | Edge Function path with checksum |
| `gallery.completeUpload()` | ✅ Works | Finalizes upload session |
| `gallery.getPhotos()` | ✅ Works | Paginated, supports array of gallery IDs |
| `gallery.getByClient()` | ✅ Works | Filters by `client_id` |
| `gallery.update()` | ✅ Works | Generic update |
| `gallery.subscribe()` | ✅ Works | Real-time channel |

**Issues:**
- `gallery.list()` fetches ALL galleries (no `owner_admin_id` filter). In a multi-admin setup this is a security issue — Admin A can see Admin B's galleries.
- Signed URLs expire in 3600 seconds (1 hour). If a client keeps the app open for more than 1 hour, images will 403. Consider refreshing URLs on focus or using longer expiry.
- `gallery.uploadPhotoDirect()` does not generate a SHA-256 checksum — duplicate photos can be uploaded silently.
- `USE_MOCK` flag is checked in several methods but `EXPO_PUBLIC_USE_MOCK_DATA` is not set in the `.env` files — mock mode is effectively disabled, which is correct for production.


### 2.4 Bookings

| Method | Status | Notes |
|--------|--------|-------|
| `bookings.list()` | ✅ Works | Fetches from `bookings` with profile join |
| `bookings.updateStatus()` | ✅ Works | Updates status field |
| `bookings.reschedule()` | ✅ Works | Updates date/time fields |

**Issues:**
- `bookings.list()` does not join `packages` — so `packageName` and `amount` are always unknown/zero in the UI.
- No `bookings.create()` method on the admin side — admins cannot manually create bookings from the admin app.

### 2.5 Notifications

| Method | Status | Notes |
|--------|--------|-------|
| `notifications.create()` | ✅ Works | Inserts to `notifications` table |
| `notifications.sendSms()` | ✅ Works | Invokes `send_sms` Edge Function |

**Issues:**
- `notifications.create()` does not check if the client has push notifications enabled. Silent failures if the client has no push token.

### 2.6 Dashboard Analytics

| Method | Status | Notes |
|--------|--------|-------|
| `dashboard.getAnalytics()` | ✅ Works | Aggregates revenue, client counts, engagement |

**Issues:**
- `conversionRate` and `repeatClientRate` calculations are not visible in the truncated service file — need to verify the SQL/JS logic is correct.
- No weekly revenue breakdown returned — the dashboard chart uses placeholder zeros.
- `smsBalance` is fetched from `admin_settings.sms_credits` — verify this field is updated when SMS credits are purchased.

---

## 3. Backend Services Audit — ClientService

**File:** `split-apps/user-app/services/client.ts`

### 3.1 Profile

| Method | Status | Notes |
|--------|--------|-------|
| `profile.getMe()` | ✅ Works | Fetches `user_profiles` |
| `profile.update()` | ✅ Works | Updates name/phone/email |

### 3.2 Gallery & Photos

| Method | Status | Notes |
|--------|--------|-------|
| `gallery.list()` | ✅ Works | Fetches galleries by `client_id` |
| `gallery.getPhotos()` | ✅ Works | Signed URLs, watermark variant logic |

**Issues:**
- `gallery.list()` fetches by `client_id` from the `clients` table. If the user has no `clients` row yet (new signup), they see zero galleries even if they have unlocked galleries via access code. The `unlocked_galleries` table is not checked here.
- `gallery.getPhotos()` generates signed URLs for every photo on every call — no caching. For a 200-photo gallery this is 200 individual signed URL requests. Should use `createSignedUrls()` (batch) instead of individual calls.
- Thumbnail URL generation tries two buckets (`thumbnails` then `client-photos`) — if neither has a thumbnail, it falls back to the full image. This means clients on slow connections load full-res images as thumbnails.


### 3.3 Payments

| Method | Status | Notes |
|--------|--------|-------|
| `payment.initiateStkPush()` | ✅ Works | Invokes `stk_push` Edge Function |

**Issues:**
- No `payment.checkStatus()` method — polling is done inline in `PaymentModal.tsx` directly against the `mpesa_transactions` table. This logic should be encapsulated in the service.
- No `payment.getHistory()` method — clients cannot see their payment history.

### 3.4 Messaging

| Method | Status | Notes |
|--------|--------|-------|
| `messaging.list()` | ✅ Works | Fetches messages by `client_id` |
| `messaging.send()` | ✅ Works | Inserts message with `sender_role='client'` |
| `messaging.getClientForAdmin()` | ✅ Works | Resolves client record for a given admin |

**Issues:**
- `messaging.list()` fetches ALL messages for a client — no pagination. A client with 1000+ messages will load them all at once.
- No real-time subscription method in `ClientService.messaging` — the chat screen likely sets up its own channel directly.
- No message read receipts from the client side.

### 3.5 Announcements

| Method | Status | Notes |
|--------|--------|-------|
| `announcements.list()` | ✅ Works | Fetches active, non-expired announcements |
| `announcements.get()` | ✅ Works | Single announcement with comments/reactions |
| `announcements.addComment()` | ✅ Works | Inserts to `announcement_comments` |
| `announcements.addReaction()` | ✅ Works | Toggle reaction (insert/delete) |
| `announcements.deleteComment()` | ✅ Works | Deletes own comment |
| `announcements.subscribeToAnnouncements()` | ✅ Works | Real-time channel |
| `announcements.subscribeToComments()` | ✅ Works | Per-announcement channel |
| `announcements.subscribeToReactions()` | ✅ Works | Per-announcement channel |

**Issues:**
- `announcements.addComment()` requires a `clients` row for the user. New users without a `clients` row will get "Client record not found" error when trying to comment.
- `announcements.addReaction()` catches `23505` (unique violation) silently — this is correct behavior for toggle, but the error suppression hides other potential DB errors.

### 3.6 Portfolio

| Method | Status | Notes |
|--------|--------|-------|
| `portfolio.list()` | ✅ Works | Fetches active portfolio items |
| `portfolio.listByType()` | ✅ Works | Filters by `bts` or `portfolio` |
| `portfolio.listTopRated()` | ✅ Works | Filters by `is_top_rated` |
| `portfolio.toggleLike()` | ✅ Works | Insert/delete from `portfolio_likes` |
| `portfolio.incrementShare()` | ✅ Works | RPC with fallback |
| `portfolio.subscribeToPortfolio()` | ✅ Works | Real-time channel |

**Issues:**
- `portfolio.list()` does not include the signed URL for `media_url` — if photos are stored in private Supabase Storage, they will 403. Verify `portfolio_items` uses public URLs or add signed URL generation.
- `likes_count` and `shares_count` are stored as columns on `portfolio_items` — these can get out of sync if the RPC fails. Consider using a DB trigger to keep them accurate.


---

## 4. Payment Flow Audit — PaymentModal

**File:** `split-apps/user-app/components/PaymentModal.tsx`

### 4.1 Flow Overview

The `PaymentModal` supports three payment paths:

```
1. STK Push (Auto) ─── mpesa-stk-push Edge Function ─── polls mpesa_transactions
2. Manual (Admin verifies) ─── manual_payments table ─── polls manual_payments
3. Manual Message ─── mpesa_messages table ─── admin reviews in inbox
```

### 4.2 STK Push Flow (Auto Verification)

**Steps:**
1. User enters phone number → taps "Pay via STK Push"
2. `supabase.functions.invoke('mpesa-stk-push', { phone_number, amount, gallery_id, reference })`
3. M-Pesa sends STK prompt to user's phone
4. User enters PIN on phone
5. M-Pesa callback hits `mpesa-callback` Edge Function → updates `mpesa_transactions` table
6. `PaymentModal` polls `mpesa_transactions` every 2 seconds for up to 90 seconds
7. On `status='success'` → calls `onSuccess()` → gallery unlocked

**What Works**
- Full STK push initiation and polling loop
- Handles `checkout_request_id` from multiple response key formats (`checkout_request_id`, `CheckoutRequestID`, `mpesa_checkout_request_id`)
- Timeout after 90 seconds with user-friendly message
- Haptic feedback on success/failure
- Animated modal entrance/exit
- Retry button on failure

**What's Broken / Issues**
- The polling `setInterval` is never stored in a ref — if the modal is closed before the interval fires, the interval keeps running and will call `onSuccess()` / `onClose()` on an unmounted component. This is a **memory leak and potential crash**.
- `paymentState` is read inside the `setInterval` callback but it's a stale closure — `if (attempts > 10 && paymentState === 'waiting')` will always see the initial `paymentState` value, not the current one. Use a ref for `paymentState` or use the functional updater pattern.
- The `startPolling` function is `async` but the `setInterval` callback is not awaited — errors inside the interval are silently swallowed.
- No cleanup on modal close — if the user closes the modal while polling, the interval continues.
- `gallery.price` is used directly as the M-Pesa amount — M-Pesa requires amounts in whole KES integers. If `price` is a float (e.g., `1500.50`), the STK push may fail or round incorrectly.


### 4.3 Manual Payment Flow

**Steps:**
1. Admin has `mpesa_enabled = false` in `simple_payment_settings`
2. Modal shows manual payment instructions (send to M-Pesa number)
3. User taps "I've Sent It" → inserts to `manual_payments` table
4. Modal polls `manual_payments` every 5 seconds for up to 10 minutes
5. Admin verifies in their panel → sets `status='verified'`
6. Poll detects `status='verified'` → `onSuccess()`

**What Works**
- Creates `manual_payments` record with phone, amount, gallery, admin, client IDs
- Polls for admin verification
- 10-minute timeout with user-friendly message

**What's Broken / Issues**
- Same interval leak issue as STK push — interval not stored in ref, not cleaned up on modal close.
- The admin panel does not have a visible "Manual Payments" verification screen in the current nav (it was removed from Settings). Admins have no UI to approve/reject manual payments.
- `gallery.client_id` is used as `client_id` in the `manual_payments` insert — but `client_id` in the `galleries` table is the `clients.id` (CRM record), not the `user_profiles.id`. Verify the `manual_payments` table schema uses the same ID type.

### 4.4 Manual Message (M-Pesa Confirmation Paste)

**Steps:**
1. User pastes their M-Pesa SMS confirmation message
2. Modal extracts M-Pesa transaction code via regex
3. Inserts to `mpesa_messages` table
4. Admin reviews in inbox and manually unlocks gallery

**What Works**
- Regex extraction of M-Pesa code from confirmation message
- Inserts full message + extracted code to `mpesa_messages`
- Clear user feedback after submission

**What's Broken / Issues**
- The regex `(?:Confirmation Code|code|ref)[\s:\[]*([A-Z0-9]+)` may not match all M-Pesa message formats. Safaricom messages vary by transaction type (Paybill, Till, Send Money). A more robust pattern: `/([A-Z0-9]{10})/` (M-Pesa codes are always 10 alphanumeric characters).
- No admin UI to view and act on `mpesa_messages` — the admin inbox does not show these messages separately from chat messages.
- `user_id` in the `mpesa_messages` insert is set to `gallery.client_id` (the CRM `clients.id`) but the column may expect `user_profiles.id`. Verify the schema.

### 4.5 Payment Settings Loading

**What Works**
- Tries `simple_payment_settings` first, falls back to `payment_settings` (advanced Daraja)
- Sets `recipientName` from `business_name` or `shortcode`
- Auto-switches to manual payment state if `mpesa_enabled = false`

**What's Broken / Issues**
- If both `simple_payment_settings` and `payment_settings` return no rows, `paymentSettings` stays `null` and the modal shows the STK push form with no recipient name — the user has no idea who they're paying.
- No error state shown if `loadPaymentSettings()` throws — errors are silently caught with `console.error`.


---

## 5. Edge Functions Audit

**Deployed to:** `gghqurnamjdxoriuuopf` (37 functions deployed)

| Function | Purpose | Status | Issues |
|----------|---------|--------|--------|
| `stk_push` / `mpesa-stk-push` | Initiate M-Pesa STK push | ✅ | Two function names used inconsistently in codebase — `ClientService` calls `stk_push`, `PaymentModal` calls `mpesa-stk-push`. Verify which one is deployed. |
| `mpesa-callback` | Receive M-Pesa payment result | ✅ | Must be idempotent — verify it uses `ON CONFLICT DO NOTHING` or checks for existing `checkout_request_id` before inserting. |
| `send_sms` | Send SMS via provider | ✅ | No retry logic visible — if SMS provider returns 5xx, the function fails silently. |
| `buy_sms` | Purchase SMS credits via M-Pesa | ✅ | Sends STK push to admin phone — verify `adminPhone` is always set before calling. |
| `admin_upload_init` | Initialize gallery upload session | ✅ | Creates upload session record in DB. |
| `admin_upload_file` | Get signed upload URL | ✅ | Returns signed URL + storage path + file UUID. |
| `admin_upload_confirm` | Confirm file upload + create DB record | ✅ | Should verify file exists in storage before inserting `gallery_photos` row. |
| `admin_upload_complete` | Finalize upload session | ✅ | Should trigger watermark/thumbnail generation. |
| `image_pipeline` | Process images (watermark, thumbnail) | ✅ | Runs synchronously — may timeout on large files. Should be async/queued. |
| `delivery-callback` | Handle delivery status callbacks | ✅ | Verify it updates `sms_logs` table correctly. |
| `admin_storage_consistency_check` | Find orphaned storage files | ✅ | Should be scheduled via `pg_cron`, not called manually. |

**Critical Finding:** `stk_push` vs `mpesa-stk-push` naming inconsistency. The `ClientService.payment.initiateStkPush()` calls `stk_push` but `PaymentModal.tsx` calls `mpesa-stk-push`. One of these will 404. Check which function name is actually deployed and standardize.

---

## 6. Priority Fix List

### 🔴 Critical (Breaks Core Functionality)

1. **Dashboard `viewMode` ReferenceError** — Remove all `viewMode === 'overview'` and `viewMode === 'forecast'` conditionals from `dashboard/index.tsx`. The `BusinessForecast` component and `forecastSummary` block are dead code.
2. **PaymentModal interval leak** — Store `setInterval` return value in a `useRef`. Clear it in a `useEffect` cleanup and on modal close.
3. **STK push function name mismatch** — Verify whether the deployed function is `stk_push` or `mpesa-stk-push` and update all callers to use the same name.
4. **Inbox unread count not filtered by admin** — Add `.eq('owner_admin_id', user.id)` to the unread count query in `_layout.tsx`.

### 🟡 High (Broken Features)

5. **Bookings amount always 0** — Add `packages (name, price, shoot_type)` join to `AdminService.bookings.list()`.
6. **Clients total_galleries always 0** — Add gallery count to `AdminService.clients.list()`.
7. **Manual payments no admin UI** — Add a "Pending Payments" section in the admin inbox or bookings screen to approve/reject `manual_payments` records.
8. **Gallery list no owner filter** — Add `owner_admin_id` filter to `AdminService.gallery.list()` for multi-admin security.
9. **Announcement comments fail for new users** — Handle the case where a user has no `clients` row in `announcements.addComment()`.

### 🟢 Medium (UX Issues)

10. **Settings duplicate link inputs** — Remove share/access code link inputs from the Watermark section (keep only in Links tab).
11. **Activity log is fake** — Replace hardcoded activity log with real `admin_audit_log` query.
12. **Gallery signed URLs expire** — Add URL refresh on app foreground/focus.
13. **Photo thumbnail batch signing** — Replace individual `createSignedUrl` calls with `createSignedUrls` (batch) in `ClientService.gallery.getPhotos()`.
14. **M-Pesa code regex** — Update regex to `/([A-Z0-9]{10})/` for more reliable extraction.


---

## 7. Upgrade Recommendations

### 7.1 Upload System — Chunked Resumable Uploads

Replace the current direct upload with a TUS-compatible chunked upload:

```typescript
// Recommended approach using expo-file-system + chunked fetch
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

async function uploadChunked(fileUri: string, galleryId: string) {
  const fileInfo = await FileSystem.getInfoAsync(fileUri, { size: true });
  const totalChunks = Math.ceil((fileInfo.size || 0) / CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    const chunk = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: i * CHUNK_SIZE,
      length: CHUNK_SIZE,
    });
    await uploadChunk(galleryId, chunk, i, totalChunks);
    onProgress((i + 1) / totalChunks);
  }
}
```

### 7.2 Payment — Fix Interval Leak

```typescript
const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

const stopPolling = useCallback(() => {
  if (pollingRef.current) {
    clearInterval(pollingRef.current);
    pollingRef.current = null;
  }
}, []);

useEffect(() => {
  return () => stopPolling(); // cleanup on unmount
}, [stopPolling]);

// In handlePay:
pollingRef.current = setInterval(async () => {
  // ... polling logic
}, 2000);
```

### 7.3 Dashboard — Real Weekly Revenue Chart

```typescript
// Fetch real weekly revenue from payments table
const { data } = await supabase
  .from('payments')
  .select('amount, created_at')
  .eq('status', 'success')
  .gte('created_at', startOfWeek.toISOString())
  .lte('created_at', endOfWeek.toISOString());

// Group by day of week
const weeklyData = Array(7).fill(0);
data?.forEach(p => {
  const day = new Date(p.created_at).getDay();
  weeklyData[day] += p.amount;
});
```

### 7.4 Gallery Photos — Batch Signed URLs

```typescript
// Replace individual createSignedUrl calls with batch
const paths = photos.map(p => p.photo_url);
const { data: signedUrls } = await supabase.storage
  .from('client-photos')
  .createSignedUrls(paths, 3600);

const urlMap = new Map(signedUrls?.map(s => [s.path, s.signedUrl]) || []);
const photosWithUrls = photos.map(p => ({
  ...p,
  url: urlMap.get(p.photo_url) || '',
}));
```

### 7.5 Admin Audit Log

Add a migration to create an audit log table and trigger:

```sql
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES user_profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger example: log gallery creation
CREATE OR REPLACE FUNCTION log_gallery_create()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id)
  VALUES (NEW.owner_admin_id, 'gallery_created', 'gallery', NEW.id::TEXT);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gallery_create_audit
AFTER INSERT ON galleries
FOR EACH ROW EXECUTE FUNCTION log_gallery_create();
```

---

## 8. Summary Table

| Screen / Service | Backend Connected | Real Data | Issues Found | Priority |
|-----------------|------------------|-----------|--------------|----------|
| Dashboard | ✅ Yes | ✅ Partial | viewMode crash, chart zeros, no bookings | 🔴 Critical |
| Clients | ✅ Yes | ✅ Yes | gallery count 0, no owner filter | 🟡 High |
| Bookings | ✅ Yes | ✅ Yes | amount 0, no packages join | 🟡 High |
| Inbox | ✅ Yes | ✅ Yes | unread count not filtered by admin | 🔴 Critical |
| BTS/Announcements | ✅ Yes | ✅ Yes | no draft save, no schedule UI | 🟢 Medium |
| Upload | ✅ Yes | ✅ Yes | no chunked upload, no progress | 🟡 High |
| Settings | ✅ Yes | ✅ Partial | fake activity log, duplicate inputs | 🟢 Medium |
| Package Editor | ✅ Yes | ✅ Yes | price not reflected in bookings | 🟡 High |
| AdminService | ✅ Yes | ✅ Yes | no owner filters, extra DB round-trips | 🟡 High |
| ClientService | ✅ Yes | ✅ Yes | no batch signed URLs, no pagination | 🟢 Medium |
| PaymentModal STK | ✅ Yes | ✅ Yes | interval leak, stale closure, name mismatch | 🔴 Critical |
| PaymentModal Manual | ✅ Yes | ✅ Yes | interval leak, no admin approval UI | 🟡 High |
| Edge Functions | ✅ Deployed | ✅ Yes | function name inconsistency, no retry on SMS | 🔴 Critical |

---

*Document generated from live code audit — May 2026*
