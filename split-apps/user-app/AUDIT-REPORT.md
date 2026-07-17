# Comprehensive Audit Report — `split-apps/user-app`

**Expo Router + React Native + Supabase Client-Facing Mobile App**

**Date:** July 17, 2026
**App Name:** Epix Visuals Studios.co
**SDK:** Expo SDK ~54, React 19.1.0, React Native 0.81.5
**Repo Path:** `C:\Users\karis\NEW APP TEMPLATE\split-apps\user-app`

---

## Executive Summary

The user-app is a client-facing photography studio mobile application built with Expo Router, React Native, and Supabase. Clients use it to view galleries, communicate with photographers, book shoots, make payments, and browse behind-the-scenes content. The app is feature-rich but carries significant technical debt from rapid iteration — particularly around data fetching, code duplication, and configuration inconsistencies.

**Overall Risk Rating: HIGH**

The most dangerous finding is a **duplicate Supabase project URL** across configuration files that can silently route API calls to two different databases, causing data inconsistency. Combined with **unfiltered global queries** that leak data across photographers and **no server-side auth middleware**, these issues represent immediate production risks that require urgent remediation.

---

## Tech Stack Overview

| Layer | Technology |
|---|---|
| Framework | Expo SDK ~54, React 19.1.0, React Native 0.81.5 |
| Routing | Expo Router ~6.0.23 (typed routes enabled) |
| Language | TypeScript ~5.9.2 |
| Backend/DB | Supabase (URL: `ujunohfpcmjywsblsoel.supabase.co`) |
| Auth | Supabase Auth, expo-secure-store, expo-crypto (SHA-256 for PINs) |
| State | React useState/useCallback, zustand (available but underused), `@tanstack/react-query` (installed but NOT used) |
| Data Fetching | Manual `useCallback` + `useState` patterns — no React Query integration |
| Gallery Grids | `@shopify/flash-list` v2.0.2 |
| Media | expo-image, expo-av (video), expo-file-system |
| Animations | react-native-reanimated ~4.1.1, react-native-gesture-handler ~2.28.0 |
| Icons | lucide-react-native |
| Offline | `lib/offline-gallery-cache.ts` exists (SQLite + FileSystem) but is **never imported** by any screen |

---

## Critical Issues

### C1: Duplicate Supabase Project URLs

**Severity:** CRITICAL
**Files:** `app.config.js:6-8`, `lib/supabase.ts:6-7`

```
app.config.js:    'https://ujunohfpcmjywsblsoel.supabase.co'
lib/supabase.ts:  'https://gghqurnamjdxoriuuopf.supabase.co'  (fallback)
```

These are **two entirely different Supabase projects**. The `app.config.js` URL is used as the `EXPO_PUBLIC_SUPABASE_URL` environment variable at build time, which `lib/supabase.ts` then reads via `process.env.EXPO_PUBLIC_SUPABASE_URL`. However, when the env var is missing (e.g., during EAS builds without `.env`), the **fallback URLs differ** — `app.config.js` falls back to one project, while `lib/supabase.ts` falls back to another.

**Impact:** If `EXPO_PUBLIC_SUPABASE_URL` is not set in the build environment, the client will initialize against a completely different Supabase project. Data written by one URL will be invisible to the other. This is a silent data-corruption vector.

**Fix:** Unify the fallback URL across both files. The `lib/supabase.ts` fallback should match `app.config.js`. Better yet, remove inline fallbacks and fail loudly if the env var is missing.

### C2: Unfiltered Global Data Queries on Home Screen

**Severity:** CRITICAL
**File:** `app/(tabs)/home/index.tsx:936-947`

```typescript
// Lines 936-947 — no client/photographer filter applied
const { count: clientCount } = await supabase
  .from('clients')
  .select('id', { count: 'exact', head: true });          // ALL clients globally

const { data: ratingData } = await supabase
  .from('reviews')
  .select('rating');                                        // ALL reviews globally
```

This queries `SELECT * FROM clients` and `SELECT * FROM reviews` **with no filter** — every client and every review across all photographers. The resulting "Trust by X clients" banner displays aggregate stats from the entire platform, not just the linked photographer.

**Impact:** Data leakage — a client linked to Photographer A sees stats for Photographer B's clients. N+1 query potential on large datasets. Unnecessary load on the database.

**Fix:** Filter by `owner_admin_id` matching the user's linked photographer(s), or create an RPC function that computes scoped trust stats.

### C3: No Server-Side Auth Middleware

**Severity:** CRITICAL
**Files:** No `middleware.ts` found in the project

All authentication is managed client-side via `AuthContext`. API routes (if any exist) have no middleware protection. The only server-side protection is Supabase RLS policies on the database.

