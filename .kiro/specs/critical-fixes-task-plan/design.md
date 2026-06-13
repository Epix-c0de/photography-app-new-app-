# Design Document

## Overview

This document describes the technical implementation plan for all 14 bug fixes identified in the admin app and backend audit. Each fix is scoped to a specific file and function. No new dependencies are introduced. All changes are surgical — touching only the broken code paths.

---

## Architecture

No architectural changes are required. All fixes operate within the existing service layer (`AdminService`, `ClientService`), React Native screen components, and the tab layout. The fixes follow the existing patterns already established in the codebase.

---

## Fix Designs

### Fix 1: Dashboard viewMode ReferenceError

**File:** `split-apps/admin-app/app/(admin)/dashboard/index.tsx`

**Root Cause:** The `viewMode` state variable and its setter were removed from the component, but the JSX still contains conditional blocks that reference `viewMode`. This causes a `ReferenceError: viewMode is not defined` at runtime.

**Solution:**
1. Remove the `tabContainer` / tab switcher JSX block (the two-tab UI that was used to toggle between `'overview'` and `'forecast'`).
2. Remove the `viewMode === 'overview'` ternary wrapper — render the overview content unconditionally.
3. Remove the `viewMode === 'forecast'` branch entirely, including the `<BusinessForecast />` render and the `forecastSummary` JSX block.
4. Remove the `BusinessForecast` function component definition from the file (it is dead code).
5. Remove any imports used exclusively by `BusinessForecast` that are no longer needed (`Database`, `Briefcase`, `TrendingUp` if unused elsewhere — verify before removing).

**Before (broken):**
```tsx
{viewMode === 'overview' ? (
  <LinearGradient ... style={styles.revenueSummary}>
    ...
  </LinearGradient>
) : (
  <LinearGradient ... style={styles.forecastSummary}>
    ...
  </LinearGradient>
)}

{viewMode === 'overview' ? (
  <>
    <View style={styles.quickActionsSection}>...</View>
    ...
  </>
)}
```

**After (fixed):**
```tsx
<LinearGradient ... style={styles.revenueSummary}>
  ...
</LinearGradient>

<View style={styles.quickActionsSection}>...</View>
...
```

---

### Fix 2: PaymentModal Interval Memory Leak and Stale Closure

**File:** `split-apps/user-app/components/PaymentModal.tsx`

**Root Cause:**
- `startPolling()` and `startManualPolling()` call `setInterval()` but never store the return value, so the interval cannot be cleared.
- `paymentState` is read inside the interval callback as a stale closure — it always sees the value from when the interval was created, not the current value.

**Solution:**

1. Add two refs at the top of the component:
```tsx
const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const paymentStateRef = useRef<PaymentState>('idle');
```

2. Keep `paymentStateRef` in sync with `paymentState` by updating it whenever `setPaymentState` is called. Create a wrapper:
```tsx
const updatePaymentState = useCallback((state: PaymentState) => {
  paymentStateRef.current = state;
  setPaymentState(state);
}, []);
```
Replace all `setPaymentState(...)` calls with `updatePaymentState(...)`.

3. In `startPolling()`, store the interval and use the ref:
```tsx
const startPolling = (checkoutRequestId: string, galleryId: string) => {
  if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
  
  pollingIntervalRef.current = setInterval(async () => {
    attempts++;
    if (attempts > 10 && paymentStateRef.current === 'waiting') {
      updatePaymentState('verifying');
    }
    // ... rest of polling logic
    if (data?.status === 'success') {
      clearInterval(pollingIntervalRef.current!);
      pollingIntervalRef.current = null;
      // ...
    }
  }, pollInterval);
};
```

4. In `startManualPolling()`, apply the same pattern.

5. Add a cleanup `useEffect`:
```tsx
useEffect(() => {
  return () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
}, []);
```

6. In the `useEffect` that watches `visible`, clear the interval when `visible` becomes `false`:
```tsx
useEffect(() => {
  if (!visible) {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }
  // ... rest of effect
}, [visible, clientPhone]);
```

---

### Fix 3: STK Push Edge Function Name Mismatch

**File:** `split-apps/user-app/components/PaymentModal.tsx`

