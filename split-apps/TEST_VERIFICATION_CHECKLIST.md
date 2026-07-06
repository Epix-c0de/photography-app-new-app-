# M-PESA Gateway Implementation - Test Verification Checklist

## Phase 12: Testing & Verification

**Date:** July 5, 2026
**Status:** Ready for Testing

---

## 1. Database & Encryption (Phase 1)

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 1.1 | Run `supabase db reset` | All migrations apply cleanly | ⬜ |
| 1.2 | Query `payment_gateways` table | Table exists with RLS policies | ⬜ |
| 1.3 | Query `transactions` table | Table exists with indexes | ⬜ |
| 1.4 | Test `encrypt()` function | Returns encrypted string | ⬜ |
| 1.5 | Test `decrypt()` function | Returns original value | ⬜ |
| 1.6 | Test `maskSecret()` function | Returns `••••` with last 4 chars | ⬜ |

---

## 2. M-Pesa Engine (Phase 2)

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 2.1 | Call `mpesa-oauth` with valid creds | Returns access_token | ⬜ |
| 2.2 | Call `mpesa-oauth` with invalid creds | Returns clear error | ⬜ |
| 2.3 | Call `mpesa-test-connection` (sandbox) | Returns success + latency_ms | ⬜ |
| 2.4 | Call `mpesa-test-connection` (production) | Returns success or clear error | ⬜ |
| 2.5 | Call `mpesa-stk-push` (Till) | TransactionType = CustomerBuyGoodsOnline | ⬜ |
| 2.6 | Call `mpesa-stk-push` (Paybill) | TransactionType = CustomerPayBillOnline | ⬜ |
| 2.7 | Call `mpesa-stk-push` with invalid phone | Returns 400 error | ⬜ |
| 2.8 | Call `mpesa-stk-push` with invalid amount | Returns 400 error | ⬜ |
| 2.9 | Call `mpesa-stk-push` 6 times rapidly | 6th request returns 429 (rate limit) | ⬜ |
| 2.10 | Simulate STK callback (success) | Transaction marked success | ⬜ |
| 2.11 | Simulate STK callback (duplicate) | Idempotent - no double processing | ⬜ |
| 2.12 | Simulate STK callback (failure) | Transaction marked failed, error mapped | ⬜ |
| 2.13 | Call `mpesa-stkquery` for pending tx | Returns current status | ⬜ |
| 2.14 | Call `mpesa-c2b-register` (Paybill) | URLs registered successfully | ⬜ |
| 2.15 | Call `mpesa-status` for tx | Returns transaction details | ⬜ |

---

## 3. Admin Gateway UI (Phase 3)

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 3.1 | Open GatewayConfigModal | Shows Till/Paybill toggle | ⬜ |
| 3.2 | Select Till | Shows only Till Number field | ⬜ |
| 3.3 | Select Paybill | Shows Business Number + Account fields | ⬜ |
| 3.4 | Enter invalid Till number | Shows inline validation error | ⬜ |
| 3.5 | Click Test Connection | Shows spinner then checkmark/X | ⬜ |
| 3.6 | Save without testing | Shows confirmation dialog | ⬜ |
| 3.7 | Save after successful test | Gateway saved successfully | ⬜ |
| 3.8 | List gateways | Shows masked secrets (••••) | ⬜ |

---

## 4. Client Payment Flow (Phase 4)

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 4.1 | Enter phone 0712345678 | Normalized to 254712345678 | ⬜ |
| 4.2 | Enter phone +254712345678 | Normalized to 254712345678 | ⬜ |
| 4.3 | Enter phone 254712345678 | Accepted as-is | ⬜ |
| 4.4 | Enter invalid phone | Shows "Invalid Phone" error | ⬜ |
| 4.5 | Tap Pay via STK Push | STK prompt sent to phone | ⬜ |
| 4.6 | Enter correct PIN | Payment successful, gallery unlocked | ⬜ |
| 4.7 | Enter wrong PIN | Shows error message from ResultCode | ⬜ |
| 4.8 | Cancel STK prompt | Shows "Request cancelled by user" | ⬜ |
| 4.9 | Double-tap Pay button | Only one STK push fires (idempotency) | ⬜ |
| 4.10 | Polling timeout | Falls back to STK query | ⬜ |