**Impact:** Any API route added in the future without manual auth checks will be unprotected. RLS policies are the sole defense — misconfigured RLS means full data exposure.

**Fix:** Add a middleware layer for any custom API routes. For Supabase, audit all RLS policies to ensure they properly restrict access. Consider adding Supabase Edge Functions with service-role checks for sensitive operations.

---

## High Severity Issues

### H1: Massive Home Screen Component (1400+ Lines)

**Severity:** HIGH
**File:** `app/(tabs)/home/index.tsx` — 1400+ lines

The `HomeScreen` component handles: BTS feed, announcements, galleries preview, notifications badge, payment alerts, trust stats, quick actions, and deep-link parameter handling — all in a single file. This makes the component brittle, hard to test, and slow to re-render.

**Fix:** Extract into focused components: `BTSFeed`, `AnnouncementFeed`, `GalleryPreview`, `QuickActions`, `TrustBanner`.

### H2: Duplicated Gallery Fetch Logic

**Severity:** HIGH
**Files:** `app/(tabs)/home/index.tsx:569-798`, `app/(tabs)/gallery/index.tsx:664-890`

Both files contain nearly identical `fetchAllClientIds()` and `fetchGalleries()` functions with the same signed-URL resolution, thumbnail map construction, and local unlocked gallery merging logic. The code is ~200 lines duplicated verbatim.

**Fix:** Extract shared logic into `hooks/useGalleries.ts` and `hooks/useClientIds.ts`.

### H3: Realtime Subscriptions with Random Channel Names

**Severity:** HIGH
**Files:** `app/(tabs)/home/index.tsx:967`, `hooks/useAssignmentStatus.ts:156`

```typescript
const channelName = `user_app_home_${Date.now()}_${Math.random()}`;
```

Every mount creates a unique channel name. While cleanup runs on unmount, if a component remounts rapidly (e.g., navigation transitions), multiple subscriptions to the same tables pile up simultaneously.

**Fix:** Use stable, deterministic channel names (e.g., `home_screen_main`). Ensure channels are removed before re-creating.

### H4: Chat Screen Polls Admin Profile Every 5 Seconds

**Severity:** HIGH
**File:** `app/(tabs)/chat/index.tsx:657`

```typescript
const pollInterval = setInterval(fetchAdminProfile, 5000);
```

This polls the `user_profiles` table every 5 seconds for the admin's name and avatar — **even though a realtime subscription to the same table is already active** (lines 665-679). The poll is redundant and generates ~12 unnecessary database queries per minute.

**Fix:** Remove the 5-second `setInterval` and rely solely on the existing realtime subscription. The `AppState` listener for foreground refetch is sufficient.

### H5: Payment Modal Uses Client-Side STK Push Polling

**Severity:** HIGH
**Files:** `components/PaymentModal.tsx` (referenced), `app/(tabs)/bookings/index.tsx`

The M-Pesa STK push payment flow uses client-side polling (30 attempts × 3s = 90s timeout) to confirm payment. There is no webhook or server-side callback for payment confirmation.

**Impact:** If the user closes the app during polling, payment confirmation is lost. Network interruptions can leave payments in an ambiguous state. Duplicate charges are possible without idempotency keys.

**Fix:** Implement a Supabase Edge Function that receives M-Pesa callbacks, confirms payment server-side, and updates the booking/gallery status. Use idempotency keys for all payment operations.

---

## Medium Severity Issues

### M1: `handleDoubleTap` is Actually `onLongPress`

**Severity:** MEDIUM
**File:** `app/(tabs)/gallery/index.tsx:68`

```typescript
const handleDoubleTap = useCallback(() => { ... }, [...]);
// Used as: onLongPress={handleDoubleTap}
```

The function name `handleDoubleTap` implies a double-tap gesture, but it's wired to `onLongPress`. This is misleading for future developers.

**Fix:** Rename to `handleLongPress` or implement an actual double-tap gesture using `react-native-gesture-handler`.

### M2: No App-Level Error Boundary

**Severity:** MEDIUM
**Files:** `components/ErrorBoundary.tsx`, `app/_layout.tsx`

`ErrorBoundary` only wraps the BTS and Galleries sections on the home screen. The chat screen, bookings screen, profile screen, and the root layout have **no error boundaries**. An unhandled error in any of these screens will crash the entire app.

**Fix:** Wrap the root layout's `<Stack>` or each tab's root screen in `<ErrorBoundary>`.

### M3: `BrandingContext` Fetches Platform Settings on Every Render

**Severity:** MEDIUM
**File:** `contexts/BrandingContext.tsx` (referenced in gallery)

The `shareAppLink` fallback logic queries the `platform_settings` table without caching. Each gallery share operation triggers a new database query.

