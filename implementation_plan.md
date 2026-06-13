# Feature Implementation Plan

## Overview
This document outlines the 5 major features being implemented for the photography platform.

## Features

### ✅ 1. Upload Screen Enhancement
**Status**: Partially Complete (existing functionality)
- Admin can create new clients on upload screen (ALREADY EXISTS)
- Need to add: Share invite link via WhatsApp after upload

### ✅ 2. Gallery Privacy (Admin Isolation)
**Status**: Database migration created
- Each admin has separate client records
- Clients are scoped to owner_admin_id (ALREADY EXISTS via RLS)
- No shared clients across admins

### ✅ 3. Photographer Tagging in Client App
**Status**: Database migration created
- Added `photographer_name` and `photographer_id` to galleries table
- Trigger auto-populates photographer info on gallery creation
- Need to: Display photographer name on gallery tiles in user app

### 🔄 4. Payment Settings Consolidation
**Status**: To be implemented
- Merge Paybill, Till, and Manual Payment into ONE screen
- Simplify payment configuration UI

### 🔄 5. Manual Payment Flow
**Status**: Database tables created, UI to be implemented
**Flow**:
1. Client initiates manual payment in PaymentModal
2. Client enters M-Pesa transaction code
3. Code saved to `manual_payment_verifications` table (status: pending)
4. Admin sees pending payment in admin panel
5. Admin verifies code manually → Gallery unlocks
6. Admin can also reject with reason

## Database Schema

### New Tables

#### `manual_payment_verifications`
```sql
- id (UUID)
- gallery_id (FK to galleries)
- client_id (FK to clients)
- admin_id (FK to user_profiles)
- mpesa_code (TEXT) - M-Pesa transaction code from client
- amount (DECIMAL)
- status (pending | verified | rejected)
- verified_at (TIMESTAMPTZ)
- verified_by (UUID)
- rejection_reason (TEXT)
- created_at, updated_at
```

### Modified Tables

#### `galleries`
```sql
+ photographer_name (TEXT) - Auto-populated from user_profiles.name
+ photographer_id (UUID) - References user_profiles(id)
```

## Implementation Status

### Completed
- ✅ Database migration for photographer tagging
- ✅ Database migration for manual payment verification
- ✅ Trigger to auto-populate photographer name
- ✅ Function to verify/reject manual payments
- ✅ Bundler fix (disabled @lenzart imports in root app)
- ✅ Client invite link system (already implemented)

### In Progress
- 🔄 Add photographer name display to gallery tiles (user app)
- 🔄 Add WhatsApp share button after upload (admin app)
- 🔄 Consolidate payment settings screen (admin app)
- 🔄 Manual payment UI in PaymentModal (user app)
- 🔄 Manual payment verification screen (admin app)

### Next Steps
1. Update user app gallery tiles to show photographer name
2. Add "Share via WhatsApp" button to upload success modal
3. Create consolidated payment settings screen
4. Add manual payment option to PaymentModal
5. Create admin screen to view/verify manual payments

## File Changes Required

### User App
- `split-apps/user-app/app/(tabs)/gallery/index.tsx` - Add photographer tag to gallery tiles
- `split-apps/user-app/components/PaymentModal.tsx` - Add manual payment option

### Admin App
- `split-apps/admin-app/app/(admin)/upload.tsx` - Add WhatsApp share after upload
- `split-apps/admin-app/app/(admin)/settings/payments.tsx` - Consolidate payment settings
- `split-apps/admin-app/app/(admin)/settings/manual-payments.tsx` - NEW: Manual payment verification screen

### Edge Functions
- Already complete: `generate_invite_link` and `invite_redirect` exist

## Architecture Notes

### Client Privacy
- Clients are already scoped by `owner_admin_id` via RLS policies
- Each admin sees only their own clients
- No changes needed - this is already enforced at DB level

### Invite Link System
- Already implemented via `client_invite_links` table
- `generate_invite_link` Edge Function creates unique tokens
- Tokens bind clients to specific admins
- Universal links work: `epixvisuals://join?ref=ADMIN_ID&invite=TOKEN`

### Manual Payment Verification
- Client submits M-Pesa code → creates `manual_payment_verifications` record
- Admin panel shows pending payments
- Admin calls `verify_manual_payment()` function
- Function updates gallery: `is_paid = TRUE, is_locked = FALSE`

## Migration Files
1. `20260602000001_privacy_and_tagging.sql` - ✅ Ready to apply
