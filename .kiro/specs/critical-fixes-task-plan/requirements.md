# Requirements Document

## Introduction

This spec covers all critical and high-priority bugs identified in the admin app and backend audit of the Epix Visuals Studios Photography App. The goal is to eliminate runtime crashes, memory leaks, data integrity issues, and missing admin UI that block core functionality. Issues are grouped by severity: Critical (🔴) first, then High Priority (🟡), then Medium (🟢).

## Glossary

- **Dashboard**: `split-apps/admin-app/app/(admin)/dashboard/index.tsx` — the admin home screen
- **PaymentModal**: `split-apps/user-app/components/PaymentModal.tsx` — the client-facing payment flow component
- **AdminService**: `split-apps/admin-app/services/admin.ts` — the admin-side Supabase service layer
- **ClientService**: `split-apps/user-app/services/client.ts` — the client-side Supabase service layer
- **Layout**: `split-apps/admin-app/app/(admin)/_layout.tsx` — the admin tab bar layout with unread badge
- **ManualPaymentsScreen**: `split-apps/admin-app/app/(admin)/settings/manual-payments.tsx` — the existing but unlinked manual payments approval screen
- **SettingsScreen**: `split-apps/admin-app/app/(admin)/settings/index.tsx` — the admin settings screen
- **STK Push**: Safaricom M-Pesa STK (Sim Toolkit) push — a server-initiated payment prompt sent to a user's phone
- **Edge Function**: A Supabase serverless function deployed to the project
- **owner_admin_id**: The UUID of the admin who owns a given resource (gallery, message thread, etc.)
- **clients table**: The CRM table linking a `user_profiles` user to an admin via `owner_admin_id`

---

## Requirements

### Requirement 1: Fix Dashboard viewMode ReferenceError

**User Story:** As an admin, I want the dashboard to load without crashing, so that I can view analytics and manage my business.

#### Acceptance Criteria

1. WHEN the admin opens the Dashboard screen, THE Dashboard SHALL render without throwing a ReferenceError.
2. THE Dashboard SHALL remove all JSX conditionals that reference the undefined `viewMode` variable (`viewMode === 'overview'` and `viewMode === 'forecast'`).
3. THE Dashboard SHALL remove the `BusinessForecast` component render and the `forecastSummary` JSX block, as these are dead code.
4. THE Dashboard SHALL display the analytics overview (revenue, stat cards, quick actions) unconditionally without a tab-switching mechanism.
5. IF the `viewMode` variable is referenced anywhere in `dashboard/index.tsx`, THEN THE Dashboard SHALL fail to compile with a TypeScript error.

---

### Requirement 2: Fix PaymentModal Interval Memory Leak and Stale Closure

**User Story:** As a client, I want the payment flow to work reliably without crashing the app or calling callbacks on unmounted components, so that I can pay for my gallery safely.

#### Acceptance Criteria

1. WHEN `startPolling()` is called, THE PaymentModal SHALL store the `setInterval` return value in a `useRef` so it can be cleared.
2. WHEN `startManualPolling()` is called, THE PaymentModal SHALL store the `setInterval` return value in a `useRef` so it can be cleared.
3. WHEN the PaymentModal is closed (the `visible` prop becomes `false`), THE PaymentModal SHALL clear all active polling intervals.
4. WHEN the PaymentModal component unmounts, THE PaymentModal SHALL clear all active polling intervals via a `useEffect` cleanup function.
5. WHEN the polling interval callback reads `paymentState`, THE PaymentModal SHALL use a `useRef` to track the current `paymentState` value so the interval callback always reads the latest value, not a stale closure value.
6. IF the modal is closed while polling is active, THEN THE PaymentModal SHALL NOT call `onSuccess()` or `onClose()` after the modal has been dismissed.

---

### Requirement 3: Fix STK Push Edge Function Name Mismatch

**User Story:** As a client, I want M-Pesa STK push payments to work consistently, so that I can pay for my gallery without getting a 404 error.

#### Acceptance Criteria

1. THE PaymentModal SHALL call the same Edge Function name as `ClientService.payment.initiateStkPush()` for all STK push invocations.
2. WHEN `PaymentModal.tsx` invokes an STK push Edge Function, THE PaymentModal SHALL use the function name `stk_push` (matching `ClientService`).
3. THE codebase SHALL contain exactly one Edge Function name used for STK push initiation across all callers.
4. IF `PaymentModal.tsx` calls `mpesa-stk-push` and `ClientService` calls `stk_push`, THEN one of these SHALL be updated so both callers use the same name.

