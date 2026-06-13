# Implementation Plan: Critical Fixes Task Plan

## Overview

Ordered checklist of all bug fixes from the admin app and backend audit. Work through these top-to-bottom — Critical first, then High Priority, then Medium. Each task references the exact file and the specific change needed.

---

## 🔴 Critical Fixes

### 1. Fix Dashboard viewMode ReferenceError

**File:** `split-apps/admin-app/app/(admin)/dashboard/index.tsx`

- [x] 1.1 Delete the `BusinessForecast` function component (the entire function definition, roughly lines 60–130 in the file)
- [x] 1.2 Delete the `tabContainer` JSX block (the two-tab switcher UI with "Analytics Overview" and the second tab)
- [x] 1.3 Remove the `viewMode === 'overview'` ternary that wraps the `revenueSummary` / `forecastSummary` LinearGradient — keep only the `revenueSummary` branch
- [x] 1.4 Remove the `viewMode === 'overview'` conditional that wraps the quick actions, stats grid, engagement section, revenue chart, SMS card, and pending payments list — render all of this unconditionally
- [x] 1.5 Remove the `forecastSummary` style definition from the `StyleSheet.create({})` block if it is no longer referenced
- [x] 1.6 Remove any imports that were only used by `BusinessForecast` and are now unused (check `Database`, `Briefcase` — verify they are not used elsewhere before removing)
- [x] 1.7 Run the TypeScript compiler or open the file in the editor and confirm zero `viewMode` references remain

---

### 2. Fix PaymentModal Interval Memory Leak and Stale Closure

**File:** `split-apps/user-app/components/PaymentModal.tsx`

- [x] 2.1 Add `const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);` near the top of the component (alongside existing state declarations)
- [x] 2.2 Add `const paymentStateRef = useRef<PaymentState>('idle');` near the top of the component
- [x] 2.3 Create a `updatePaymentState` wrapper: `const updatePaymentState = useCallback((state: PaymentState) => { paymentStateRef.current = state; setPaymentState(state); }, []);`
- [x] 2.4 Replace every `setPaymentState(...)` call in the component with `updatePaymentState(...)` (there are approximately 12–15 call sites — search for `setPaymentState` and replace all)
- [x] 2.5 In `startPolling()`: replace `const interval = setInterval(...)` with `pollingIntervalRef.current = setInterval(...)`
- [x] 2.6 In `startPolling()`: replace `clearInterval(interval)` (all 3 occurrences inside the callback) with `clearInterval(pollingIntervalRef.current!); pollingIntervalRef.current = null;`
- [x] 2.7 In `startPolling()`: replace `if (attempts > 10 && paymentState === 'waiting')` with `if (attempts > 10 && paymentStateRef.current === 'waiting')`
- [x] 2.8 In `startManualPolling()`: replace `const interval = setInterval(...)` with `pollingIntervalRef.current = setInterval(...)`
- [x] 2.9 In `startManualPolling()`: replace `clearInterval(interval)` (all 3 occurrences) with `clearInterval(pollingIntervalRef.current!); pollingIntervalRef.current = null;`
- [x] 2.10 Add a cleanup `useEffect` that clears the interval on unmount:
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
- [x] 2.11 In the existing `useEffect` that watches `visible`, add interval cleanup when `visible` becomes `false`:
  ```tsx
  if (!visible) {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }
  ```

---

### 3. Fix STK Push Edge Function Name Mismatch

**File:** `split-apps/user-app/components/PaymentModal.tsx`

- [x] 3.1 Search for all occurrences of `'mpesa-stk-push'` in `PaymentModal.tsx` (there are 2)
- [x] 3.2 Replace both occurrences of `supabase.functions.invoke('mpesa-stk-push', ...)` with `supabase.functions.invoke('stk_push', ...)`
- [x] 3.3 Verify `split-apps/user-app/services/client.ts` `payment.initiateStkPush()` already uses `'stk_push'` — confirm no change needed there
- [x] 3.4 Search the entire codebase for `'mpesa-stk-push'` to confirm no other callers remain

