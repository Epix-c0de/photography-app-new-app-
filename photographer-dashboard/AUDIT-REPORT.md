# Photographer Dashboard — Comprehensive Audit Report

**Date:** July 17, 2026  
**Scope:** Full codebase audit of `photographer-dashboard/` — all source files, API routes, lib utilities, contexts, and config  
**Stack:** Next.js 14.2.3 · React 18.3.1 · Supabase · Tailwind CSS 3.4.3 · TypeScript  

---

## Table of Contents
1. [Dashboard Role & Objective](#1-dashboard-role--objective)
2. [Critical Errors & Bugs](#2-critical-errors--bugs)
3. [Performance & Security Gaps](#3-performance--security-gaps)
4. [Architecture & Code Quality Issues](#4-architecture--code-quality-issues)
5. [UI/UX Gaps](#5-uiux-gaps)
6. [Missing Features & Improvements](#6-missing-features--improvements)
7. [Proposed File Structure](#7-proposed-file-structure)
8. [New Files to Create](#8-new-files-to-create)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. Dashboard Role & Objective

The **Photographer Dashboard** is a web-based admin panel for individual photography studio owners (called "admins") who subscribe to the Epix Visuals platform. Its core purpose is to manage the entire photography business lifecycle:

### Core Responsibilities
| Area | Description |
|------|-------------|
| **Client Management** | Add, edit, message clients; track engagement |
| **Gallery Management** | Create galleries, upload photos, set access codes, manage paid/unpaid status, lock/unlock |
| **Booking & Calendar** | View bookings, manage calendar availability, reschedule sessions |
| **Payments** | Configure M-Pesa (Paybill/Till), view transaction history, track revenue |
| **Communication** | In-app messaging with clients, bulk notifications, SMS credits |
| **Content Marketing** | BTS posts, announcements, portfolio showcase |
| **Social Integration** | Connect Instagram/Facebook for auto-sharing |
| **Reviews** | Collect and display client reviews, send review requests |
| **Referrals** | Earn credits by referring other photographers |
| **Branding** | Custom watermarks, receipt customization, USSD configuration |
| **Support** | Direct chat with Epix Visuals super admin support team |

### User Personas
- **Primary:** Kenyan photography studio owners (solo operators or small teams)
- **Secondary:** Super admin support staff (responding to support chats)
- **Tertiary:** End clients (accessing galleries via access codes/USSD — mobile app, not this dashboard)

### Business Model
- Subscription: KES 500/month (or lifetime)
- SMS credits: Purchased in bundles (KES 100–1000)
- Referral system: Earn SMS credits for referring new photographers
- USSD access: Clients dial shortcodes to retrieve gallery links

---

## 2. Critical Errors & Bugs

### BUG-001: `verify-login-token` Route — Broken Auth Flow
**File:** `src/app/api/verify-login-token/route.ts:44-48`
**Severity:** CRITICAL
```typescript
const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: tokenData.user_id, // BUG: user_id is UUID, not email
});
```
The code passes `user_id` (a UUID) to `generateLink()` which expects an email address. This will always fail. The route then returns `user_id` to the client but never actually creates a session. The client-side login flow has no way to establish a Supabase session from this.

**Impact:** The entire web login token flow is broken. Users who try to log in via the token flow will never get a session.

**Fix:** Query `user_profiles` to get the email from `user_id`, then use `signInWithOtp` or create a session directly.

---

### BUG-002: `web-login-request` — Token Leaked in Response
**File:** `src/app/api/web-login-request/route.ts:69`
**Severity:** CRITICAL (Security)
```typescript
return NextResponse.json({ token, message: 'OTP sent...' });
```
The raw token is returned in the JSON response to the client. This token is used to verify the login and should never be exposed to the browser.

**Impact:** Anyone who can call this API endpoint (which has no rate limiting) can obtain login tokens for any admin email.

**Fix:** The token should only be stored in the database and used internally (e.g., in a notification). The client should never receive it.

---

### BUG-003: `web-login-verify` — GET Endpoint Exposes Token Status
**File:** `src/app/api/web-login-verify/route.ts:4-27`
**Severity:** HIGH (Security)
The `GET` handler accepts a token as a query parameter and returns the status of the login request (pending, expired, rejected, otp_verified). This allows token enumeration and brute-force probing.

**Impact:** An attacker can probe login request statuses without authentication.

**Fix:** Add authentication check or remove the GET endpoint entirely.

---

### BUG-004: `inbox/page.tsx` — `alert()` on Send Failure
**File:** `src/app/dashboard/inbox/page.tsx:424`
**Severity:** MEDIUM
```typescript
alert('Failed to send message: ' + (e?.message || 'Unknown error'));
```
Uses browser `alert()` which blocks the UI and is inconsistent with the rest of the app's toast-based feedback.

**Impact:** Poor UX; blocks the event loop.

**Fix:** Replace with the existing toast pattern.

---

### BUG-005: `notifications/page.tsx` — Uses `user_id` Instead of `client.id`
**File:** `src/app/dashboard/notifications/page.tsx:41,55,150`
**Severity:** HIGH
```typescript
setSelectedClients(clients.map((c) => c.user_id).filter(Boolean));
// ...
const notifications = selectedClients.map((userId) => ({
  user_id: userId, // This is the CLIENT's user_id, not the admin's
  // ...
}));
```
The notification system inserts notifications with `user_id` set to the client's `user_id`. However, the `notifications` table is queried by `user_id` in the notifications page itself, which queries with the admin's `user_id`. This means:
1. Admins can never see notifications they sent (they're stored under client IDs)
2. The "Recent Notifications" section always shows admin's own received notifications, not sent ones

**Impact:** The sent notification history is meaningless. The "Select Clients" also breaks when clients don't have a `user_id` (some clients are only created with phone numbers).

---

### BUG-006: `receipt/page.tsx` — Creates Its Own Supabase Client
**File:** `src/app/dashboard/settings/receipt/page.tsx:4-9`
**Severity:** MEDIUM
```typescript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```
Creates a new Supabase client instead of importing from `@/lib/supabase`. This bypasses any middleware, custom headers, or session management that the shared client provides.

**Impact:** Inconsistent auth behavior; potential session mismatches.

---

### BUG-007: `receipt/page.tsx` — Uses `alert()` for Save Feedback
**File:** `src/app/dashboard/settings/receipt/page.tsx:110-112`
**Severity:** LOW
```typescript
alert('Receipt settings saved successfully!');
// ...
alert('Failed to save settings');
```
Uses native `alert()` instead of toast notifications.

**Impact:** Inconsistent UX; blocks UI.

---

### BUG-008: `social/page.tsx` — Missing OAuth Callback Routes
**File:** `src/app/dashboard/social/page.tsx:69,86`
**Severity:** HIGH
```typescript
const redirectUri = `${window.location.origin}/auth/instagram/callback`;
// ...
const redirectUri = `${window.location.origin}/auth/facebook/callback`;
```
These redirect to `/auth/instagram/callback` and `/auth/facebook/callback` which don't exist. Users who attempt to connect social accounts will get a 404 after OAuth.

**Impact:** Social media integration is completely non-functional.

---

### BUG-009: `bookings/page.tsx` — Booking Notifications Sent to Wrong User
**File:** `src/app/dashboard/bookings/page.tsx:80-87`
**Severity:** MEDIUM
```typescript
await supabase.from('notifications').insert({
  user_id: (await supabase.auth.getUser()).data.user?.id, // Sends to ADMIN, not client
  type: 'booking_status_update',
  // ...
});
```
The notification is sent to the admin (themselves), not to the client. The `clientId` parameter is available but unused for the `user_id` field.

**Impact:** Clients never receive booking status notifications.

---

### BUG-010: `compression.ts` — Unused Supabase Import
**File:** `src/lib/compression.ts:1`
**Severity:** LOW
```typescript
import { supabase } from './supabase';
```
The `supabase` client is imported but only used in `compressImage` to call the Edge Function. However, if the Edge Function doesn't exist, the fallback works fine. The import is technically unnecessary if the Edge Function is removed.

**Impact:** Dead code; no functional impact.

---

## 3. Performance & Security Gaps

### SEC-001: No Server-Side Auth Middleware
**Severity:** CRITICAL
There is no `middleware.ts` file in the photographer dashboard. All authentication is done client-side in each page component. This means:
- Unauthenticated users can access any route and the JS bundle loads before auth is checked
- There's a flash of unauthenticated content before redirect
- API routes have no auth verification (except `verify-login-token` which has its own issues)

**Fix:** Add a Next.js middleware that checks the Supabase session cookie and redirects unauthenticated users.

---

### SEC-002: `SUPABASE_SERVICE_ROLE_KEY` Exposed in `.env.local`
**Severity:** CRITICAL
The `.env.local` file contains the service role key which bypasses all RLS. If this file is committed to git (check git history), the database is fully exposed.

**Fix:** Ensure `.env.local` is in `.gitrotate`. If already committed, rotate the key immediately.

---

### SEC-003: No Rate Limiting on API Routes
**Severity:** HIGH
None of the API routes (`verify-login-token`, `web-login-request`, `web-login-verify`) have rate limiting. An attacker could:
- Brute-force tokens
- Enumerate admin emails via the OTP flow
- Exhaust SMS credits by triggering many OTP sends

**Fix:** Implement rate limiting via Supabase Edge Functions or a middleware.

---

### SEC-004: `web-login-request` — No CSRF Protection
**Severity:** HIGH
The web login request endpoint accepts arbitrary `email` parameters with no CAPTCHA or CSRF token. This enables:
- Email enumeration (timing differences in responses)
- OTP spam attacks
- SMS credit exhaustion

**Fix:** Add CAPTCHA, rate limiting per IP, and use consistent response times.

---

### SEC-005: API Routes Use Service Role Client
**Severity:** MEDIUM
All three API routes (`verify-login-token`, `web-login-request`, `web-login-verify`) create a service role client via `createServiceClient()`. This bypasses Row Level Security entirely.

**Impact:** If there's any SQL injection or logic error, RLS won't protect the data.

**Fix:** Use the authenticated user's client where possible, or validate ownership explicitly.

---

### PERF-001: Gallery Page Loads All Photos for Count
**File:** `src/app/dashboard/galleries/page.tsx:55-60`
**Severity:** MEDIUM
```typescript
const { data: photos } = await supabase
  .from('gallery_photos')
  .select('gallery_id')
  .in('gallery_id', galleryIds);
```
Fetches ALL photo rows just to count them. With 100 galleries × 50 photos = 5000 rows transferred.

**Fix:** Use a Supabase RPC or aggregate query: `SELECT gallery_id, COUNT(*) FROM gallery_photos GROUP BY gallery_id`.

---

### PERF-002: `inbox/page.tsx` — N+1 Client Lookups
**File:** `src/app/dashboard/inbox/page.tsx:39-50`
**Severity:** MEDIUM
Loads all messages for all clients, then builds thread map client-side. For photographers with many clients and messages, this loads a huge dataset.

**Fix:** Use a database view or RPC to get latest message per client directly.

---

### PERF-003: No Pagination Anywhere
**Severity:** MEDIUM
No page in the dashboard implements pagination. All queries fetch up to hundreds/thousands of rows:
- Galleries: all galleries
- Bookings: all bookings
- Transactions: limit 200 but no UI pagination
- Clients: all clients
- Messages: all messages per thread

**Fix:** Add cursor-based or offset pagination for all list views.

---

### PERF-004: Redundant `supabase.auth.getUser()` Calls
**Severity:** LOW
Almost every function calls `supabase.auth.getUser()` independently. This results in repeated network requests to Supabase auth. Should be called once at component mount and shared via context or state.

---

## 4. Architecture & Code Quality Issues

### ARCH-001: Monolithic Page Components
**Severity:** HIGH
Several pages are extremely long and handle multiple concerns:
- `clients/page.tsx`: **910 lines** — CRUD, messaging, booking creation, file upload, search, filtering
- `upload/page.tsx`: **605 lines** — multi-step wizard, compression, client creation, pricing, access codes
- `galleries/page.tsx`: **294 lines** — list, filter, actions, modals all inline
- `bookings/page.tsx`: **335 lines** — list, calendar, reschedule, availability

**Impact:** Extremely difficult to maintain, test, or reuse individual features.

---

### ARCH-002: Massive Code Duplication
**Severity:** HIGH

#### Duplicated Toast System
Every page implements its own toast state:
```typescript
const [toast, setToast] = useState('');
const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
```
**Files affected:** `galleries`, `bookings`, `inbox`, `reviews`, `referrals`, `social`, `notifications`, `support`, `settings/ussid`, `settings/watermark`

#### Duplicated Style Objects
`S.card`, `S.input`, `S.btn()`, `S.badge()` objects are copy-pasted across:
- `galleries/page.tsx`
- `bookings/page.tsx`
- `reviews/page.tsx`
- `referrals/page.tsx`
- `social/page.tsx`

#### Duplicated Inline Styles
Pages like `bookings`, `reviews`, `referrals`, `social`, `support`, `settings/watermark` use hundreds of lines of inline `style={{...}}` objects instead of Tailwind classes. This is inconsistent with pages like `portfolio`, `bts`, `notifications`, `transactions` which use Tailwind.

---

### ARCH-003: Inconsistent Styling Approach
**Severity:** MEDIUM
Two styling approaches are mixed:
1. **Tailwind classes** (portfolio, bts, notifications, transactions, inbox, support)
2. **Inline style objects** (galleries, bookings, reviews, referrals, social, settings/watermark, settings/ussid, settings/receipt)

There is no `tailwind.config.ts` customization for the gold brand colors, so hardcoded `#D4AF37` appears everywhere.

---

### ARCH-004: No Error Boundaries
**Severity:** MEDIUM
No page has React Error Boundaries. If any component throws during render (e.g., malformed data from Supabase), the entire app crashes with a white screen.

---

### ARCH-005: No Loading Skeleton Patterns
**Severity:** LOW
All loading states are simple spinners or "Loading..." text. No page uses skeleton UI or progressive loading patterns.

---

### ARCH-006: No Type Safety for Supabase Queries
**Severity:** MEDIUM
All Supabase queries use `as any` type assertions:
```typescript
const { data } = await supabase.from('bookings').select(`...`) as any;
```
This defeats TypeScript's purpose and allows silent data bugs.

---

### ARCH-007: `receipt/page.tsx` Creates Duplicate Supabase Client
**Severity:** MEDIUM
As noted in BUG-006, this page creates its own Supabase client instead of using the shared one.

---

## 5. UI/UX Gaps

### UX-001: No Responsive Design for Mobile
**Severity:** HIGH
The dashboard has no mobile-first layout. The sidebar is always visible on desktop but there's no hamburger menu or bottom navigation for mobile. Pages like `galleries` (grid of 300px cards) and `reviews` (max-width: 1000px) will overflow or require horizontal scrolling on phones.

---

### UX-002: No Breadcrumb Navigation
**Severity:** MEDIUM
Sub-pages under `settings/` (receipt, watermark, USSD) have no back button or breadcrumb to return to the main settings page. Users must use the sidebar.

---

### UX-003: No Keyboard Navigation
**Severity:** MEDIUM
Most interactive elements (filter buttons, action buttons, gallery cards) don't have `tabIndex` or keyboard handlers. The dashboard is not keyboard-accessible.

---

### UX-004: No Empty State Illustrations
**Severity:** LOW
Some pages have empty states (e.g., galleries: "No galleries found"), but they're plain text. No illustrations or onboarding guidance.

---

### UX-005: Inconsistent Modal Patterns
**Severity:** MEDIUM
- `galleries/page.tsx`: Custom modal with inline styles
- `portfolio/page.tsx`: Tailwind-styled modal
- `inbox/page.tsx`: Tailwind-styled modal
- `bookings/page.tsx`: No modal (inline expansion)
- `settings/ussid/page.tsx`: No modal for provider selection

No shared Modal component exists.

---

### UX-006: No Confirmation for destructive actions
**Severity:** MEDIUM
- `bookings/page.tsx`: Status changes have no confirmation
- `galleries/page.tsx`: Lock/unlock has no confirmation (only delete does)
- `portfolio/page.tsx`: Uses `confirm()` for delete
- `bts/page.tsx`: Uses `confirm()` for delete

Mix of `confirm()`, custom modals, and no confirmation at all.

---

### UX-007: USSD Code Display Hardcoded
**File:** `galleries/page.tsx:204`
**Severity:** LOW
```tsx
*123*{g.access_code?.replace('-', '')}#
```
The USSD shortcode `*123` is hardcoded instead of reading from the photographer's USSD settings.

---

## 6. Missing Features & Improvements

### Missing Feature 1: Batch Operations
Photographers need to select multiple galleries and perform bulk actions (delete, lock/unlock, mark paid, export).

### Missing Feature 2: Gallery Analytics
No view counts, download counts, or client engagement metrics for galleries.

### Missing Feature 3: Client Portal Link
No way to generate and send a "client portal" link that shows all galleries for a specific client.

### Missing Feature 4: Export Data
No CSV/PDF export for transactions, client lists, or gallery data.

### Missing Feature 5: Search Across All Entities
Search is per-page. No global search for clients, galleries, bookings, or transactions.

### Missing Feature 6: Multi-Select Client Messaging
Inbox only allows 1-on-1 messaging. No group messaging or broadcast capability (notifications page does this separately).

### Missing Feature 7: Image Editing
No cropping, rotation, or basic editing tools before upload.

### Missing Feature 8: Versioned Gallery Links
No way to create expiring links or time-limited access for gallery previews.

### Missing Feature 9: Revenue Dashboard
No charts or graphs for revenue over time, booking trends, or client lifetime value.

### Missing Feature 10: Role-Based Access Control
The dashboard assumes single-user (admin) access. No team member roles (assistant, second shooter).

---

## 7. Proposed File Structure

```
photographer-dashboard/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── verify-login-token/route.ts
│   │   │   ├── web-login-request/route.ts
│   │   │   └── web-login-verify/route.ts
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── bookings/page.tsx
│   │   │   ├── bts/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── clients/page.tsx
│   │   │   ├── galleries/page.tsx
│   │   │   ├── inbox/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── portfolio/page.tsx
│   │   │   ├── referrals/page.tsx
│   │   │   ├── reviews/page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── receipt/page.tsx
│   │   │   │   ├── ussid/page.tsx
│   │   │   │   └── watermark/page.tsx
│   │   │   ├── social/page.tsx
│   │   │   ├── support/page.tsx
│   │   │   ├── transactions/page.tsx
│   │   │   └── upload/page.tsx
│   │   └── login/page.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Toggle.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── DashboardShell.tsx
│   │   ├── gallery/
│   │   │   ├── GalleryCard.tsx
│   │   │   ├── GalleryGrid.tsx
│   │   │   ├── GalleryFilters.tsx
│   │   │   └── GalleryActions.tsx
│   │   ├── client/
│   │   │   ├── ClientCard.tsx
│   │   │   ├── ClientForm.tsx
│   │   │   └── ClientList.tsx
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ThreadList.tsx
│   │   │   └── QuickReplies.tsx
│   │   └── charts/
│   │       ├── RevenueChart.tsx
│   │       └── BookingChart.tsx
│   ├── contexts/
│   │   └── BrandingContext.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useToast.ts
│   │   ├── useSupabaseQuery.ts
│   │   └── useRealtimeSubscription.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── compression.ts
│   │   ├── mpesa.ts
│   │   ├── messaging.ts
│   │   ├── shareable-links.ts
│   │   └── kenyan-holidays.ts
│   ├── types/
│   │   ├── database.ts
│   │   ├── gallery.ts
│   │   ├── client.ts
│   │   ├── booking.ts
│   │   └── transaction.ts
│   └── styles/
│       └── globals.css
├── middleware.ts                    ← NEW: Server-side auth guard
├── tailwind.config.ts              ← EXTEND: Brand colors
├── next.config.js
├── tsconfig.json
└── package.json
```

---

## 8. New Files to Create

### 8.1 `middleware.ts` — Server-Side Auth Guard
```typescript
// Protects all /dashboard/* routes
// Checks Supabase session cookie
// Redirects to /login if unauthenticated
// Adds security headers
```

### 8.2 `src/components/ui/` — Shared Component Library
| Component | Purpose |
|-----------|---------|
| `Button.tsx` | Consistent button with variants (primary, secondary, danger, ghost) |
| `Card.tsx` | Replaces all `S.card` inline objects |
| `Input.tsx` | Replaces all `S.input` inline objects |
| `Modal.tsx` | Replaces all ad-hoc modals across pages |
| `Toast.tsx` | Replaces all per-page toast state |
| `Badge.tsx` | Replaces `S.badge()` and `S.lockBadge()` |
| `Toggle.tsx` | Replaces all custom toggle implementations |
| `Select.tsx` | Consistent select dropdown |
| `Spinner.tsx` | Consistent loading spinner |
| `EmptyState.tsx` | Illustration-based empty states |
| `Skeleton.tsx` | Loading skeleton UI |

### 8.3 `src/hooks/` — Custom Hooks
| Hook | Purpose |
|------|---------|
| `useAuth.ts` | Single auth check at layout level, provides user/profile |
| `useToast.ts` | Global toast state via context |
| `useSupabaseQuery.ts` | Generic query hook with loading/error/data states |
| `useRealtimeSubscription.ts` | Reusable Supabase Realtime subscription |

### 8.4 `src/types/database.ts` — Supabase Type Definitions
```typescript
// Generated or manual types for all Supabase tables
// Eliminates all `as any` type assertions
```

### 8.5 `src/components/layout/Sidebar.tsx` — Extracted Sidebar
Currently the sidebar is inline in `dashboard/layout.tsx`. Extract it for:
- Mobile responsiveness (collapsible)
- Active route highlighting
- Badge counts (unread messages, pending bookings)

### 8.6 `src/components/chat/ChatWindow.tsx` — Shared Chat Component
Currently duplicated between `inbox/page.tsx` and `support/page.tsx`. Extract into a shared component with props for:
- Thread type (client vs support)
- Message sender role
- Presence indicators
- Quick replies

### 8.7 `src/components/gallery/GalleryCard.tsx` — Extracted Gallery Card
The gallery card in `galleries/page.tsx` (lines 130-210) should be a standalone component with props for gallery data and action callbacks.

---

## 9. Implementation Roadmap

### Phase 1: Critical Fixes (1-2 days)
| Task | Priority | Files |
|------|----------|-------|
| Fix `verify-login-token` auth flow | P0 | `api/verify-login-token/route.ts` |
| Fix `web-login-request` token leak | P0 | `api/web-login-request/route.ts` |
| Add `middleware.ts` for server-side auth | P0 | NEW: `middleware.ts` |
| Fix notification system (`user_id` vs `client.id`) | P0 | `notifications/page.tsx` |
| Fix booking notifications (send to client, not admin) | P0 | `bookings/page.tsx` |
| Create OAuth callback routes for social | P0 | NEW: `auth/instagram/callback`, `auth/facebook/callback` |
| Rotate `SUPABASE_SERVICE_ROLE_KEY` if exposed | P0 | `.env.local`, Supabase dashboard |

### Phase 2: Shared Components (3-5 days)
| Task | Priority | Files |
|------|----------|-------|
| Create Toast component + context | P1 | NEW: `components/ui/Toast.tsx`, `hooks/useToast.ts` |
| Create Button, Card, Input, Modal components | P1 | NEW: `components/ui/*.tsx` |
| Extract Sidebar component | P1 | `layout.tsx` → `components/layout/Sidebar.tsx` |
| Extract ChatWindow component | P1 | NEW: `components/chat/ChatWindow.tsx` |
| Create shared types file | P1 | NEW: `types/database.ts` |
| Add Tailwind brand colors to config | P1 | `tailwind.config.ts` |

### Phase 3: Refactoring (5-8 days)
| Task | Priority | Files |
|------|----------|-------|
| Refactor `clients/page.tsx` (910 lines → split) | P2 | `clients/page.tsx` + new components |
| Refactor `upload/page.tsx` (605 lines → split) | P2 | `upload/page.tsx` + new components |
| Replace all inline styles with Tailwind | P2 | All `style={{}}` files |
| Replace all `as any` with proper types | P2 | All Supabase query files |
| Replace `alert()` and `confirm()` | P2 | `receipt/page.tsx`, `portfolio/page.tsx`, `bts/page.tsx`, `inbox/page.tsx` |
| Add Error Boundaries | P2 | NEW: `components/ErrorBoundary.tsx` |

### Phase 4: New Features (8-12 days)
| Task | Priority | Files |
|------|----------|-------|
| Add pagination to all list views | P3 | All page files |
| Add skeleton loading states | P3 | All page files |
| Add revenue dashboard with charts | P3 | NEW: `dashboard/analytics/page.tsx` |
| Add batch operations for galleries | P3 | `galleries/page.tsx` |
| Add global search | P3 | NEW: `components/layout/SearchBar.tsx` |
| Add mobile responsive layout | P3 | `layout.tsx`, `Sidebar.tsx` |
| Fix hardcoded USSD shortcode | P3 | `galleries/page.tsx` |
| Add export (CSV/PDF) functionality | P3 | Various pages |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total source files | 33 |
| Total lines of code | ~9,670 |
| Critical bugs | 3 |
| High severity issues | 8 |
| Medium severity issues | 14 |
| Low severity issues | 6 |
| Security vulnerabilities | 5 |
| Missing features identified | 10 |
| New files recommended | 20+ |
| Estimated fix effort | 3-4 weeks |

---

*Report generated from full codebase review of all 33 source files in photographer-dashboard/*