---

### Requirement 4: Fix Inbox Unread Count Not Filtered by Admin

**User Story:** As an admin in a multi-admin setup, I want the inbox unread badge to show only my unread messages, so that I am not confused by other admins' message counts.

#### Acceptance Criteria

1. WHEN the admin tab bar renders the Inbox badge, THE Layout SHALL query unread messages filtered by the current admin's `owner_admin_id`.
2. THE Layout's unread count query SHALL include `.eq('owner_admin_id', user.id)` in addition to the existing `sender_role` and `is_read` filters.
3. WHEN a new client message arrives for a different admin, THE Layout SHALL NOT increment the current admin's unread badge count.
4. WHEN the current admin's own client sends a message, THE Layout SHALL increment the unread badge count by 1.

---

### Requirement 5: Fix Bookings Amount Always Zero

**User Story:** As an admin, I want to see the correct package name and price on each booking card, so that I can track revenue and confirm the right service was booked.

#### Acceptance Criteria

1. WHEN `AdminService.bookings.list()` is called, THE AdminService SHALL join the `packages` table to retrieve `name`, `price`, and `shoot_type` for each booking.
2. WHEN a booking is displayed in the Bookings screen, THE Bookings screen SHALL show the package name from the joined `packages` data instead of `'Unknown Package'`.
3. WHEN a booking is displayed in the Bookings screen, THE Bookings screen SHALL show the package price as the booking `amount` instead of `0`.
4. WHEN a booking is displayed in the Bookings screen, THE Bookings screen SHALL show the shoot type from the package instead of the hardcoded `'Session'` string.
5. IF a booking has no associated package, THEN THE Bookings screen SHALL display `'No Package'` for the package name and `0` for the amount.

---

### Requirement 6: Fix Clients total_galleries Always Zero

**User Story:** As an admin, I want to see how many galleries each client has, so that I can understand client engagement at a glance.

#### Acceptance Criteria

1. WHEN `AdminService.clients.list()` is called, THE AdminService SHALL count the number of galleries associated with each client.
2. WHEN a client is displayed in the Clients screen, THE Clients screen SHALL show the correct `total_galleries` count for that client.
3. THE AdminService SHALL retrieve the gallery count using a subquery or a separate aggregation query on the `galleries` table filtered by `client_id`.
4. IF a client has no galleries, THEN THE Clients screen SHALL display `0` for `total_galleries`.

---

### Requirement 7: Link Manual Payments Screen in Admin Navigation

**User Story:** As an admin, I want to access the Manual Payments approval screen from the Settings menu, so that I can verify or reject client manual payment submissions.

#### Acceptance Criteria

1. THE SettingsScreen SHALL include a navigation entry that routes to `settings/manual-payments`.
2. WHEN an admin taps the Manual Payments entry in Settings, THE SettingsScreen SHALL navigate to the ManualPaymentsScreen.
3. THE ManualPaymentsScreen SHALL display all pending `manual_payments` records for the current admin.
4. WHEN an admin taps "Verify" on a pending payment, THE ManualPaymentsScreen SHALL update the `manual_payments` record status to `'verified'` and unlock the associated gallery.
5. WHEN an admin taps "Reject" on a pending payment, THE ManualPaymentsScreen SHALL update the `manual_payments` record status to `'rejected'`.
6. THE SettingsScreen navigation entry for Manual Payments SHALL display a badge count of pending (unverified) manual payments if any exist.

---

### Requirement 8: Fix Gallery List Missing Owner Filter

**User Story:** As an admin in a multi-admin setup, I want to see only my own galleries, so that I cannot accidentally view or modify another admin's client galleries.

#### Acceptance Criteria

1. WHEN `AdminService.gallery.list()` is called, THE AdminService SHALL filter galleries by `.eq('owner_admin_id', user.id)`.
2. WHEN an admin views the gallery list, THE AdminService SHALL NOT return galleries owned by other admins.
3. IF the `owner_admin_id` filter is removed or commented out, THEN THE AdminService SHALL be considered non-compliant with this requirement.
4. THE mock data path (when `USE_MOCK` is true) is exempt from this filter requirement.

---

### Requirement 9: Fix Announcement Comments Failing for New Users

**User Story:** As a new client who has just signed up, I want to be able to comment on announcements, so that I can engage with the photographer's content from day one.

#### Acceptance Criteria