**Fix:** Cache `platform_settings` in memory (or zustand store) with a TTL. Only re-fetch on explicit invalidation.

### M4: Bookings Payment Has No Idempotency

**Severity:** MEDIUM
**File:** `app/(tabs)/bookings/index.tsx`

`handlePaymentSubmit` creates a booking record AND invokes an STK push. If the network fails between these two operations, a booking exists without a corresponding payment.

**Fix:** Use a database transaction or an RPC function that atomically creates the booking and records the payment intent. Add idempotency keys to prevent duplicate processing.

### M5: `useAssignmentStatus` Blocks Unassigned Users

**Severity:** MEDIUM
**File:** `hooks/useAssignmentStatus.ts`, used in `gallery/index.tsx`, `bookings/index.tsx`, `chat/index.tsx`

Any client not linked to a photographer (no `clients` row with a valid `user_id`) is shown an `<UnassignedEmptyState>` on gallery, bookings, and chat screens — making the app completely unusable.

**Impact:** New signups or clients who haven't been linked by their photographer cannot use core features.

**Fix:** Allow read-only access to certain features (e.g., profile, announcements) while showing a gentle "waiting for assignment" state on restricted features.

### M6: `FileSystem` Conditionally Imported with Silent Failure

**Severity:** MEDIUM
**File:** `app/(tabs)/gallery/index.tsx:5-12`

```typescript
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  try { FileSystem = require('expo-file-system'); } catch {}
}
```

If `expo-file-system` fails to load, `FileSystem` stays `null` and any download/save operation will crash with an unhelpful `Cannot read property 'makeDirectoryAsync' of null` error.

**Fix:** Detect `FileSystem === null` at the point of use and show a meaningful error message ("Downloads unavailable on this platform").

---

## Low Severity Issues

### L1: Expo SDK Version Mismatch

**Severity:** LOW
**File:** `package.json:28`

`package.json` shows `"expo": "~54.0.33"` but the initial prompt referenced SDK ~52. The actual SDK version in the codebase is 54, which is the latest stable. The user prompt may have been based on an older snapshot.

**Impact:** No functional issue — the codebase is on SDK 54.

### L2: No Offline Support Strategy

**Severity:** LOW
**File:** `lib/offline-gallery-cache.ts`

A complete offline gallery caching module exists (`cacheGalleryPhotos`, `getCachedPhoto`, `clearGalleryCache`) but it is **never imported** by any screen. The `expo-sqlite` dependency it requires is also not listed in `package.json`.

**Fix:** Either integrate the cache into the gallery screens or remove the dead code.

### L3: `@tanstack/react-query` Installed But Not Used

**Severity:** LOW
**File:** `package.json:27`

`@tanstack/react-query` v5.101.2 is installed as a dependency but no screen or hook uses it. All data fetching is done via manual `useState`/`useCallback` patterns.

**Fix:** Migrate to React Query for automatic caching, deduplication, background refetching, and optimistic updates — or remove the unused dependency.

### L4: Custom Skeleton Replaces `moti`

**Severity:** LOW
**File:** `app/(tabs)/home/index.tsx:21-32`

A lightweight custom `Skeleton` component was added because `moti` rendered a stray `"."` on web. The `moti` package is no longer in `package.json` — the migration is complete. No action needed.

---

## Security Findings

### S1: Supabase Anon Key Hardcoded in `app.config.js`

**Severity:** INFO (Expected for mobile apps)
**File:** `app.config.js:10-12`

The Supabase anon key is embedded in the build config. This is standard practice for mobile apps — the anon key is designed to be public. However, **RLS policies must be airtight** since this key grants direct database access.

**Recommendation:** Audit all RLS policies. Ensure no table allows unauthenticated writes. Test with an anonymous role to verify policy enforcement.

### S2: SHA-256 for PIN Hashing

**Severity:** LOW
**File:** Security setup uses `expo-crypto` with SHA-256

SHA-256 is not ideal for password hashing (bcrypt/argon2 preferred), but for **6-digit numeric PINs** the search space is only 1,000,000 values. The attacker's cost to brute-force is the same regardless of hashing algorithm. This is acceptable for PINs but would be unacceptable for user-chosen passwords.

### S3: Gallery Access Codes Are 6-Digit Numeric

**Severity:** MEDIUM
**Files:** Gallery unlock flow, `galleries.access_code`

Access codes are 6-digit numeric strings (1,000,000 possibilities). If RLS or the `unlock_gallery_and_link` RPC function does not rate-limit attempts, an attacker could brute-force access to any gallery.

**Recommendation:** Add rate limiting to the unlock endpoint (e.g., max 5 attempts per minute per IP/user). Log failed attempts. Lock accounts after repeated failures.

---