**Root Cause:** `PaymentModal.tsx` calls `supabase.functions.invoke('mpesa-stk-push', ...)` in two places, while `ClientService.payment.initiateStkPush()` calls `stk_push`. One of these will 404 in production.

**Decision:** Standardize on `stk_push` (the name used in `ClientService`) since that is the canonical service layer. Update `PaymentModal.tsx` to match.

**Changes in `PaymentModal.tsx`:**
- Replace both occurrences of `supabase.functions.invoke('mpesa-stk-push', ...)` with `supabase.functions.invoke('stk_push', ...)`.
- There are two call sites: one in the `auto_verification` branch and one in the advanced M-Pesa branch at the bottom of `handlePay()`.

---

### Fix 4: Inbox Unread Count Not Filtered by Admin

**File:** `split-apps/admin-app/app/(admin)/_layout.tsx`

**Root Cause:** The `fetchUnreadCount` query filters by `sender_role = 'client'` and `is_read = false` but does not filter by `owner_admin_id`. In a multi-admin setup, all admins see the combined unread count.

**Solution:** Add `.eq('owner_admin_id', user.id)` to the unread count query.

**Before:**
```tsx
const { count } = await supabase
  .from('messages')
  .select('*', { count: 'exact', head: true })
  .eq('sender_role', 'client')
  .eq('is_read', false);
```

**After:**
```tsx
const { count } = await supabase
  .from('messages')
  .select('*', { count: 'exact', head: true })
  .eq('sender_role', 'client')
  .eq('is_read', false)
  .eq('owner_admin_id', user.id);
```

Also update the real-time subscription filter to only react to messages for the current admin:
```tsx
const messageSubscription = supabase
  .channel('admin_messages_unread')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `sender_role=eq.client,owner_admin_id=eq.${user.id}`
  }, () => setUnreadCount(prev => prev + 1))
  .subscribe();
```

---

### Fix 5: Bookings Amount Always Zero

**File:** `split-apps/admin-app/services/admin.ts` — `bookings.list()`

**Root Cause:** The `bookings.list()` query does not join the `packages` table, so `packageName` and `amount` are always unknown/zero in the UI transform.

**Solution:** Add `packages (name, price, shoot_type)` to the select query.

**Before:**
```typescript
const { data, error } = await supabase
  .from('bookings')
  .select(`
    *,
    user_profiles (name, phone, avatar_url)
  `)
  ...
```

**After:**
```typescript
const { data, error } = await supabase
  .from('bookings')
  .select(`
    *,
    user_profiles (name, phone, avatar_url),
    packages (name, price, shoot_type)
  `)
  ...
```

**Update the UI transform in `admin-bookings/index.tsx`:**
```typescript
packageName: booking.packages?.name || 'No Package',
amount: booking.packages?.price || 0,
type: booking.packages?.shoot_type || 'Session',
```

---

### Fix 6: Clients total_galleries Always Zero

**File:** `split-apps/admin-app/services/admin.ts` — `clients.list()`

**Root Cause:** The `clients.list()` method sets `total_galleries: 0` unconditionally. No gallery count query is performed.

**Solution:** After fetching profiles and CRM data, perform a single aggregation query to count galleries per client, then merge the counts.

```typescript
// After fetching clients array:
const clientIds = (clients || []).map((c: any) => c.id).filter(Boolean);

let galleryCounts = new Map<string, number>();
if (clientIds.length > 0) {
  const { data: galleriesData } = await supabase
    .from('galleries')
    .select('client_id')
    .in('client_id', clientIds);
  
  (galleriesData || []).forEach((g: any) => {
    galleryCounts.set(g.client_id, (galleryCounts.get(g.client_id) || 0) + 1);
  });
}

// In the transform:
total_galleries: galleryCounts.get(crmData?.id) || 0,
```

---

### Fix 7: Link Manual Payments Screen in Admin Navigation

**File:** `split-apps/admin-app/app/(admin)/settings/index.tsx`

**Root Cause:** `settings/manual-payments.tsx` exists and is fully functional but is not linked anywhere in the Settings screen navigation.

**Solution:**
1. Add a `SettingsRow` entry in the Settings screen under a "Payments" section (or the existing payments section) that navigates to `settings/manual-payments`.
2. Fetch the count of pending manual payments on mount and display it as a badge on the row.