1. WHEN `ClientService.announcements.addComment()` is called for a user with no `clients` row, THE ClientService SHALL NOT throw `'Client record not found'`.
2. WHEN a user with no `clients` row attempts to add a comment, THE ClientService SHALL attempt to create a `clients` record for that user before inserting the comment.
3. IF creating the `clients` record fails, THEN THE ClientService SHALL throw a descriptive error explaining that the client profile could not be created.
4. WHEN a user with an existing `clients` row adds a comment, THE ClientService SHALL insert the comment using the existing `clients.id` without creating a duplicate record.
5. THE `announcement_comments` insert SHALL use the resolved `client.id` (from the `clients` table) as the `client_id` field.

---

### Requirement 10: Remove Duplicate Link Inputs in Settings

**User Story:** As an admin, I want the Settings screen to have a single, clear place to manage my share links, so that I am not confused by duplicate input fields.

#### Acceptance Criteria

1. THE SettingsScreen SHALL display share/access code link inputs in exactly one location (the Links tab).
2. THE SettingsScreen Watermark section SHALL NOT contain share link or access code link input fields.
3. WHEN an admin saves link settings from the Links tab, THE SettingsScreen SHALL persist the values to the `admin_settings` table.

---

### Requirement 11: Replace Fake Activity Log with Real Data

**User Story:** As an admin, I want to see a real audit log of my actions, so that I can track what changes were made and when.

#### Acceptance Criteria

1. WHEN the admin views the Activity Log section in Settings, THE SettingsScreen SHALL fetch real records from the `admin_audit_log` table filtered by the current admin's ID.
2. THE SettingsScreen SHALL NOT display hardcoded mock activity log entries.
3. WHEN no audit log records exist, THE SettingsScreen SHALL display an empty state message such as "No activity recorded yet."
4. THE SettingsScreen SHALL display the most recent 20 audit log entries ordered by `created_at` descending.
5. IF the `admin_audit_log` table does not exist or the query fails, THEN THE SettingsScreen SHALL display an error state rather than mock data.

---

### Requirement 12: Refresh Gallery Signed URLs on App Foreground

**User Story:** As a client who keeps the app open for extended periods, I want gallery images to remain visible after an hour, so that I do not see broken images when I return to the app.

#### Acceptance Criteria

1. WHEN the app returns to the foreground after being backgrounded, THE Gallery screen SHALL refresh signed URLs for visible gallery photos.
2. THE signed URL refresh SHALL be triggered by the React Native `AppState` `'active'` event.
3. WHEN signed URLs are refreshed, THE Gallery screen SHALL replace expired URLs with new ones without requiring a full page reload.
4. THE new signed URLs SHALL have an expiry of at least 3600 seconds from the time of refresh.

---

### Requirement 13: Batch Photo Thumbnail Signing

**User Story:** As a client viewing a gallery with many photos, I want thumbnails to load quickly, so that I do not experience slow load times caused by sequential URL signing.

#### Acceptance Criteria

1. WHEN `ClientService.gallery.getPhotos()` generates signed URLs for gallery photos, THE ClientService SHALL use `createSignedUrls()` (batch) instead of individual `createSignedUrl()` calls.
2. THE batch signing call SHALL request signed URLs for all photos in a single Supabase Storage API call.
3. WHEN the batch signing call returns, THE ClientService SHALL map each signed URL back to its corresponding photo record.
4. IF a photo's path is not found in the batch result, THEN THE ClientService SHALL fall back to a public URL for that photo.

---

### Requirement 14: Improve M-Pesa Code Extraction Regex

**User Story:** As a client submitting a manual M-Pesa payment, I want the app to correctly extract my transaction code from the confirmation SMS, so that the admin can verify my payment without manual lookup.

#### Acceptance Criteria

1. WHEN a client pastes an M-Pesa confirmation message, THE PaymentModal SHALL extract the transaction code using a regex pattern that matches all standard Safaricom M-Pesa code formats.
2. THE PaymentModal SHALL use the pattern `/\b([A-Z0-9]{10})\b/` to extract M-Pesa transaction codes, as Safaricom codes are always exactly 10 alphanumeric characters.
3. WHEN the regex matches multiple 10-character codes in the message, THE PaymentModal SHALL use the first match as the transaction code.
4. IF no 10-character alphanumeric code is found in the message, THEN THE PaymentModal SHALL set `mpesa_code` to `null` and still submit the full message for admin review.