---

### 4. Fix Inbox Unread Count Not Filtered by Admin

**File:** `split-apps/admin-app/app/(admin)/_layout.tsx`

- [x] 4.1 In `fetchUnreadCount()`, add `.eq('owner_admin_id', user.id)` to the Supabase query after the existing `.eq('is_read', false)` filter
- [x] 4.2 Update the real-time subscription filter string from `'sender_role=eq.client'` to `'sender_role=eq.client'` with an additional `owner_admin_id` filter — note: Supabase Realtime filter syntax uses comma separation or `AND` — update to: `filter: \`sender_role=eq.client AND owner_admin_id=eq.${user.id}\``
- [x] 4.3 Verify the `messages` table has an `owner_admin_id` column (check the Supabase schema or existing queries in `AdminService` — it is used in `messaging.send()` in `client.ts`)

---

## 🟡 High Priority Fixes

### 5. Fix Bookings Amount Always Zero

**Files:**
- `split-apps/admin-app/services/admin.ts` — `bookings.list()`
- `split-apps/admin-app/app/(admin)/admin-bookings/index.tsx` — transform

- [x] 5.1 In `AdminService.bookings.list()` in `admin.ts`, find the Supabase select query and add `packages (name, price, shoot_type)` to the select string alongside the existing `user_profiles` join
- [x] 5.2 In `admin-bookings/index.tsx`, in the `loadBookings` transform, update `packageName` from `booking.packages?.name || 'Unknown Package'` to `booking.packages?.name || 'No Package'`
- [x] 5.3 In the same transform, update `amount` from the hardcoded `0` to `booking.packages?.price || 0`
- [x] 5.4 In the same transform, update `type` from the hardcoded `'Session'` to `booking.packages?.shoot_type || 'Session'`
- [x] 5.5 Verify the `bookings` table has a `package_id` foreign key column that links to `packages.id` (check existing migrations or the Supabase dashboard)

---

### 6. Fix Clients total_galleries Always Zero

**File:** `split-apps/admin-app/services/admin.ts` — `clients.list()`

- [x] 6.1 After the existing `clients` fetch (step 2 in the method), collect all CRM client IDs: `const clientIds = (clients || []).map((c: any) => c.id).filter(Boolean);`
- [ ] 6.2 If `clientIds.length > 0`, query the `galleries` table: `SELECT client_id FROM galleries WHERE client_id IN (clientIds)` — use `.select('client_id').in('client_id', clientIds)`
- [~] 6.3 Build a `Map<string, number>` counting galleries per `client_id` from the result
- [~] 6.4 In the `transformed` array map, replace `total_galleries: 0` with `total_galleries: galleryCounts.get(crmData?.id) || 0`
- [~] 6.5 Verify the gallery count appears correctly in the Clients screen UI (the `total_galleries` field should already be rendered — check `clients/index.tsx` to confirm it is displayed)

---

### 7. Link Manual Payments Screen in Admin Navigation

**File:** `split-apps/admin-app/app/(admin)/settings/index.tsx`

- [~] 7.1 Add state for pending payment count: `const [pendingManualPayments, setPendingManualPayments] = useState(0);`
- [~] 7.2 In the existing `useEffect` (or add a new one), fetch the pending count:
  ```typescript
  const { count } = await supabase
    .from('manual_payments')
    .select('*', { count: 'exact', head: true })
    .eq('admin_id', user.id)
    .eq('status', 'pending');
  setPendingManualPayments(count || 0);
  ```
- [~] 7.3 Add a `SettingsRow` entry in the Settings screen (in the Payments section or a new "Payments" section) with:
  - `label="Manual Payments"`
  - `description` showing `"${pendingManualPayments} pending"` if count > 0, otherwise `"Review client payment submissions"`
  - `onPress={() => router.push('/settings/manual-payments')}`
  - `showArrow={true}`
- [~] 7.4 Confirm `settings/manual-payments` is registered as a valid route in the settings `_layout.tsx` (check `split-apps/admin-app/app/(admin)/settings/_layout.tsx` — the file exists so it should already be registered)
- [~] 7.5 Navigate to the Manual Payments screen in the app and confirm the list loads and Verify/Reject buttons work