## Proposed File Structure

### New Files to Create

```
components/
  home/
    BTSFeed.tsx              # Extract BTS story card + feed from home/index.tsx
    AnnouncementFeed.tsx     # Extract announcement cards + feed
    GalleryPreview.tsx       # Extract gallery preview cards
    QuickActions.tsx          # Extract "Book a Shoot" / "Unlock Gallery" buttons
    TrustBanner.tsx          # Extract "Trusted by X clients" banner
  gallery/
    PhotoCard.tsx            # Extract from gallery/index.tsx (lines 52-204)
    FluidPhotoViewer.tsx     # Extract from gallery/index.tsx (lines 258-346)

hooks/
  useGalleries.ts           # Shared gallery fetching logic (home + gallery)
  useClientIds.ts           # Shared client ID resolution
  useRealtime.ts            # Realtime subscription management with stable channel names
  usePayment.ts             # Payment flow with idempotency

lib/
  error-reporting.ts        # Centralized error handling with Sentry/logging
  supabase-config.ts        # Single source of truth for Supabase URL + key
```

### Files to Modify

```
app/_layout.tsx             # Add root-level ErrorBoundary wrapper
app/(tabs)/home/index.tsx   # Extract sections into imported components
app/(tabs)/gallery/index.tsx # Extract PhotoCard, FluidPhotoViewer
app/(tabs)/chat/index.tsx   # Remove 5s polling, rely on realtime
app.config.js               # Add comment referencing shared config
lib/supabase.ts             # Unify fallback URL with app.config.js
```

---

## Implementation Roadmap

### Phase 1: Critical (Week 1)

| Task | File(s) | Effort |
|---|---|---|
| Unify Supabase URL fallback | `app.config.js`, `lib/supabase.ts` | 30 min |
| Fix trust stats to scope by photographer | `app/(tabs)/home/index.tsx:936-947` | 2 hrs |
| Add root-level ErrorBoundary | `app/_layout.tsx` | 1 hr |
| Extract home screen components | `app/(tabs)/home/index.tsx` → `components/home/*` | 1-2 days |

### Phase 2: High Severity (Week 2)

| Task | File(s) | Effort |
|---|---|---|
| Deduplicate gallery fetch logic | `hooks/useGalleries.ts`, `hooks/useClientIds.ts` | 4 hrs |
| Remove chat 5s polling | `app/(tabs)/chat/index.tsx:657` | 30 min |
| Stabilize realtime channel names | `home/index.tsx`, `useAssignmentStatus.ts` | 2 hrs |
| Implement payment webhook/server confirmation | Supabase Edge Functions | 1-2 days |
| Add payment idempotency keys | `app/(tabs)/bookings/index.tsx` | 4 hrs |

### Phase 3: Medium Severity (Week 3)

| Task | File(s) | Effort |
|---|---|---|
| Integrate offline gallery cache | `lib/offline-gallery-cache.ts` → `gallery/index.tsx` | 1 day |
| Add rate limiting to gallery unlock | Supabase RPC / Edge Function | 2 hrs |
| Cache BrandingContext platform_settings | `contexts/BrandingContext.tsx` | 2 hrs |
| Rename `handleDoubleTap` → `handleLongPress` | `gallery/index.tsx:68` | 15 min |
| Handle `FileSystem === null` gracefully | `gallery/index.tsx` | 1 hr |
| Allow partial access for unassigned users | `useAssignmentStatus.ts`, screen wrappers | 4 hrs |

### Phase 4: Low Severity (Week 4)

| Task | File(s) | Effort |
|---|---|---|
| Remove unused `@tanstack/react-query` dep | `package.json` | 5 min |
| Add analytics/perf monitoring | New integration | 1 day |
| Audit & harden RLS policies | Supabase dashboard | 4 hrs |
| Add accessibility labels to interactive elements | Various screens | 1 day |

---

## Appendix: Key File Sizes (Lines of Code)

| File | Lines | Notes |
|---|---|---|
| `app/(tabs)/home/index.tsx` | 1,400+ | Needs decomposition |
| `app/(tabs)/gallery/index.tsx` | 1,283+ | Needs decomposition |
| `app/(tabs)/bookings/index.tsx` | 2,153 | Very large, needs decomposition |
| `app/(tabs)/chat/index.tsx` | 1,532 | Large, polling issue |
| `lib/supabase.ts` | 45 | Clean, config issue only |
| `hooks/useAssignmentStatus.ts` | 197 | Well-structured, channel name issue |
| `components/ErrorBoundary.tsx` | 76 | Minimal but functional |
| `lib/offline-gallery-cache.ts` | 187 | Complete but unused |

---

*Report generated by codebase analysis. All findings are based on the source code as of July 17, 2026.*