---

## 5. SMS Engine (Phase 5)

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 5.1 | Send SMS via `send-sms` function | Real Africa's Talking API called | ⬜ |
| 5.2 | Send SMS with invalid phone | Returns error | ⬜ |
| 5.3 | Check SMS balance | Returns `admin_resources.sms_balance` | ⬜ |
| 5.4 | Send SMS from messaging.tsx | Uses correct parameter names | ⬜ |
| 5.5 | Apply template in messaging.tsx | Variables use {single_curly} syntax | ⬜ |

---

## 6. Photo Upload Pipeline (Phase 6)

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 6.1 | Upload JPEG photo | Accepted in both file + confirm steps | ⬜ |
| 6.2 | Upload WebP photo | Accepted in both file + confirm steps | ⬜ |
| 6.3 | Upload HEIC photo | Accepted in both file + confirm steps | ⬜ |
| 6.4 | Upload video MP4 | Accepted in both file + confirm steps | ⬜ |
| 6.5 | Call `admin_upload_status` | Queries `gallery_photos` table | ⬜ |
| 6.6 | Finalize gallery (first time) | Notification sent to client | ⬜ |
| 6.7 | Finalize gallery (duplicate) | No duplicate notification | ⬜ |
| 6.8 | Finalize gallery | Notification has correct `user_id` | ⬜ |

---

## 7. BTS & Announcements (Phase 7)

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 7.1 | Publish BTS post | Notifications sent to ALL clients | ⬜ |
| 7.2 | Publish announcement | Notifications sent to ALL clients | ⬜ |
| 7.3 | Delete BTS comment | `comments_count` decremented | ⬜ |
| 7.4 | Delete announcement comment | `comments_count` decremented | ⬜ |

---

## 8. Likes, Comments & Bookmarks (Phase 8)

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 8.1 | Create BTS bookmark | Record in `bts_bookmarks` | ⬜ |
| 8.2 | Delete BTS bookmark | Record removed | ⬜ |
| 8.3 | Create announcement bookmark | Record in `announcement_bookmarks` | ⬜ |
| 8.4 | Create portfolio comment | Record in `portfolio_comments` | ⬜ |
| 8.5 | Delete portfolio comment | `comments_count` decremented | ⬜ |

---

## 9. SMS Refill - Super Admin (Phase 9)

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 9.1 | Super admin refill SMS | Credits added, audit logged | ⬜ |
| 9.2 | Non-super admin refill | Returns "Forbidden" error | ⬜ |
| 9.3 | Refill with invalid amount | Returns validation error | ⬜ |
| 9.4 | Refill with non-existent admin | Returns "not found" error | ⬜ |

---

## 10. Security & Error Handling (Phase 11)

| # | Test | Expected Result | Status |
|---|------|-----------------|--------|
| 10.1 | Log sensitive data | Secrets are masked in output | ⬜ |
| 10.2 | Rate limit exceeded | Returns 429 with retry_after_ms | ⬜ |
| 10.3 | GET gateway response | Secrets show as `••••` | ⬜ |
| 10.4 | Invalid timezone in STK push | Uses Africa/Nairobi correctly | ⬜ |

---

## Environment Variables Required

```env
# M-Pesa (Production)
PLATFORM_MPESA_CONSUMER_KEY=your_key
PLATFORM_MPESA_CONSUMER_SECRET=your_secret
PLATFORM_MPESA_SHORTCODE=your_shortcode
PLATFORM_MPESA_PASSKEY=your_passkey

# Africa's Talking SMS
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_USERNAME=your_username
AFRICASTALKING_SENDER_ID=your_sender_id

# Supabase
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

---

## Quick Test Commands

```bash
# Run all migrations
supabase db reset

# Deploy edge functions
supabase functions deploy

# Test OAuth
curl -X POST https://your-project.supabase.co/functions/v1/mpesa-oauth \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# Test Connection
curl -X POST https://your-project.supabase.co/functions/v1/mpesa-test-connection \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"consumer_key":"test","consumer_secret":"test","environment":"sandbox"}'

# Test STK Push
curl -X POST https://your-project.supabase.co/functions/v1/mpesa-stk-push \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"0712345678","amount":1,"gallery_id":"test"}'
```