---

### 8. Fix Gallery List Missing Owner Filter

**File:** `split-apps/admin-app/services/admin.ts` — `gallery.list()`

- [~] 8.1 Find the commented-out line `// .eq('owner_admin_id', user.id) // Removed filter to show all galleries`
- [~] 8.2 Uncomment the `.eq('owner_admin_id', user.id)` filter
- [~] 8.3 Remove the comment explaining why it was removed
- [~] 8.4 Verify the admin can still see their own galleries after the change (test by loading the gallery list in the app)
- [~] 8.5 Note: if there is a legitimate need to see all galleries (e.g., a super-admin view), that should be a separate method — do not revert this fix for that purpose

---

### 9. Fix Announcement Comments Failing for New Users

**File:** `split-apps/user-app/services/client.ts` — `announcements.addComment()`

- [~] 9.1 In `addComment()`, change the client lookup from throwing on missing record to attempting auto-creation:
  - Replace the `if (!client?.id) throw new Error('Client record not found');` block
  - Add a call to `ClientService.clients.ensureLinkedRecordsForCurrentUser()` when `client` is null
  - Re-query `clients` after the ensure call
  - If still null after retry, throw `'Could not create client profile. Please contact support.'`
- [~] 9.2 Ensure the `ensureLinkedRecordsForCurrentUser` call is awaited properly
- [~] 9.3 Test the fix by simulating a new user (a user with no `clients` row) attempting to add a comment — confirm no error is thrown and the comment is inserted
- [~] 9.4 Test that existing users with a `clients` row are not affected — the existing `client.id` should be used without creating a duplicate

---

## 🟢 Medium Priority Fixes

### 10. Remove Duplicate Link Inputs in Settings

**File:** `split-apps/admin-app/app/(admin)/settings/index.tsx`

- [~] 10.1 Search for the share link and access code link `TextInput` components in the Watermark/General tab section of the Settings screen
- [~] 10.2 Remove those input fields from the Watermark section — keep only the ones in the Links tab
- [~] 10.3 Verify the Links tab still shows the inputs and they save correctly
- [~] 10.4 Verify the Watermark section no longer shows link inputs

---

### 11. Replace Fake Activity Log with Real Data

**File:** `split-apps/admin-app/app/(admin)/settings/index.tsx`

- [~] 11.1 Find the hardcoded `activityLog` array constant in the file (it contains static strings like "Gallery uploaded", "Client added", etc.)
- [~] 11.2 Remove the hardcoded array
- [~] 11.3 Add state: `const [activityLog, setActivityLog] = useState<any[]>([]);`
- [~] 11.4 Add a fetch in the existing `useEffect` (or a dedicated one):
  ```typescript
  try {
    const { data: logs, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .eq('admin_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error) setActivityLog(logs || []);
  } catch {
    // Table may not exist yet — show empty state
  }
  ```
- [~] 11.5 Update the activity log render to use the fetched `activityLog` state
- [~] 11.6 Add an empty state: if `activityLog.length === 0`, show `"No activity recorded yet."`
- [~] 11.7 Map the log entry fields to the display format — use `log.action` or `log.description` for the label and `log.created_at` for the timestamp (adjust field names to match the actual `admin_audit_log` table schema)

---

### 12. Refresh Gallery Signed URLs on App Foreground

**File:** `split-apps/user-app/app/(tabs)/gallery/index.tsx`

- [~] 12.1 Import `AppState` and `AppStateStatus` from `react-native` at the top of the file
- [~] 12.2 Add a `useEffect` that subscribes to `AppState` changes:
  ```typescript
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        loadGalleries(); // call the existing data fetch function
      }
    });
    return () => subscription.remove();
  }, []);
  ```
- [~] 12.3 Confirm the existing gallery data fetch function is named `loadGalleries` (or adjust the call to match the actual function name in the file)
- [~] 12.4 Test by backgrounding the app for a few seconds and returning — the gallery should reload without a manual pull-to-refresh

