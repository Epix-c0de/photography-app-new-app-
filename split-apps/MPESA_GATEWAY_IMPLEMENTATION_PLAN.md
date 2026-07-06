# M-PESA PAYMENT GATEWAY & ADMIN APP REDESIGN
## Complete Implementation Plan

**Date:** July 5, 2026  
**Scope:** Admin App (Mobile) + Photographer Dashboard (Web) + Client App  
**Status:** Planning Phase

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Audit](#2-current-architecture-audit)
3. [Gap Analysis: Mobile vs Web](#3-gap-analysis-mobile-vs-web)
4. [Phase 1: Database Schema & Encryption](#4-phase-1-database-schema--encryption)
5. [Phase 2: M-Pesa Engine (Backend)](#5-phase-2-mpesa-engine-backend)
6. [Phase 3: Admin Gateway Configuration UI](#6-phase-3-admin-gateway-configuration-ui)
7. [Phase 4: Client Payment Flow](#7-phase-4-client-payment-flow)
8. [Phase 5: SMS & WhatsApp Engine](#8-phase-5-sms--whatsapp-engine)
9. [Phase 6: Photo Upload Pipeline](#9-phase-6-photo-upload-pipeline)
10. [Phase 7: BTS & Announcements Engine](#10-phase-7-bts--announcements-engine)
11. [Phase 8: Likes, Comments & Bookmarks](#11-phase-8-likes-comments--bookmarks)
12. [Phase 9: SMS Refill (Super Admin)](#12-phase-9-sms-refill-super-admin)
13. [Phase 10: Admin App UI Redesign](#13-phase-10-admin-app-ui-redesign)
14. [Phase 11: Security & Error Handling](#14-phase-11-security--error-handling)
15. [Phase 12: Testing & Verification](#15-phase-12-testing--verification)
16. [File Creation Summary](#16-file-creation-summary)

---

## 1. EXECUTIVE SUMMARY

This plan covers the complete M-Pesa payment gateway integration and admin app redesign for a multi-tenant photography platform. The system has three apps:

- **Admin App (Mobile):** React Native/Expo - manages clients, galleries, payments, SMS
- **Photographer Dashboard (Web):** Next.js 14 - web version of the admin app
- **Client App (Mobile):** React Native/Expo - customer-facing payment and gallery access

### Key Problems to Solve

| Problem | Impact | Priority |
|---------|--------|----------|
| M-Pesa is fragmented across 6+ edge functions | Silent failures, no token caching | CRITICAL |
| No encryption at rest for API credentials | Security vulnerability | CRITICAL |
| Africa's Talking SMS is mocked/simulated | SMS doesn't actually send | HIGH |
| Dual credit systems (legacy + current) | Confusion, bugs | HIGH |
| Mobile and web apps have different feature sets | Inconsistent experience | HIGH |
| BTS/Announcements have two upload paths (Edge Functions vs direct) | Data inconsistency | MEDIUM |
| Bookmark tables may not exist | Runtime errors | MEDIUM |
| Template variable syntax mismatch (single vs double curly) | Confusion | LOW |

---

## 2. CURRENT ARCHITECTURE AUDIT

### 2.1 Admin App (Mobile) - File Inventory

| Directory | Files | Purpose |
|-----------|-------|---------|
| `app/` | 64 files | 51 routes across root, admin tabs, settings, auth, BTS, announcements |
| `components/` | 7 files | Reusable UI components |
| `lib/` | 11 files | Utilities, M-Pesa, messaging, network, auth |
| `services/` | 5 files | Admin (1848 lines), Client (661 lines), SMS (474 lines), Delivery (322 lines), Backend (89 lines stub) |
| `contexts/` | 3 files | AuthContext (790 lines), AdminAuthContext (515 lines), BrandingContext (307 lines) |
| `types/` | 1 file | Supabase Database types (1267 lines) |
| `supabase/functions/` | 46 edge functions | M-Pesa, SMS, upload pipeline, BTS, announcements, etc. |
| `supabase/migrations/` | 79 files | Database schema evolution |

### 2.2 Photographer Dashboard (Web) - File Inventory

| Directory | Files | Purpose |
|-----------|-------|---------|
| `src/app/` | 20 pages | Login, dashboard, galleries, clients, upload, inbox, BTS, bookings, settings, etc. |
| `src/app/api/` | 3 routes | Web login token verification, login request, login verify |
| `src/lib/` | 5 files | Supabase, M-Pesa, messaging, compression, shareable links |

### 2.3 Edge Functions (Shared)

| Category | Functions | Count |
|----------|-----------|-------|
| M-Pesa | `mpesa-stk-push`, `mpesa-callback`, `stk_push`, `client_payments_stkpush`, `payments_mpesa_callback`, `payment_callback`, `buy_sms`, `sms-bundle-callback` | 8 |
| SMS/WhatsApp | `send_sms`, `send-sms` (missing), `sms-record`, `admin_sms_send`, `send-whatsapp`, `delivery-callback` | 6 |
| Upload | `admin_upload_init`, `admin_upload_file`, `admin_upload_confirm`, `admin_upload_complete`, `admin_upload_finalize`, `admin_upload_resume_status`, `admin_upload_status` | 7 |
| BTS/Announcements | `admin_bts_create`, `admin_bts_upload_media`, `admin_bts_publish`, `admin_announcements_create`, `admin_announcements_upload_media`, `admin_announcements_publish` | 6 |
| Gallery | `admin_gallery_delete`, `client_gallery_access`, `client_gallery_download`, `compress-image`, `image_pipeline`, `admin_process_image` | 6 |
| Other | `generate-receipt`, `generate-short-url`, `generate_video_thumbnail`, `create-installment-plan`, `process-referral`, `send-review-request`, `ussd-handler`, `ensure_buckets` | 8 |

---

## 3. GAP ANALYSIS: MOBILE vs WEB

### 3.1 Feature Parity Matrix

| Feature | Mobile Admin | Web Dashboard | Gap |
|---------|-------------|---------------|-----|
| Dashboard Stats | Yes | Yes | Web has more detailed revenue breakdown |
| Client Management | Yes | Yes | Web has phone-based client lookup via RPC |
| Gallery Management | Yes | Yes | Web has USSD code display, promote to announcement |
| Photo Upload | Yes | Yes | Web has image compression, multi-delivery |
| M-Pesa Config | Yes (fragmented) | Yes (simple) | Both need `payment_gateways` table |
| SMS Send | Yes | Yes | Mobile has 3-tier fallback, web has server-side only |
| SMS Credits | Dual system | Single system | Need to consolidate to `admin_resources.sms_balance` |
| SMS Bundle Purchase | Yes | Yes | Both use same `buy_sms` edge function |
| BTS Posting | Yes | Yes | Mobile bypasses Edge Functions, uses direct upload |
| Announcements | Yes | Yes | Same bypass issue as BTS |
| Bookings | Yes | Yes | Web has availability calendar |
| Calendar | Yes | Yes | Both use Kenyan holidays |
| Reviews | Yes | Yes | Web has `send-review-request` edge function |
| Referrals | Yes | Yes | Web has reward tiers |
| Social Media | Yes | Yes | Both have Instagram/Facebook OAuth |
| Inbox/Chat | Yes | Yes | Both have realtime messaging |
| Support Chat | No | Yes | Mobile missing support chat with super admin |
| Receipt Settings | Yes | Yes | Web has live preview |
| Watermark Settings | Yes | Yes | Both use BrandingContext |
| USSD Settings | Yes | Yes | Both use same config |
| Delivery Gateways | Yes | No | Web doesn't have delivery gateway management |
| Manual Payments | Yes | No | Web doesn't have manual payment verification |
| M-Pesa Inbox | Yes | No | Web doesn't have M-Pesa message inbox |
| Admin Management | Yes | No | Mobile-only master admin screen |
| Portfolio | Yes | Yes | Web has dedicated portfolio page |

### 3.2 Critical Mismatches

1. **Upload Pipeline:** Mobile Edge Functions use `bts-media` bucket with signed URLs and draft-then-publish flow. Mobile UI bypasses this and uploads directly to `media` bucket with public URLs. Web dashboard also uploads directly. Need to standardize.

2. **SMS Credits:** Mobile reads from `user_profiles.sms_credits` (legacy) AND `admin_resources.sms_balance` (current). Web reads from `user_profiles.sms_credits` only. Need to consolidate.

3. **Template Syntax:** UI shows `{{double_curly}}` hints but compilation uses `{single_curly}`. Need to standardize.

4. **M-Pesa Functions:** 6 different edge functions doing similar M-Pesa work. Need to consolidate into 2 (STK push + callback).

---

## 4. PHASE 1: DATABASE SCHEMA & ENCRYPTION

**Duration:** Week 1  
**Goal:** Create the `payment_gateways` table, fix data model, add encryption

### 4.1 New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260705000001_payment_gateways.sql` | Create `payment_gateways` table with encryption, RLS, partial unique index |
| `supabase/migrations/20260705000002_transactions_table.sql` | Create unified `transactions` table for all payment types |
| `lib/encryption.ts` | AES-256-GCM encrypt/decrypt utility using server-side key |

### 4.2 Migration: payment_gateways

```sql
-- Create payment_gateways table
CREATE TABLE payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  gateway_type TEXT NOT NULL CHECK (gateway_type IN ('till', 'paybill')),
  shortcode TEXT NOT NULL,
  account_reference TEXT, -- Only for Paybill, null for Till
  consumer_key TEXT NOT NULL, -- Encrypted at app layer
  consumer_secret TEXT NOT NULL, -- Encrypted at app layer
  passkey TEXT NOT NULL, -- Encrypted at app layer
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  callback_url TEXT NOT NULL, -- Auto-generated
  confirmation_url TEXT NOT NULL, -- Auto-generated
  validation_url TEXT NOT NULL, -- Auto-generated
  is_active BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active gateway per client
CREATE UNIQUE INDEX idx_one_active_gateway_per_client 
  ON payment_gateways (client_id) 
  WHERE is_active = true;

-- RLS Policies
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

-- Admin can read/write all gateways
CREATE POLICY "Admin full access" ON payment_gateways
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- Client can only read their own gateways (masked)
CREATE POLICY "Client read own" ON payment_gateways
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = payment_gateways.client_id 
      AND clients.user_id = auth.uid()
    )
  );
```

### 4.3 Migration: transactions

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  gateway_id UUID REFERENCES payment_gateways(id),
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  phone_number TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
  mpesa_receipt_number TEXT,
  result_code INTEGER,
  result_desc TEXT,
  transaction_type TEXT, -- 'stk_push' or 'c2b'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_checkout ON transactions(checkout_request_id);
CREATE INDEX idx_transactions_client ON transactions(client_id, created_at DESC);
```

### 4.4 Encryption Utility

```typescript
// lib/encryption.ts
import * as Crypto from 'expo-crypto';

const ENCRYPTION_KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY!;

export function encrypt(plaintext: string): string {
  // AES-256-GCM encryption
  // Returns base64 encoded ciphertext with IV prepended
}

export function decrypt(ciphertext: string): string {
  // AES-256-GCM decryption
  // Extracts IV from first 16 bytes, decrypts rest
}

export function maskSecret(value: string): string {
  if (!value || value.length < 4) return '••••';
  return '••••' + value.slice(-4);
}
```

### 4.5 Modified Files

| File | Change |
|------|--------|
| `types/supabase.ts` | Add `payment_gateways` and `transactions` Row/Insert/Update types |

---

## 5. PHASE 2: M-PESA ENGINE (BACKEND)

**Duration:** Week 1-2  
**Goal:** Build the complete Daraja API integration layer

### 5.1 New Files

| File | Purpose |
|------|---------|
| `supabase/functions/mpesa-oauth/index.ts` | OAuth token generation with in-memory caching |
| `supabase/functions/mpesa-test-connection/index.ts` | Test credentials without STK push |
| `supabase/functions/mpesa-stkquery/index.ts` | Query STK status (fallback for missing callbacks) |
| `supabase/functions/mpesa-c2b-register/index.ts` | Register C2B URLs for Paybill |
| `supabase/functions/mpesa-c2b-validation/index.ts` | C2B validation endpoint |
| `supabase/functions/mpesa-c2b-confirmation/index.ts` | C2B confirmation endpoint |
| `supabase/functions/mpesa-status/index.ts` | GET status by checkout_request_id |
| `lib/mpesa-engine.ts` | Core M-Pesa engine with typed errors |
| `lib/mpesa-errors.ts` | Typed error classes |

### 5.2 OAuth Token with Caching

```typescript
// supabase/functions/mpesa-oauth/index.ts

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getOAuthToken(
  consumerKey: string, 
  consumerSecret: string, 
  environment: 'sandbox' | 'production'
): Promise<string> {
  const cacheKey = `${consumerKey.slice(-8)}_${environment}`;
  const cached = tokenCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const baseUrl = environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  const auth = btoa(`${consumerKey}:${consumerSecret}`);
  
  const response = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  const data = await response.json();
  
  if (!response.ok || !data.access_token) {
    throw new InvalidCredentialsError(
      'Failed to authenticate with Safaricom',
      data // Attach raw Daraja error body
    );
  }

  // Cache with TTL (Daraja tokens expire in ~3599s)
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000) - 60000 // 1 min buffer
  });

  return data.access_token;
}
```

### 5.3 STK Push (Rewrite)

```typescript
// supabase/functions/mpesa-stk-push/index.ts

// CRITICAL: Use Africa/Nairobi timezone for timestamp
function getNairobiTimestamp(): string {
  const now = new Date();
  const nairobiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${nairobiTime.getFullYear()}${pad(nairobiTime.getMonth() + 1)}${pad(nairobiTime.getDate())}${pad(nairobiTime.getHours())}${pad(nairobiTime.getMinutes())}${pad(nairobiTime.getSeconds())}`;
}

async function initiateSTKPush(params: {
  client_id: string;
  phone: string;
  amount: number;
  accountReference?: string;
  description?: string;
}) {
  // 1. Fetch active gateway config, decrypt secrets
  const gateway = await getActiveGateway(params.client_id);
  const passkey = decrypt(gateway.passkey);
  const consumerSecret = decrypt(gateway.consumer_secret);
  
  // 2. Get OAuth token (from cache)
  const token = await getOAuthToken(
    decrypt(gateway.consumer_key), 
    consumerSecret, 
    gateway.environment
  );

  // 3. Build password
  const timestamp = getNairobiTimestamp();
  const password = btoa(`${gateway.shortcode}${passkey}${timestamp}`);

  // 4. Determine transaction type
  const transactionType = gateway.gateway_type === 'till' 
    ? 'CustomerBuyGoodsOnline' 
    : 'CustomerPayBillOnline';

  // 5. Build STK Push body
  const stkBody = {
    BusinessShortCode: gateway.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: transactionType,
    Amount: Math.max(1, Math.round(params.amount)),
    PartyA: params.phone,
    PartyB: gateway.shortcode,
    PhoneNumber: params.phone,
    CallBackURL: gateway.callback_url,
    AccountReference: params.accountReference || `TXN-${Date.now()}`,
    TransactionDesc: params.description || 'Payment'
  };

  // 6. Call Daraja API
  const baseUrl = gateway.environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(stkBody)
  });

  const data = await response.json();

  if (data.ResponseCode !== '0') {
    throw new STKPushError(
      data.ResponseDescription || 'STK Push failed',
      data
    );
  }

  // 7. Store transaction BEFORE returning
  await supabase.from('transactions').insert({
    client_id: params.client_id,
    gateway_id: gateway.id,
    checkout_request_id: data.CheckoutRequestID,
    merchant_request_id: data.MerchantRequestID,
    phone_number: params.phone,
    amount: params.amount,
    status: 'pending',
    transaction_type: 'stk_push'
  });

  return {
    checkout_request_id: data.CheckoutRequestID,
    merchant_request_id: data.MerchantRequestID,
    response_code: data.ResponseCode,
    customer_message: data.CustomerMessage
  };
}
```

### 5.4 STK Callback Handler

```typescript
// supabase/functions/mpesa-callback/index.ts

// CRITICAL: Always respond 200 to Safaricom or they retry relentlessly
async function handleSTKCallback(req: Request) {
  const payload = await req.json();
  const stkCallback = payload.Body?.stkCallback;

  if (!stkCallback) {
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

  // Idempotency check: skip if already processed
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, status')
    .eq('checkout_request_id', CheckoutRequestID)
    .single();

  if (existing && existing.status !== 'pending') {
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Already processed" }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (ResultCode === 0) {
    // Parse CallbackMetadata - array of {Name, Value} objects
    // Fields can be ABSENT, always check before accessing
    const items = CallbackMetadata?.Item || [];
    const getMetaValue = (name: string) => {
      const item = items.find((i: any) => i.Name === name);
      return item?.Value;
    };

    const mpesaReceipt = getMetaValue('MpesaReceiptNumber') || '';
    const transactionDate = getMetaValue('TransactionDate');
    const phoneNumber = getMetaValue('PhoneNumber');
    const amount = getMetaValue('Amount');

    await supabase
      .from('transactions')
      .update({
        status: 'success',
        mpesa_receipt_number: mpesaReceipt,
        result_code: ResultCode,
        result_desc: ResultDesc,
        updated_at: new Date().toISOString()
      })
      .eq('checkout_request_id', CheckoutRequestID);

    // Trigger downstream actions (unlock gallery, credit account, etc.)
    await handleSuccessfulPayment(CheckoutRequestID, mpesaReceipt);
  } else {
    // Map known Safaricom result codes to human-readable reasons
    const failureReason = mapResultCode(ResultCode);
    
    await supabase
      .from('transactions')
      .update({
        status: 'failed',
        result_code: ResultCode,
        result_desc: failureReason,
        updated_at: new Date().toISOString()
      })
      .eq('checkout_request_id', CheckoutRequestID);
  }

  // ALWAYS return 200 to Safaricom
  return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function mapResultCode(code: number): string {
  const codes: Record<number, string> = {
    1032: "Request cancelled by user",
    1037: "Request timed out - no response in time",
    1: "Insufficient balance",
    2001: "Wrong M-Pesa PIN entered",
    1039: "Invalid developer/plugin ID",
    2003: "Duplicate transaction reference",
    2026: "Debit account insufficient funds",
    2027: "Credit account does not exist",
  };
  return codes[code] || `Payment failed (code: ${code})`;
}
```

### 5.5 Modified Files

| File | Change |
|------|--------|
| `supabase/functions/mpesa-stk-push/index.ts` | Complete rewrite with encryption, token caching, timezone fix |
| `supabase/functions/mpesa-callback/index.ts` | Add idempotency, ResultCode mapping, defensive parsing |
| `lib/mpesa.ts` | Update to use new edge functions, add encryption helpers |

### 5.6 Files to Archive/Remove

| File | Reason |
|------|--------|
| `supabase/functions/stk_push/index.ts` | Duplicate of mpesa-stk-push |
| `supabase/functions/payment_callback/index.ts` | Duplicate of mpesa-callback |
| `supabase/functions/payments_mpesa_callback/index.ts` | Duplicate of mpesa-callback |

---

## 6. PHASE 3: ADMIN GATEWAY CONFIGURATION UI

**Duration:** Week 2  
**Goal:** Build the multi-tenant payment gateway config modal

### 6.1 New Files

| File | Purpose |
|------|---------|
| `components/GatewayConfigModal.tsx` | Full configuration modal with Till/Paybill toggle, credentials, validation |
| `components/GatewayList.tsx` | List view showing all gateways with status badges |
| `lib/mpesa-admin.ts` | Admin gateway CRUD service with encrypted field handling |

### 6.2 Gateway Config Modal Behavior

**Step 1 - Gateway Type Toggle:**
- Segmented control: "Till Number" vs "Paybill"
- Till selected → show ONLY: Till Number field
- Paybill selected → show: Business Number field + Account Number field
- Switching type clears non-applicable fields

**Step 2 - Credentials (Collapsible):**
- Consumer Key (text, monospace font)
- Consumer Secret (password-masked, show/hide toggle)
- Passkey (password-masked, show/hide toggle, min 20 chars)
- Environment: Sandbox / Production (radio, default Sandbox)
- Persistent yellow banner when Sandbox selected

**Step 3 - Auto-Generated URLs:**
- Callback URL: `https://{domain}/api/mpesa/callback/{client_id}`
- Validation URL: `https://{domain}/api/mpesa/validate/{client_id}`
- Confirmation URL: `https://{domain}/api/mpesa/confirm/{client_id}`
- Copy-to-clipboard button next to each

**Validation Rules:**
- Till number: exactly 5-7 digits
- Paybill business number: exactly 5-7 digits
- Account reference: 1-12 alphanumeric, no spaces
- Consumer key/secret: non-empty, trimmed
- Passkey: non-empty, min 20 chars

**Footer Actions:**
- "Test Connection" - fires sandbox OAuth, shows spinner then checkmark/X
- "Save Configuration" - disabled until test succeeds OR explicit "Save without testing" confirmation
- "Cancel" - discard changes, confirm if dirty

### 6.3 Admin Gateway Service

```typescript
// lib/mpesa-admin.ts

export const GatewayAdminService = {
  async list(clientId: string): Promise<GatewayListItem[]> {
    // Returns gateways with masked secrets
    const { data } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    return data?.map(gw => ({
      ...gw,
      consumer_secret: maskSecret(gw.consumer_secret),
      passkey: maskSecret(gw.passkey),
    })) || [];
  },

  async create(config: GatewayConfig): Promise<Gateway> {
    // Encrypt secrets before storing
    const encrypted = {
      ...config,
      consumer_key: encrypt(config.consumer_key),
      consumer_secret: encrypt(config.consumer_secret),
      passkey: encrypt(config.passkey),
      callback_url: `${SUPABASE_URL}/functions/v1/mpesa-callback/${config.client_id}`,
      confirmation_url: `${SUPABASE_URL}/functions/v1/mpesa-c2b-confirmation/${config.client_id}`,
      validation_url: `${SUPABASE_URL}/functions/v1/mpesa-c2b-validation/${config.client_id}`,
    };

    // Deactivate other gateways for this client if this one is active
    if (encrypted.is_active) {
      await supabase
        .from('payment_gateways')
        .update({ is_active: false })
        .eq('client_id', config.client_id);
    }

    const { data, error } = await supabase
      .from('payment_gateways')
      .insert(encrypted)
      .select()
      .single();

    if (error) throw error;

    // Auto-register C2B URLs for Paybill
    if (config.gateway_type === 'paybill') {
      await supabase.functions.invoke('mpesa-c2b-register', {
        body: { gateway_id: data.id }
      });
    }

    return data;
  },

  async testConnection(gatewayId: string): Promise<TestResult> {
    const { data: gateway } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('id', gatewayId)
      .single();

    const start = Date.now();
    try {
      await supabase.functions.invoke('mpesa-test-connection', {
        body: {
          consumer_key: decrypt(gateway.consumer_key),
          consumer_secret: decrypt(gateway.consumer_secret),
          environment: gateway.environment
        }
      });
      return { success: true, latencyMs: Date.now() - start };
    } catch (error) {
      return { 
        success: false, 
        latencyMs: Date.now() - start,
        error: error.message 
      };
    }
  }
};
```

---

## 7. PHASE 4: CLIENT PAYMENT FLOW

**Duration:** Week 2-3  
**Goal:** Build the production STK push experience in the client app

### 7.1 New Files

| File | Purpose |
|------|---------|
| `lib/phone.ts` | Phone number normalization (07XX, 01XX, +254, 254 → 2547XXXXXXXX) |
| `lib/mpesa-errors.ts` | ResultCode → human-readable error mapping |
| `supabase/functions/mpesa-status/index.ts` | GET endpoint for transaction status |

### 7.2 Phone Normalization

```typescript
// lib/phone.ts

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  
  // Already in correct format
  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }
  
  // Local format: 07XX or 01XX
  if ((digits.startsWith('07') || digits.startsWith('01')) && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }
  
  // Without leading zero: 7XX
  if (digits.startsWith('7') && digits.length === 9) {
    return `254${digits}`;
  }
  
  return null; // Invalid
}

export function formatPhoneDisplay(phone: string): string {
  // 254712345678 → 0712 345 678
  if (phone.length === 12 && phone.startsWith('254')) {
    return `0${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;
  }
  return phone;
}
```

### 7.3 ResultCode Mapping

```typescript
// lib/mpesa-errors.ts

export const MPESA_RESULT_CODES: Record<number, { message: string; customerMessage: string }> = {
  1032: {
    message: "Request cancelled by user",
    customerMessage: "You cancelled the payment"
  },
  1037: {
    message: "Request timed out",
    customerMessage: "Request timed out — you didn't respond in time"
  },
  1: {
    message: "Insufficient balance",
    customerMessage: "Insufficient balance in your M-Pesa account"
  },
  2001: {
    message: "Wrong PIN",
    customerMessage: "Wrong M-Pesa PIN entered"
  },
  1039: {
    message: "Invalid developer/plugin ID",
    customerMessage: "Payment failed — please try again"
  },
  2003: {
    message: "Duplicate transaction reference",
    customerMessage: "Payment failed — please try again"
  },
  2026: {
    message: "Debit account insufficient funds",
    customerMessage: "Insufficient balance in your M-Pesa account"
  },
  2027: {
    message: "Credit account does not exist",
    customerMessage: "Payment failed — please try again"
  },
};

export function getResultMessage(code: number): string {
  return MPESA_RESULT_CODES[code]?.customerMessage || "Payment failed — please try again";
}

export function getInternalResultMessage(code: number): string {
  return MPESA_RESULT_CODES[code]?.message || `Unknown error code: ${code}`;
}
```

### 7.4 Payment Flow States

```
idle → initiating → waiting → success
                      ↓
                   verifying → success
                      ↓
                    failed (with retry)
```

**Key Behaviors:**
1. **Idempotency:** Debounce button, check for existing pending transaction within 2 minutes
2. **Polling:** Every 3-4 seconds, hard timeout at 60-90 seconds
3. **Fallback:** Call `querySTKStatus` once before showing timeout message
4. **Error mapping:** Map ResultCode to human-readable message before displaying

---

## 8. PHASE 5: SMS & WHATSAPP ENGINE

**Duration:** Week 3  
**Goal:** Fix the mocked Africa's Talking integration, consolidate credit systems

### 8.1 Current Problems

| Problem | Location | Fix |
|---------|----------|-----|
| Africa's Talking is mocked | `send_sms` edge function | Implement real API call |
| `send-sms` (hyphenated) doesn't exist | `lib/messaging.ts` | Create the edge function or fix import |
| Dual credit systems | `user_profiles.sms_credits` vs `admin_resources.sms_balance` | Consolidate to `admin_resources.sms_balance` |
| Template syntax mismatch | UI shows `{{double}}`, code uses `{single}` | Standardize to `{single}` |
| Incompatible `send()` call | `messaging.tsx` passes wrong params | Fix parameter interface |
| WhatsApp API version mismatch | `delivery.ts` uses v17.0, `send-whatsapp` uses v18.0 | Standardize to v18.0 |

### 8.2 New Files

| File | Purpose |
|------|---------|
| `supabase/functions/send-sms/index.ts` | Real Africa's Talking integration (hyphenated name) |
| `lib/sms-engine.ts` | Unified SMS engine with template compilation |

### 8.3 Modified Files

| File | Change |
|------|--------|
| `supabase/functions/send_sms/index.ts` | Replace mock with real Africa's Talking API call |
| `services/sms.ts` | Consolidate to use `admin_resources.sms_balance` |
| `lib/messaging.ts` | Fix import to use correct edge function name |
| `app/(admin)/settings/messaging.tsx` | Fix `sendSMS()` parameter interface |
| `app/(admin)/settings/sms-management.tsx` | Consolidate credit system |

### 8.4 SMS Bundle Purchase Flow (with Super Admin Refill)

```
Admin UI → buy_sms edge function → M-Pesa STK Push → sms-bundle-callback → increment_sms_balance RPC
```

**Super Admin Refill:**
```
Master Admin UI → admin_management.tsx → direct DB update to admin_resources.sms_balance
```

---

## 9. PHASE 6: PHOTO UPLOAD PIPELINE

**Duration:** Week 3-4  
**Goal:** Standardize upload flow between Edge Functions and direct uploads

### 9.1 Current Dual Upload Paths

| Path | Used By | Bucket | Access |
|------|---------|--------|--------|
| Edge Functions (5-step) | Server-side | `client-photos` | Signed URLs |
| Direct Upload | Client-side UI | `media` | Public URLs |

### 9.2 Standardization Plan

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Gallery photos | Edge Functions (5-step) | Better validation, signed URLs, audit trail |
| BTS media | Direct upload to `media` | Simpler, public display |
| Announcements | Direct upload to `media` | Simpler, public display |
| Portfolio | Direct upload to `media` | Simpler, public display |

### 9.3 Modified Files

| File | Change |
|------|--------|
| `app/(admin)/bts-announcements.tsx` | Keep direct upload but ensure consistency |
| `supabase/functions/admin_upload_confirm/index.ts` | Expand MIME type validation to match `admin_upload_file` |
| `supabase/functions/admin_upload_finalize/index.ts` | Add notification deduplication |

---

## 10. PHASE 7: BTS & ANNOUNCEMENTS ENGINE

**Duration:** Week 4  
**Goal:** Fix the dual upload paths, standardize notification limits

### 10.1 Current Issues

| Issue | Location | Fix |
|-------|----------|-----|
| Two upload paths (Edge Functions vs direct) | `bts-announcements.tsx` vs Edge Functions | Standardize on direct upload for UI |
| Notification limits differ (50 vs 100 vs ALL) | Edge Functions vs client | Standardize to ALL clients |
| No delete trigger for comments | DB triggers | Add DELETE trigger to decrement count |

### 10.2 Modified Files

| File | Change |
|------|--------|
| `supabase/functions/admin_bts_publish/index.ts` | Remove 50-client limit, notify all |
| `supabase/functions/admin_announcements_publish/index.ts` | Remove 100-client limit, notify all |
| `supabase/migrations/20260705000003_comment_count_triggers.sql` | Add DELETE triggers for comment counts |

---

## 11. PHASE 8: LIKES, COMMENTS & BOOKMARKS

**Duration:** Week 4  
**Goal:** Ensure all engagement tables exist, fix comment count triggers

### 11.1 Missing Tables (to create)

| Table | Purpose |
|-------|---------|
| `bts_bookmarks` | User bookmarks on BTS posts |
| `announcement_bookmarks` | User bookmarks on announcements |
| `portfolio_bookmarks` | User bookmarks on portfolio items |
| `portfolio_comments` | Comments on portfolio items |

### 11.2 Migration

```sql
-- Create missing bookmark tables
CREATE TABLE bts_bookmarks (
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  bts_id UUID REFERENCES bts_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, bts_id)
);

CREATE TABLE announcement_bookmarks (
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

CREATE TABLE portfolio_bookmarks (
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  portfolio_item_id UUID REFERENCES portfolio_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, portfolio_item_id)
);

-- Add DELETE triggers for comment counts
CREATE OR REPLACE FUNCTION decrement_bts_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bts_posts SET comments_count = comments_count - 1 WHERE id = OLD.bts_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_bts_comment_delete
  AFTER DELETE ON bts_comments
  FOR EACH ROW EXECUTE FUNCTION decrement_bts_comment_count();

-- Repeat for announcement_comments and portfolio_comments
```

---

## 12. PHASE 9: SMS REFILL (SUPER ADMIN)

**Duration:** Week 4  
**Goal:** Allow super admin to refill SMS credits for admins

### 12.1 Current Flow

The `admin_management.tsx` screen (super admin only) shows admin accounts but doesn't have SMS refill functionality. SMS credits are managed via:
- `buy_sms` edge function (admin purchases via M-Pesa)
- `increment_sms_balance` RPC (credits added after successful payment)
- Direct `admin_resources` table update (no UI for this)

### 12.2 New Files

| File | Purpose |
|------|---------|
| `supabase/functions/admin-refill-sms/index.ts` | Super admin refill endpoint |
| `components/SMSRefillModal.tsx` | UI for super admin to refill credits |

### 12.3 Super Admin Refill Flow

```typescript
// supabase/functions/admin-refill-sms/index.ts

async function refillSMS(req: Request) {
  // 1. Verify caller is super_admin
  const user = await getUser(req);
  if (user.role !== 'super_admin') throw new Error('Unauthorized');

  // 2. Validate target admin_id and amount
  const { admin_id, amount, reason } = await req.json();
  if (!admin_id || !amount || amount <= 0) throw new Error('Invalid params');

  // 3. Increment SMS balance
  const { data } = await supabase.rpc('increment_sms_balance', {
    p_admin_id: admin_id,
    p_amount: amount
  });

  // 4. Log to audit trail
  await supabase.from('admin_audit_logs').insert({
    admin_id: user.id,
    action: 'sms_refill',
    target_admin_id: admin_id,
    amount,
    reason,
    metadata: { balance_after: data }
  });

  return { success: true, balance_after: data };
}
```

---

## 13. PHASE 10: ADMIN APP UI REDESIGN

**Duration:** Week 5  
**Goal:** Clean up navigation, consolidate settings, create reusable components

### 13.1 Navigation Cleanup

| Current | Problem | Fix |
|---------|---------|-----|
| 5 visible tabs + 8 hidden tabs | Hidden tabs unreachable | Add Drawer/BottomSheet for secondary screens |
| 14 settings sub-screens | Overlapping purposes | Consolidate to 8 screens |

### 13.2 Settings Consolidation

| Before | After |
|--------|-------|
| payments.tsx + simple-mpesa.tsx + mpesa-transactions.tsx + mpesa-inbox.tsx + manual-payments.tsx | payments.tsx (with tabs: Config, History, Inbox, Manual) |
| messaging.tsx + sms-management.tsx | messaging.tsx (with tabs: Compose, Templates, Logs, Analytics) |

### 13.3 Component Library

| Component | Purpose |
|-----------|---------|
| `components/ui/Button.tsx` | Reusable button with variants |
| `components/ui/Input.tsx` | Text input with label, error, icon |
| `components/ui/Modal.tsx` | Reusable modal wrapper |
| `components/ui/Card.tsx` | Content card |
| `components/ui/Badge.tsx` | Status badge |
| `components/ui/Tabs.tsx` | Tab navigation |
| `components/ui/SegmentedControl.tsx` | Toggle between options |
| `components/ui/Skeleton.tsx` | Loading skeleton |
| `components/ui/EmptyState.tsx` | Empty state placeholder |
| `components/ui/ErrorState.tsx` | Error state with retry |

### 13.4 Dead Code Removal

| File | Reason |
|------|--------|
| `services/backend.ts` | All mock implementations, never used |
| `supabase/functions/stk_push/index.ts` | Duplicate of mpesa-stk-push |
| `supabase/functions/payment_callback/index.ts` | Duplicate of mpesa-callback |
| `supabase/functions/payments_mpesa_callback/index.ts` | Duplicate of mpesa-callback |

---

## 14. PHASE 11: SECURITY & ERROR HANDLING

**Duration:** Week 5  
**Goal:** Production-grade security for the financial integration

### 14.1 Security Checklist

| Item | Status | Action |
|------|--------|--------|
| Encryption at rest | MISSING | Implement AES-256-GCM for consumer_secret, passkey |
| Masked GET responses | MISSING | Return `••••` with last 4 chars only |
| Rate limiting on STK push | MISSING | Add per-client rate limit (5/min) |
| Sensitive data logging | MISSING | Filter secrets from all logs |
| Environment validation | MISSING | Validate sandbox/production URL match |
| Timestamp timezone | BUG | Use Africa/Nairobi, format YYYYMMDDHHmmss |
| Transaction type | BUG | CustomerBuyGoodsOnline for Till |

### 14.2 New Files

| File | Purpose |
|------|---------|
| `lib/logger.ts` | Sensitive data filter for all logging |

### 14.3 Rate Limiting

```typescript
// In mpesa-stk-push edge function
const RATE_LIMIT = 5; // Max STK pushes per client per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

const rateLimitKey = `stk_rate_${client_id}`;
const currentCount = await redis.get(rateLimitKey) || 0;

if (currentCount >= RATE_LIMIT) {
  throw new RateLimitError('Too many payment attempts. Please wait a minute.');
}

await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, Math.ceil(RATE_WINDOW / 1000));
```

---

## 15. PHASE 12: TESTING & VERIFICATION

**Duration:** Week 6  
**Goal:** Verify everything works end-to-end

### 14.1 Test Matrix

| Test | Expected Result | Priority |
|------|-----------------|----------|
| Create Till gateway | Saved with encrypted secrets | HIGH |
| Create Paybill gateway | Saved + C2B URLs registered | HIGH |
| Test Connection (valid) | Success with latency | HIGH |
| Test Connection (invalid) | Clear error from Daraja | HIGH |
| STK Push (Till) | Transaction type = CustomerBuyGoodsOnline | HIGH |
| STK Push (Paybill) | Transaction type = CustomerPayBillOnline | HIGH |
| STK Callback (success) | Transaction updated, gallery unlocked | HIGH |
| STK Callback (duplicate) | Idempotent - no double processing | HIGH |
| STK Callback (failure) | Transaction marked failed, error mapped | HIGH |
| SMS Send (real) | Africa's Talking API called, credit deducted | HIGH |
| SMS Bundle Purchase | M-Pesa STK → callback → credits added | HIGH |
| Super Admin Refill | Credits added, audit logged | HIGH |
| BTS Post (direct) | Uploaded to media bucket, notifications sent | MEDIUM |
| Announcement (direct) | Uploaded to media bucket, notifications sent | MEDIUM |
| Like/Unlike | Counter incremented/decremented | MEDIUM |
| Comment + Delete | Counter incremented, decremented on delete | MEDIUM |
| Bookmark | Record created in bookmark table | MEDIUM |
| Phone normalization | 07XX, 01XX, +254, 254 all → 2547XXXXXXXX | MEDIUM |
| Idempotency (double-tap) | Only one STK push fires | HIGH |
| Rate limiting | Excess attempts blocked | HIGH |
| Encryption | Secrets stored encrypted, never returned plaintext | CRITICAL |

---

## 16. FILE CREATION SUMMARY

### New Files by Phase

| Phase | New Files | Modified Files | Archived/Removed |
|-------|-----------|----------------|------------------|
| **Phase 1:** Database & Encryption | 3 | 1 | 0 |
| **Phase 2:** M-Pesa Engine | 10 | 3 | 3 |
| **Phase 3:** Admin Gateway UI | 3 | 0 | 0 |
| **Phase 4:** Client Payment Flow | 3 | 1 | 0 |
| **Phase 5:** SMS & WhatsApp | 2 | 5 | 0 |
| **Phase 6:** Photo Upload | 0 | 3 | 0 |
| **Phase 7:** BTS & Announcements | 0 | 3 | 0 |
| **Phase 8:** Likes/Comments/Bookmarks | 1 | 0 | 0 |
| **Phase 9:** SMS Refill (Super Admin) | 2 | 0 | 0 |
| **Phase 10:** UI Redesign | 10 | 6 | 4 |
| **Phase 11:** Security & Error Handling | 1 | 8 | 0 |
| **Phase 12:** Testing | 0 | 0 | 0 |
| **TOTAL** | **35** | **30** | **7** |

### Complete File List

#### New Files (35)

| # | Phase | File Path | Purpose |
|---|-------|-----------|---------|
| 1 | 1 | `supabase/migrations/20260705000001_payment_gateways.sql` | payment_gateways table |
| 2 | 1 | `supabase/migrations/20260705000002_transactions_table.sql` | Unified transactions table |
| 3 | 1 | `lib/encryption.ts` | AES-256-GCM encrypt/decrypt |
| 4 | 2 | `supabase/functions/mpesa-oauth/index.ts` | OAuth token with caching |
| 5 | 2 | `supabase/functions/mpesa-test-connection/index.ts` | Test credentials |
| 6 | 2 | `supabase/functions/mpesa-stkquery/index.ts` | Query STK status fallback |
| 7 | 2 | `supabase/functions/mpesa-c2b-register/index.ts` | Register C2B URLs |
| 8 | 2 | `supabase/functions/mpesa-c2b-validation/index.ts` | C2B validation |
| 9 | 2 | `supabase/functions/mpesa-c2b-confirmation/index.ts` | C2B confirmation |
| 10 | 2 | `supabase/functions/mpesa-status/index.ts` | GET transaction status |
| 11 | 2 | `lib/mpesa-engine.ts` | Core M-Pesa engine |
| 12 | 2 | `lib/mpesa-errors.ts` | Typed error classes + ResultCode mapping |
| 13 | 3 | `components/GatewayConfigModal.tsx` | Gateway configuration modal |
| 14 | 3 | `components/GatewayList.tsx` | Gateway list view |
| 15 | 3 | `lib/mpesa-admin.ts` | Admin gateway CRUD service |
| 16 | 4 | `lib/phone.ts` | Phone number normalization |
| 17 | 4 | `supabase/functions/mpesa-status/index.ts` | Transaction status endpoint |
| 18 | 5 | `supabase/functions/send-sms/index.ts` | Real Africa's Talking SMS |
| 19 | 5 | `lib/sms-engine.ts` | Unified SMS engine |
| 20 | 8 | `supabase/migrations/20260705000003_bookmarks_and_triggers.sql` | Bookmark tables + comment triggers |
| 21 | 9 | `supabase/functions/admin-refill-sms/index.ts` | Super admin SMS refill |
| 22 | 9 | `components/SMSRefillModal.tsx` | SMS refill UI |
| 23 | 10 | `components/ui/Button.tsx` | Reusable button |
| 24 | 10 | `components/ui/Input.tsx` | Reusable input |
| 25 | 10 | `components/ui/Modal.tsx` | Reusable modal |
| 26 | 10 | `components/ui/Card.tsx` | Reusable card |
| 27 | 10 | `components/ui/Badge.tsx` | Status badge |
| 28 | 10 | `components/ui/Tabs.tsx` | Tab navigation |
| 29 | 10 | `components/ui/SegmentedControl.tsx` | Toggle control |
| 30 | 10 | `components/ui/Skeleton.tsx` | Loading skeleton |
| 31 | 10 | `components/ui/EmptyState.tsx` | Empty state |
| 32 | 10 | `components/ui/ErrorState.tsx` | Error state |
| 33 | 11 | `lib/logger.ts` | Sensitive data filter |

#### Modified Files (30)

| # | Phase | File Path | Change |
|---|-------|-----------|--------|
| 1 | 1 | `types/supabase.ts` | Add payment_gateways + transactions types |
| 2 | 2 | `supabase/functions/mpesa-stk-push/index.ts` | Complete rewrite |
| 3 | 2 | `supabase/functions/mpesa-callback/index.ts` | Add idempotency + error mapping |
| 4 | 2 | `lib/mpesa.ts` | Update to use new edge functions |
| 5 | 4 | `components/PaymentModal.tsx` (user-app) | Add phone normalization, idempotency, error mapping |
| 6 | 5 | `supabase/functions/send_sms/index.ts` | Replace mock with real API |
| 7 | 5 | `services/sms.ts` | Consolidate credit system |
| 8 | 5 | `lib/messaging.ts` | Fix edge function name |
| 9 | 5 | `app/(admin)/settings/messaging.tsx` | Fix sendSMS parameters |
| 10 | 5 | `app/(admin)/settings/sms-management.tsx` | Consolidate credits |
| 11 | 6 | `supabase/functions/admin_upload_confirm/index.ts` | Expand MIME validation |
| 12 | 6 | `supabase/functions/admin_upload_finalize/index.ts` | Add notification dedup |
| 13 | 7 | `supabase/functions/admin_bts_publish/index.ts` | Remove 50-client limit |
| 14 | 7 | `supabase/functions/admin_announcements_publish/index.ts` | Remove 100-client limit |
| 15 | 10 | `app/(admin)/_layout.tsx` | Navigation cleanup |
| 16 | 10 | `app/(admin)/settings/_layout.tsx` | Consolidated settings |
| 17 | 10 | `app/(admin)/settings/index.tsx` | Updated settings hub |
| 18 | 10 | `app/(admin)/settings/payments.tsx` | Integrated GatewayConfigModal |
| 19 | 10 | `app/(admin)/settings/messaging.tsx` | Consolidated messaging |
| 20 | 10 | `app/(admin)/settings/branding.tsx` | Updated to use UI components |
| 21 | 10 | `app/(admin)/settings/delivery.tsx` | Updated to use UI components |
| 22 | 10 | `app/(admin)/settings/package-editor.tsx` | Updated to use UI components |
| 23 | 10 | `app/(admin)/dashboard/index.tsx` | Modular dashboard |
| 24 | 10 | `app/(admin)/clients/index.tsx` | Updated client list |
| 25 | 10 | `app/(admin)/upload/new.tsx` | Multi-step wizard |
| 26 | 11 | `supabase/functions/mpesa-stk-push/index.ts` | Add rate limiting |
| 27 | 11 | `supabase/functions/mpesa-callback/index.ts` | Add timezone validation |
| 28 | 11 | `supabase/functions/mpesa-oauth/index.ts` | Add error handling |
| 29 | 11 | `supabase/functions/mpesa-test-connection/index.ts` | Add latency measurement |
| 30 | 11 | `lib/mpesa-admin.ts` | Add masked GET responses |

#### Files to Archive/Remove (7)

| # | File Path | Reason |
|---|-----------|--------|
| 1 | `supabase/functions/stk_push/index.ts` | Duplicate of mpesa-stk-push |
| 2 | `supabase/functions/payment_callback/index.ts` | Duplicate of mpesa-callback |
| 3 | `supabase/functions/payments_mpesa_callback/index.ts` | Duplicate of mpesa-callback |
| 4 | `services/backend.ts` | All mock implementations |
| 5 | `supabase/functions/send_sms/index.ts` (old) | Replaced by new implementation |
| 6 | `app/(admin)/settings/hub.tsx` | Duplicate of settings/index.tsx |
| 7 | `app/(admin)/settings/simple-mpesa.tsx` | Consolidated into payments.tsx |

---

## APPENDIX A: WEB DASHBOARD SYNC CHECKLIST

The photographer dashboard (web) at `photographer-dashboard/` needs these updates to stay in sync with the mobile app:

| Feature | Web Status | Action Needed |
|---------|------------|---------------|
| M-Pesa Config | Simple inline | Add GatewayConfigModal (port from mobile) |
| SMS Credits | Reads `user_profiles.sms_credits` | Update to read `admin_resources.sms_balance` |
| BTS Upload | Direct to `media` bucket | Keep as-is (standardized in Phase 6) |
| Announcements | Direct to `media` bucket | Keep as-is |
| Support Chat | Has dedicated page | Port to mobile app |
| Kenyan Holidays | Missing file | Copy `lib/kenyan-holidays.ts` into web project |
| BrandingContext | Missing file | Copy `contexts/BrandingContext.tsx` into web project |
| USSD Config | Has settings page | Keep as-is |
| Receipt Settings | Has settings page | Keep as-is |
| Watermark Settings | Has settings page | Keep as-is |

---

## APPENDIX B: EDGE FUNCTION CONSOLIDATION

### Before (6 M-Pesa functions)
```
stk_push → mpesa-stk-push → client_payments_stkpush → buy_sms
payment_callback → mpesa-callback → payments_mpesa_callback → sms-bundle-callback
```

### After (8 focused functions)
```
mpesa-oauth           → Token generation + caching
mpesa-stk-push        → STK Push initiation (replaces stk_push, client_payments_stkpush)
mpesa-callback        → STK callback handler (replaces payment_callback, payments_mpesa_callback)
mpesa-stkquery        → STK status query (new)
mpesa-test-connection → Credential testing (new)
mpesa-c2b-register    → C2B URL registration (new)
mpesa-c2b-validation  → C2B validation (new)
mpesa-c2b-confirmation→ C2B confirmation (new)
mpesa-status          → GET status endpoint (new)
buy_sms               → SMS bundle purchase (kept, uses mpesa-oauth)
sms-bundle-callback   → SMS bundle callback (kept)
```

---

*End of Implementation Plan*