```tsx
// In the Settings component, add state:
const [pendingManualPayments, setPendingManualPayments] = useState(0);

// In useEffect on mount:
const { count } = await supabase
  .from('manual_payments')
  .select('*', { count: 'exact', head: true })
  .eq('admin_id', user.id)
  .eq('status', 'pending');
setPendingManualPayments(count || 0);

// In the JSX:
<SettingsRow
  icon={<Smartphone size={20} color={Colors.gold} />}
  label="Manual Payments"
  description={pendingManualPayments > 0 ? `${pendingManualPayments} pending` : 'Review client payment submissions'}
  onPress={() => router.push('/settings/manual-payments')}
  showArrow
/>
```

---

### Fix 8: Gallery List Missing Owner Filter

**File:** `split-apps/admin-app/services/admin.ts` — `gallery.list()`

**Root Cause:** The `.eq('owner_admin_id', user.id)` filter was explicitly commented out with the note "Removed filter to show all galleries". This is a security issue in multi-admin setups.

**Solution:** Restore the `owner_admin_id` filter.

**Before:**
```typescript
const { data: galleries, error } = await supabase
  .from('galleries')
  .select(`
    *,
    gallery_photos (id, photo_url)
  `)
  // .eq('owner_admin_id', user.id) // Removed filter to show all galleries
  .order('created_at', { ascending: false });
```

**After:**
```typescript
const { data: galleries, error } = await supabase
  .from('galleries')
  .select(`
    *,
    gallery_photos (id, photo_url)
  `)
  .eq('owner_admin_id', user.id)
  .order('created_at', { ascending: false });
```

---

### Fix 9: Announcement Comments Failing for New Users

**File:** `split-apps/user-app/services/client.ts` — `announcements.addComment()`

**Root Cause:** The method looks up the user's `clients` row and throws `'Client record not found'` if none exists. New users who have not yet been linked to a `clients` record cannot comment.

**Solution:** If no `clients` row is found, attempt to create one using the user's profile data before inserting the comment. Use the `ensureLinkedRecordsForCurrentUser` helper that already exists in `ClientService.clients`.

```typescript
addComment: async (announcementId: string, content: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let client = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
    .then(r => r.data);

  if (!client?.id) {
    // Attempt to create the client record
    await ClientService.clients.ensureLinkedRecordsForCurrentUser();
    
    const { data: retried } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (!retried?.id) {
      throw new Error('Could not create client profile. Please contact support.');
    }
    client = retried;
  }

  const { data, error } = await supabase
    .from('announcement_comments')
    .insert({
      announcement_id: announcementId,
      client_id: client.id,
      comment: content
    })
    .select()
    .single();

  if (error) throw error;
  return data;
},
```

---

### Fix 10: Remove Duplicate Link Inputs in Settings

**File:** `split-apps/admin-app/app/(admin)/settings/index.tsx`

**Root Cause:** The share link and access code link `TextInput` fields appear in both the Watermark section (General tab) and the Links tab, causing confusion.

**Solution:** Remove the share/access code link inputs from the Watermark section. Keep them only in the Links tab. Identify the duplicate inputs by their state variables (likely `shareLink` and `accessCodeLink` or similar) and remove only the JSX in the Watermark/General section.

---

### Fix 11: Replace Fake Activity Log with Real Data

**File:** `split-apps/admin-app/app/(admin)/settings/index.tsx`

**Root Cause:** The activity log section renders a hardcoded `activityLog` array with static strings instead of querying the `admin_audit_log` table.

**Solution:**
1. Add state: `const [activityLog, setActivityLog] = useState<any[]>([])`.
2. On mount (in the existing `useEffect`), fetch real data:
```typescript
const { data: logs } = await supabase
  .from('admin_audit_log')
  .select('*')
  .eq('admin_id', user.id)
  .order('created_at', { ascending: false })
  .limit(20);
setActivityLog(logs || []);
```
3. Remove the hardcoded `activityLog` array constant.
4. Update the render to use the fetched data, showing an empty state if the array is empty.
5. If the `admin_audit_log` table does not exist, the query will return an error — catch it and show an empty state rather than crashing.

---

### Fix 12: Refresh Gallery Signed URLs on App Foreground