---

### 13. Batch Photo Thumbnail Signing

**File:** `split-apps/user-app/services/client.ts` — `gallery.getPhotos()`

- [~] 13.1 Before the `Promise.all(photos.map(...))` block, collect all storage paths that need signing:
  ```typescript
  const pathsToSign = photos
    .filter(p => !p.photo_url.startsWith('http'))
    .map(p => p.photo_url);
  ```
- [~] 13.2 Call `createSignedUrls()` once for all paths:
  ```typescript
  const { data: signedUrlResults } = pathsToSign.length > 0
    ? await supabase.storage.from('client-photos').createSignedUrls(pathsToSign, 3600)
    : { data: [] };
  const signedUrlMap = new Map(
    (signedUrlResults || []).map(s => [s.path, s.signedUrl])
  );
  ```
- [~] 13.3 Replace the individual `createSignedUrl` calls inside the `photos.map()` with lookups from `signedUrlMap`:
  ```typescript
  const url = p.photo_url.startsWith('http')
    ? p.photo_url
    : signedUrlMap.get(p.photo_url)
      || supabase.storage.from('client-photos').getPublicUrl(p.photo_url).data.publicUrl;
  ```
- [~] 13.4 Remove the `getFullPhotoUrl` inner async function (it is replaced by the map lookup)
- [~] 13.5 Simplify the thumbnail logic — since thumbnails are typically the same path with `_thumb.png` suffix, optionally do a second batch sign for thumbnail paths, or fall back to using the full signed URL as the thumbnail URL
- [~] 13.6 Test with a gallery of 10+ photos and confirm all images load correctly

---

### 14. Improve M-Pesa Code Extraction Regex

**File:** `split-apps/user-app/components/PaymentModal.tsx` — `handleSubmitManualMessage()`

- [~] 14.1 Find the line: `const codeMatch = mpesaMessage.match(/(?:Confirmation Code|code|ref)[\s:\[]*([A-Z0-9]+)/i);`
- [~] 14.2 Replace it with: `const codeMatch = mpesaMessage.match(/\b([A-Z0-9]{10})\b/);`
- [~] 14.3 The `mpesaCode` extraction line below it stays the same: `const mpesaCode = codeMatch ? codeMatch[1] : null;`
- [~] 14.4 Test with a sample Safaricom M-Pesa confirmation message to confirm the code is extracted correctly (e.g., a message containing `"QHG7LK2P3N"` — a 10-char code — should be matched)
- [~] 14.5 Confirm that if no 10-char code is found, `mpesaCode` is `null` and the full message is still submitted

---

## Task Dependency Graph

All 14 fixes are independent of each other. They can be worked on in any order within their priority tier, but the recommended order is top-to-bottom as listed above (Critical → High → Medium).

## Waves

- **Wave 1**: [1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7]
- **Wave 2**: [2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3]
- **Wave 3**: [5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4]
- **Wave 4**: [10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 14.1, 14.2, 14.3, 14.4, 14.5]

---

## Notes

- **Fix 1** is the highest-urgency fix — the dashboard crash prevents admins from using the app at all.
- **Fix 2** is the most complex fix — take care to replace all `setPaymentState` calls with `updatePaymentState` and verify the ref is cleared in all exit paths.
- **Fix 3** requires confirming which Edge Function name is actually deployed in the Supabase project (`stk_push` vs `mpesa-stk-push`). Check the Supabase dashboard → Edge Functions list before making the change.
- **Fix 8** (gallery owner filter) was intentionally commented out at some point. Before restoring it, confirm there is no legitimate use case for showing all galleries to a single admin (e.g., a super-admin dashboard). If there is, create a separate `gallery.listAll()` method for that purpose.
- **Fix 11** (activity log) depends on the `admin_audit_log` table existing. If it does not exist yet, the fix should still be applied (with the try/catch empty state) so it is ready when the table is created.
- **Fix 13** (batch signing) is a performance improvement, not a crash fix. If time is limited, defer it after all Critical and High fixes are done.