**File:** `split-apps/user-app/app/(tabs)/gallery/index.tsx` (or wherever the gallery list is rendered with signed URLs)

**Root Cause:** Signed URLs are generated once when the gallery loads and expire after 3600 seconds. If the app is backgrounded and returned to after an hour, all image URLs are expired.

**Solution:** Subscribe to `AppState` changes and re-fetch gallery data (which regenerates signed URLs) when the app transitions from `'background'` to `'active'`.

```typescript
import { AppState, AppStateStatus } from 'react-native';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      loadGalleries(); // existing data fetch function
    }
  });
  return () => subscription.remove();
}, []);
```

This is a lightweight fix — it reuses the existing data loading function and does not require a new API method.

---

### Fix 13: Batch Photo Thumbnail Signing

**File:** `split-apps/user-app/services/client.ts` — `gallery.getPhotos()`

**Root Cause:** The method calls `createSignedUrl()` individually for each photo in a `Promise.all(photos.map(...))`. For a 200-photo gallery this is 200 sequential-ish API calls.

**Solution:** Collect all paths that need signing, call `createSignedUrls()` once, then map the results back to photos.

```typescript
// Collect all paths needing signing
const pathsToSign = photos
  .filter(p => !p.photo_url.startsWith('http'))
  .map(p => p.photo_url);

// Batch sign
const { data: signedUrls } = await supabase.storage
  .from('client-photos')
  .createSignedUrls(pathsToSign, 3600);

const signedUrlMap = new Map(
  (signedUrls || []).map(s => [s.path, s.signedUrl])
);

// Map back to photos
const photosWithUrls = photos.map(p => {
  const url = p.photo_url.startsWith('http')
    ? p.photo_url
    : signedUrlMap.get(p.photo_url) || supabase.storage.from('client-photos').getPublicUrl(p.photo_url).data.publicUrl;
  return { ...p, url, thumbnailUrl: url, variant };
});
```

The thumbnail bucket fallback logic can be simplified or retained as a secondary batch call if thumbnails are stored separately.

---

### Fix 14: Improve M-Pesa Code Extraction Regex

**File:** `split-apps/user-app/components/PaymentModal.tsx` — `handleSubmitManualMessage()`

**Root Cause:** The current regex `(?:Confirmation Code|code|ref)[\s:\[]*([A-Z0-9]+)` is too narrow and may miss M-Pesa messages that don't use those exact keywords.

**Solution:** Replace with a pattern that matches the known M-Pesa code format directly — exactly 10 uppercase alphanumeric characters as a word boundary match.

**Before:**
```typescript
const codeMatch = mpesaMessage.match(/(?:Confirmation Code|code|ref)[\s:\[]*([A-Z0-9]+)/i);
const mpesaCode = codeMatch ? codeMatch[1] : null;
```

**After:**
```typescript
const codeMatch = mpesaMessage.match(/\b([A-Z0-9]{10})\b/);
const mpesaCode = codeMatch ? codeMatch[1] : null;
```

This matches any standalone 10-character alphanumeric string, which is the universal format for Safaricom M-Pesa transaction codes across all transaction types (Paybill, Till, Send Money, Withdraw).

---

## Components and Interfaces

No new components or interfaces are introduced. All fixes operate on existing components and service methods. The key interfaces involved are:

- `PaymentState` type in `PaymentModal.tsx` — unchanged, but now tracked via `paymentStateRef`
- `AdminBooking` type in `admin-bookings/index.tsx` — `amount`, `packageName`, and `type` fields will now be populated from the packages join
- `clients.list()` return type — `total_galleries` field will now return real counts

## Data Models

No schema changes are required for any of the 14 fixes. All fixes operate against existing tables:

- `messages` — existing `owner_admin_id` column used for unread count filter (Fix 4)
- `bookings` — existing `package_id` FK used for packages join (Fix 5)
- `galleries` — existing `client_id` used for gallery count aggregation (Fix 6)
- `manual_payments` — existing table, just needs a nav link (Fix 7)
- `galleries` — existing `owner_admin_id` filter restored (Fix 8)
- `clients` — existing table, auto-create logic added for new users (Fix 9)
- `admin_audit_log` — existing table queried instead of mock data (Fix 11)

## Error Handling

- Fix 9 (announcement comments): if `ensureLinkedRecordsForCurrentUser` fails, throw a user-friendly error rather than a raw Supabase error
- Fix 11 (activity log): wrap the `admin_audit_log` query in try/catch — if the table does not exist, show empty state rather than crashing
- Fix 13 (batch signing): if `createSignedUrls` returns a partial result, fall back to `getPublicUrl` for missing paths
- Fix 2 (interval leak): all interval cleanup is defensive — check `pollingIntervalRef.current !== null` before calling `clearInterval`

## Correctness Properties

### Property 1: Interval cleanup on modal close
After `visible` becomes `false`, `pollingIntervalRef.current` must equal `null`. No interval callback should fire after the modal is dismissed.

### Property 2: STK push function name consistency
For all STK push invocations across the codebase, the Edge Function name must be exactly `stk_push`. Zero occurrences of `mpesa-stk-push` should remain.

### Property 3: Unread count isolation
The unread badge count for admin A must equal the count of messages where `sender_role='client'` AND `is_read=false` AND `owner_admin_id=adminA.id`. Messages belonging to admin B must not be counted.

### Property 4: Gallery owner isolation
`AdminService.gallery.list()` must never return a gallery where `owner_admin_id !== currentUser.id` when `USE_MOCK` is false.

### Property 5: Booking amount accuracy
For any booking with an associated package, `booking.amount` must equal `packages.price` for that package. The value must never be `0` when a package exists.

## Testing Strategy

Each fix can be verified manually:

1. **Fix 1**: Open the Dashboard — it must render without a ReferenceError crash
2. **Fix 2**: Open PaymentModal, start a payment, close the modal before it completes — no callbacks should fire after close
3. **Fix 3**: Initiate an STK push — it must not 404
4. **Fix 4**: In a multi-admin setup, send a message to Admin B while logged in as Admin A — Admin A's badge must not increment
5. **Fix 5**: Open Bookings — package names and amounts must be non-zero for bookings that have packages
6. **Fix 6**: Open Clients — `total_galleries` must show the correct count for clients with galleries
7. **Fix 7**: Open Settings — a "Manual Payments" row must be visible and navigable
8. **Fix 8**: Log in as Admin A — galleries owned by Admin B must not appear in the list
9. **Fix 9**: Log in as a brand-new user with no `clients` row — adding a comment must succeed
10. **Fix 10**: Open Settings General tab — no link inputs should appear in the Watermark section
11. **Fix 11**: Open Settings Activity Log — real entries (or empty state) must appear, not hardcoded strings
12. **Fix 12**: Open gallery, background the app for 65+ minutes, return — images must still load
13. **Fix 13**: Open a gallery with 20+ photos — all thumbnails must load without individual signing errors
14. **Fix 14**: Paste a real M-Pesa confirmation SMS — the 10-char code must be extracted correctly

## Implementation Order

Fixes should be implemented in priority order:

| Order | Fix | File(s) | Risk |
|-------|-----|---------|------|
| 1 | Dashboard viewMode ReferenceError | `dashboard/index.tsx` | Low — removes dead code |
| 2 | PaymentModal interval leak | `PaymentModal.tsx` | Medium — touches payment flow |
| 3 | STK push name mismatch | `PaymentModal.tsx` | Low — string change |
| 4 | Inbox unread count filter | `_layout.tsx` | Low — adds one filter |
| 5 | Bookings amount zero | `admin.ts`, `admin-bookings/index.tsx` | Low — adds join |
| 6 | Clients total_galleries zero | `admin.ts` | Low — adds count query |
| 7 | Manual payments nav link | `settings/index.tsx` | Low — adds nav entry |
| 8 | Gallery list owner filter | `admin.ts` | Low — uncomments filter |
| 9 | Announcement comments new users | `client.ts` | Medium — adds auto-create logic |
| 10 | Duplicate link inputs | `settings/index.tsx` | Low — removes JSX |
| 11 | Fake activity log | `settings/index.tsx` | Low — replaces mock with query |
| 12 | Signed URL refresh on foreground | `gallery/index.tsx` | Low — adds AppState listener |
| 13 | Batch thumbnail signing | `client.ts` | Medium — refactors URL generation |
| 14 | M-Pesa regex | `PaymentModal.tsx` | Low — regex change |
