# Admin App — Comprehensive Codebase Audit Report

**App:** split-apps/admin-app (Expo Router + React Native + Supabase)
**Date:** July 2026
**Auditor:** opencode (automated)
**Severity Scale:** CRITICAL → HIGH → MEDIUM → LOW → INFO

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Tech Stack Overview](#tech-stack-overview)
3. [Critical Issues](#critical-issues)
4. [High Severity Issues](#high-severity-issues)
5. [Medium Severity Issues](#medium-severity-issues)
6. [Low Severity Issues](#low-severity-issues)
7. [Security Findings](#security-findings)
8. [Proposed File Structure](#proposed-file-structure)
9. [New Files to Create](#new-files-to-create)
10. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

The admin-app is a photographer/admin management mobile application built with Expo SDK 54, React 18, TypeScript, Expo Router, and Supabase. It handles admin authentication, M-Pesa payments, SMS delivery (Africa's Talking), WhatsApp messaging, gallery management, and delivery credits.

**Overall Risk: HIGH** — 4 critical issues, 6 high-severity issues, and multiple medium/low issues were identified. The most dangerous findings are:

- XOR-based "encryption" protecting M-Pesa credentials (trivially reversible)
- Hardcoded default admin credentials reachable in production
- Two separate auth contexts causing unpredictable behavior
- Client-side-only subscription gating that can be bypassed

The app is functional for development/demo but requires significant security hardening before production deployment.

---

## Tech Stack Overview

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54, React 18.3.1, React Native 0.81.5 |
| Routing | Expo Router 6.x (file-based) |
| Language | TypeScript 5.9 |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| State | React useState/useCallback (no React Query, no SWR) |
| Storage | expo-secure-store, AsyncStorage, expo-crypto (SHA-256) |
| Auth | Supabase Auth + expo-local-authentication (biometrics) |
| Payments | M-Pesa (Daraja API via Supabase Edge Functions) |
| SMS | Africa's Talking + expo-sms + local-sms-gateway |
| WhatsApp | WhatsApp Cloud API |
| Notifications | Firebase Cloud Messaging (FCM) |
| Build | EAS Build, Expo Dev Client |

**Key Dependencies (notable):**
- `@tanstack/react-query` ^5.83.0 is in `package.json` but NOT used anywhere in the codebase
- `zustand` ^5.0.2 is in `package.json` but NOT used for state management
- `@shopify/flash-list` used for optimized list rendering
- `expo-screen-capture` for screenshot prevention in sensitive screens

---

## Critical Issues

### CRIT-01: XOR "Encryption" for M-Pesa Credentials

**File:** `lib/encryption.ts:88-107`
**Severity:** CRITICAL

The `encrypt()` and `decrypt()` functions use XOR-based encryption with a repeating key cycle. The code itself contains a comment:

> "IMPORTANT: In production, replace with proper AES-256-GCM implementation"

XOR encryption is trivially reversible: if you know the ciphertext and the key, you XOR again. Even without the key, a known-plaintext attack recovers the key instantly. M-Pesa `consumer_secret` and `passkey` are protected by this.

```typescript
// lib/encryption.ts:101-107
function xorEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}
```

**Impact:** Anyone with access to the device or intercepted traffic can recover M-Pesa API credentials, enabling unauthorized payment initiation, refund fraud, and financial data access.

**Recommendation:** Replace with server-side AES-256-GCM encryption via a Supabase Edge Function. Credentials should never leave the server in plaintext.

---

### CRIT-02: Hardcoded Default Admin Credentials

**File:** `lib/adminDatabase.ts:40-47`
**Severity:** CRITICAL

```typescript
export const DEFAULT_ADMIN_ACCOUNT = {
  email: 'admin@yourapp.com',
  password: 'Admin@1234',
  role: 'super_admin' as AdminRole,
  name: 'System Administrator',
  force_password_change: true,
  is_active: true
};
```

The `initializeDefaultAdmin()` function (line 58) inserts this account into the `admin_users` table if it doesn't exist. While `force_password_change: true` is set, the credentials exist in the bundled JavaScript and can be extracted from the APK/IPA.

Additionally, `AuthContext.tsx:356` has a hardcoded email check for `admin@lexnart.com` with a specific error message, revealing internal configuration.

**Impact:** An attacker who extracts the app bundle gains super_admin credentials. Even with `force_password_change`, the initial login succeeds.

**Recommendation:** Remove hardcoded credentials entirely. Use an environment-based setup script for initial admin provisioning, or require interactive setup on first launch.

---

### CRIT-03: Duplicate Auth Contexts

**Files:** `contexts/AuthContext.tsx` and `contexts/AdminAuthContext.tsx`
**Severity:** CRITICAL

Two separate authentication contexts exist with overlapping but different implementations:

- **AuthContext.tsx** (790 lines): Full auth with `login`, `loginAsAdmin`, `loginWithOtp`, `adminSecurity` state, biometric checks, subscription gating, and onboarding state.
- **AdminAuthContext.tsx** (515 lines): Admin-specific auth with `login`, `logout`, `changePassword`, `verifyBiometric`, `setupBiometric`, `setupPin`, `verifyPin`, and admin audit logging.

Both import from different parts of the codebase. It's unclear which context is used where, leading to:
- Inconsistent auth state across screens
- Potential race conditions if both contexts are mounted
- Duplicate Supabase auth listeners

**Impact:** Unpredictable authentication behavior. Screens may use the wrong context, leading to bypasses or crashes.

**Recommendation:** Merge into a single `AdminAuthProvider` that consolidates all auth logic. Remove `AdminAuthContext.tsx` entirely.

---

### CRIT-04: Package Name Conflict Between Apps

**File:** `package.json:2`
**Severity:** CRITICAL

```json
{
  "name": "epix-visuals-studios-co"
}
```

Both `user-app` and `admin-app` share the same package name. On Android, this means:
- Cannot install both apps on the same device simultaneously
- Builds will conflict in the Play Console
- Deep links may route to the wrong app

**Impact:** Development friction, impossible to test both apps on one device, Play Store submission failures.

**Recommendation:** Rename admin-app to `epix-visuals-admin` or similar distinct identifier.

---

## High Severity Issues

### HIGH-01: No Rate Limiting on Admin Login

**File:** `contexts/AuthContext.tsx:348-385`
**Severity:** HIGH

The `loginAsAdmin` function calls `supabase.auth.signInWithPassword()` directly. While `lib/adminDatabase.ts` exports `MAX_LOGIN_ATTEMPTS = 5` and `LOCKOUT_DURATION = 15 * 60 * 1000` (lines 36-37), these constants are only referenced in `AdminAuthContext.tsx` — NOT in the `AuthContext.tsx` login flow.

The `AuthContext.tsx` `loginAsAdmin` has no lockout mechanism:

```typescript
// AuthContext.tsx:348-362
const loginAsAdmin = useCallback(async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) { throw error; }
  // ... no attempt tracking
});
```

**Impact:** Brute-force attacks against admin accounts are trivially possible.

**Recommendation:** Implement server-side rate limiting via Supabase Edge Functions or a middleware layer. Track failed attempts in the `admin_users` table and lock accounts after 5 failures.

---

### HIGH-02: Biometric Security Settings Stored in JWT

**File:** `contexts/AuthContext.tsx:202`
**Severity:** HIGH

```typescript
supabase.auth.updateUser({ data: { adminSecurity: next } }).catch(console.error);
```

The entire `adminSecurity` state object (biometric settings, remote lock status, registered devices) is stored in `user_metadata`. This means:
- It's included in the JWT token
- It's visible in the Supabase dashboard
- It can be read by any authenticated request
- Client-side tampering is possible before submission

**Impact:** An attacker can modify security settings (disable biometrics, remove device restrictions) by editing the JWT or intercepting the request.

**Recommendation:** Store security settings in a separate `admin_security` table with server-side validation. Never put security-critical state in `user_metadata`.

---

### HIGH-03: Mock Device Registration

**File:** `contexts/AuthContext.tsx:110-117`
**Severity:** HIGH

```typescript
registeredDevices: [
  {
    id: 'current-device',
    label: 'Current device',
    lastUsedLabel: 'Just now',
    status: 'active',
  },
],
```

The `registeredDevices` array is hardcoded to a single mock device. No actual device fingerprinting (device ID, hardware hash, etc.) is implemented. The `id: 'current-device'` is static.

**Impact:** The "device restriction" feature is entirely cosmetic. Any device can authenticate.

**Recommendation:** Implement actual device registration using `expo-device` for device ID, store registered devices server-side, and validate on each login.

---

### HIGH-04: Client-Side Subscription Gating

**File:** `contexts/AuthContext.tsx:617-627`
**Severity:** HIGH

```typescript
if (
  (profile.role === 'admin') &&
  !profile.is_lifetime &&
  (profile.subscription_status === 'inactive' ||
   profile.subscription_status === 'expired' ||
   (profile.subscription_status === 'active' &&
    profile.subscription_expires_at != null &&
    new Date(profile.subscription_expires_at) < new Date()))
) {
  router.replace('/subscription-expired' as any);
}
```

This check runs client-side only. An attacker can:
- Navigate directly to admin routes via deep links
- Intercept and modify the profile response
- Use the Supabase REST API directly

**Impact:** Subscription enforcement is bypassable, allowing unpaid access to premium features.

**Recommendation:** Add server-side RLS policies or Edge Function middleware that checks subscription status before granting access to protected resources.

---

### HIGH-05: SMS Phone Numbers Stored in Plaintext

**File:** `services/sms.ts` (entire file), `services/delivery.ts`
**Severity:** HIGH

Phone numbers are stored in plaintext in `sms_logs` and `delivery_logs` tables. No encryption-at-rest is applied. If the database is compromised, all client phone numbers are exposed.

**Impact:** Mass PII exposure. Violates data protection regulations (GDPR, Kenya's Data Protection Act 2019).

**Recommendation:** Encrypt phone numbers at rest using a server-side encryption function. Consider tokenization for frequently queried numbers.

---

### HIGH-06: Mock Credit Refill Without Payment Verification

**File:** `services/delivery.ts:281-295`
**Severity:** HIGH

```typescript
async refillCredits(amount: number) {
  // Mock Payment Gateway Integration (Stripe/PayPal)
  const { data: current } = await supabase.from('delivery_credits').select('balance, id').single();
  if (!current) return;
  await supabase
    .from('delivery_credits')
    .update({ balance: current.balance + amount })
    .eq('id', current.id);
},
```

This function directly increments the balance without any payment verification. It's called from the UI with user-specified amounts.

**Impact:** Any authenticated admin can give themselves unlimited delivery credits.

**Recommendation:** Implement server-side payment verification via a Supabase Edge Function that confirms payment with the gateway before crediting.

---

## Medium Severity Issues

### MED-01: Polling in Multiple Screens

**Files:** Various
**Severity:** MEDIUM

Multiple screens use `setInterval` for polling:

| Screen | Interval | Purpose |
|--------|----------|---------|
| `app/(admin)/inbox/index.tsx:250` | 15s | Presence ping |
| `app/announcements/[id].tsx:135` | 5s | Comment polling |
| `app/(admin)/bts-announcements.tsx:475` | 60s | Clock update |
| `components/PaymentModal.tsx:258` | varies | Payment status |

The 5-second comment polling and 15-second presence ping are wasteful. Supabase Realtime subscriptions should be used instead.

**Impact:** Excessive network usage, battery drain, increased Supabase connection count.

**Recommendation:** Replace polling with Supabase Realtime subscriptions where possible. Use `expo-background-fetch` for background updates.

---

### MED-02: Misplaced Import in image-utils.ts

**File:** `lib/image-utils.ts:121`
**Severity:** MEDIUM (code quality)

```typescript
// Line 121 (end of file)
import { supabase } from './supabase';
```

The import is at the bottom of the file, after functions that already reference `supabase`. This works due to JavaScript hoisting but is confusing and violates import conventions.

**Impact:** Code maintainability. New developers may not notice the import.

**Recommendation:** Move the import to the top of the file.

---

### MED-03: Over-Engineered SMS Queue System

**File:** `services/sms.ts`
**Severity:** MEDIUM (complexity)

The SMS service implements a full local queue system with:
- AsyncStorage persistence (`QUEUE_KEY = 'sms_queue_v1'`)
- Retry logic with exponential backoff
- Network connectivity checks via `@react-native-community/netinfo`
- 474 lines of queue management code

This is significantly over-engineered for the use case. The `@lenzart/local-sms-gateway` module handles local SMS sending, and Africa's Talking API handles remote SMS.

**Impact:** High maintenance burden, difficult to debug, increased test surface.

**Recommendation:** Simplify to a basic queue with 3 retries and a 30-second timeout. Remove the exponential backoff complexity.

---

### MED-04: No Realtime Subscription Cleanup

**Files:** Multiple screens
**Severity:** MEDIUM

Realtime subscriptions are created in individual screen components without centralized management. While some screens clean up subscriptions in `useEffect` return functions, there's no guarantee all subscriptions are properly removed.

**Impact:** Memory leaks from orphaned subscriptions, especially on navigation-heavy flows.

**Recommendation:** Create a centralized `useAdminRealtime` hook that manages subscription lifecycle.

---

### MED-05: Overly Broad SELECT in checkCredits

**File:** `services/delivery.ts`
**Severity:** MEDIUM (performance)

The `checkCredits` function uses `select('*').single()` when only the `balance` column is needed. This fetches all columns from `delivery_credits` unnecessarily.

**Impact:** Minor performance waste, increased data transfer.

**Recommendation:** Use `select('balance').single()`.

---

### MED-06: Inconsistent Error Handling Across Services

**Files:** Multiple
**Severity:** MEDIUM

Error handling patterns vary across the codebase:
- Some functions throw errors
- Some return `{ error }` objects
- Some silently swallow errors with `try/catch {}`
- Some use `console.error` for error logging

**Impact:** Difficult to maintain consistent error handling, potential for silent failures.

**Recommendation:** Adopt a consistent error handling pattern: always return typed results, never silently swallow errors.

---

## Low Severity Issues

### LOW-01: Mock Till Number Verification

**File:** `lib/mpesa.ts:142-153`
**Severity:** LOW

```typescript
async verifyTillNumber(tillId: string): Promise<boolean> {
  const { error } = await supabase
    .from('photographer_till_numbers')
    .update({
      is_verified: true,
      verified_at: new Date().toISOString(),
    })
    .eq('id', tillId);
  if (error) throw error;
  return true;
},
```

The function just sets `is_verified: true` without calling the Safaricom API. The comment acknowledges this: "simplified - in production would call Safaricom API."

**Impact:** Any till number can be marked as verified, potentially enabling payment fraud.

**Recommendation:** Implement actual Safaricom API verification in production.

---

### LOW-02: Hardcoded Brand Name in WhatsApp Messages

**File:** `lib/messaging.ts:167`
**Severity:** LOW

```typescript
const message = `📸 *${params.gallery_name}*\n\nHi ${params.client_name}! Your photos are ready to view and download.\n\n🔗 View Gallery: ${params.deep_link}\n🔑 Access Code: ${params.access_code}\n\nThank you for choosing Epix Visuals! 📷`;
```

"Epix Visuals" is hardcoded. If the app is rebranded, this must be manually updated across all message templates.

**Impact:** Branding inconsistency if the app is white-labeled or rebranded.

**Recommendation:** Use a `BRAND_NAME` constant from a centralized config file.

---

### LOW-03: Admin Security State Defaults Not Validated

**File:** `contexts/AuthContext.tsx:102-118`
**Severity:** LOW

The initial `adminSecurity` state includes `lastLoginAtLabel: 'Just now'` which is a static string, not a computed value. This is overwritten on login but could confuse users if the login flow is interrupted.

**Impact:** Minor UX inconsistency.

**Recommendation:** Use `null` or compute from actual last login time.

---

## Security Findings

### SEC-01: ENCRYPTION_KEY Exposed in Client Bundle

**File:** `lib/encryption.ts:25`
**Severity:** HIGH (for mobile apps)

```typescript
const ENCRYPTION_KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY || '';
```

`EXPO_PUBLIC_*` environment variables are embedded in the JavaScript bundle. While this is expected for mobile apps (the bundle is distributed to users), the encryption key is extractable via reverse engineering.

**Impact:** The encryption key can be extracted from the APK/IPA, rendering XOR encryption useless.

**Recommendation:** Move encryption to server-side Edge Functions. The client should never hold the encryption key.

---

### SEC-02: Default Admin Account Exported

**File:** `lib/adminDatabase.ts:40-47`
**Severity:** HIGH

`DEFAULT_ADMIN_ACCOUNT` is exported and the `getDefaultAdminAccount()` function is available. While it's intended for development, it's bundled in production builds.

**Impact:** Attackers can discover default credentials from the JavaScript bundle.

**Recommendation:** Guard behind `__DEV__` checks or remove entirely from production builds.

---

### SEC-03: SHA-256 Without Salt for Password Hashing

**File:** `lib/adminDatabase.ts:50-55`
**Severity:** MEDIUM

```typescript
export const hashPassword = async (password: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
};
```

SHA-256 without a salt is vulnerable to rainbow table attacks. While this is used for the admin_users table (not Supabase Auth), it's still a concern.

**Impact:** If the `admin_users` table is compromised, password hashes can be cracked quickly.

**Recommendation:** Use bcrypt or Argon2 with proper salting. For React Native, consider a server-side hash function via Edge Function.

---

### SEC-04: Supabase Anon Key Hardcoded as Fallback

**File:** `lib/supabase.ts:8`
**Severity:** INFO (expected for mobile)

```typescript
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGci...';
```

The anon key is hardcoded as a fallback. This is standard for Supabase mobile apps, but the key should be rotated periodically.

---

## Proposed File Structure

New files to address the issues identified in this audit:

```
split-apps/admin-app/
├── lib/
│   ├── crypto.ts                    # NEW: AES-256-GCM via Edge Function
│   ├── device-fingerprint.ts        # NEW: Actual device registration
│   └── supabase.ts                  # MODIFY: Remove hardcoded anon key fallback
├── hooks/
│   └── useAdminRealtime.ts          # NEW: Centralized realtime management
├── contexts/
│   ├── AuthContext.tsx               # MODIFY: Merge with AdminAuthContext
│   └── AdminAuthContext.tsx          # DELETE: Consolidated into AuthContext
├── components/
│   └── admin/
│       └── SubscriptionGate.tsx      # NEW: Server-side subscription validation
├── services/
│   ├── payment-verification.ts      # NEW: Real payment gateway integration
│   ├── sms.ts                       # MODIFY: Simplify queue system
│   └── delivery.ts                  # MODIFY: Remove mock refillCredits
└── supabase/
    └── functions/
        ├── encrypt-credentials/     # NEW: Server-side AES encryption
        ├── verify-subscription/     # NEW: Server-side subscription check
        └── verify-payment/          # NEW: Payment verification
```

---

## New Files to Create

### 1. `lib/crypto.ts` — Server-Side Encryption

Replaces the XOR encryption with a Supabase Edge Function call that uses AES-256-GCM.

```typescript
// Pseudocode structure
export async function encryptCredential(plaintext: string): Promise<string> {
  const { data } = await supabase.functions.invoke('encrypt-credentials', {
    body: { action: 'encrypt', data: plaintext }
  });
  return data.encrypted;
}

export async function decryptCredential(encrypted: string): Promise<string> {
  const { data } = await supabase.functions.invoke('encrypt-credentials', {
    body: { action: 'decrypt', data: encrypted }
  });
  return data.plaintext;
}
```

### 2. `hooks/useAdminRealtime.ts` — Centralized Realtime

```typescript
// Pseudocode structure
export function useAdminRealtime(subscriptions: RealtimeConfig[]) {
  useEffect(() => {
    const channels = subscriptions.map(config =>
      supabase.channel(config.name).on(config.event, config.handler).subscribe()
    );
    return () => channels.forEach(ch => supabase.removeChannel(ch));
  }, []);
}
```

### 3. `components/admin/SubscriptionGate.tsx` — Server-Side Validation

Wraps protected screens and validates subscription status via a server-side Edge Function before rendering.

### 4. `lib/device-fingerprint.ts` — Device Registration

```typescript
// Pseudocode structure
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';

export async function getDeviceFingerprint(): Promise<string> {
  const deviceId = Device.osInternalBuildId ?? Device.deviceName;
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, deviceId);
}
```

### 5. `services/payment-verification.ts` — Real Payment Integration

Replaces the mock `refillCredits` with a server-side function that:
1. Verifies payment with M-Pesa/Daraja API
2. Confirms receipt number and amount
3. Only then credits the delivery balance

---

## Implementation Roadmap

### Phase 1: Critical Fixes (1-2 weeks)

| Task | Files | Effort |
|------|-------|--------|
| Replace XOR encryption with server-side AES-256-GCM | `lib/encryption.ts`, `lib/crypto.ts`, Supabase Edge Function | High |
| Remove hardcoded admin credentials | `lib/adminDatabase.ts`, env config | Low |
| Merge AuthContext and AdminAuthContext | `contexts/AuthContext.tsx`, `contexts/AdminAuthContext.tsx` | High |
| Rename admin-app package | `package.json`, `app.config.js` | Low |

### Phase 2: High Severity Fixes (2-3 weeks)

| Task | Files | Effort |
|------|-------|--------|
| Add server-side login rate limiting | Supabase Edge Function, `contexts/AuthContext.tsx` | Medium |
| Move adminSecurity to server-side table | Supabase migration, `contexts/AuthContext.tsx` | High |
| Implement real device fingerprinting | `lib/device-fingerprint.ts`, `contexts/AuthContext.tsx` | Medium |
| Add server-side subscription validation | `components/admin/SubscriptionGate.tsx`, Edge Function | Medium |
| Encrypt phone numbers at rest | Supabase migration, `services/sms.ts` | Medium |
| Replace mock refillCredits with payment verification | `services/delivery.ts`, `services/payment-verification.ts` | High |

### Phase 3: Medium Severity Fixes (1-2 weeks)

| Task | Files | Effort |
|------|-------|--------|
| Replace polling with Realtime subscriptions | Multiple screens, `hooks/useAdminRealtime.ts` | Medium |
| Move import to top of `image-utils.ts` | `lib/image-utils.ts` | Low |
| Simplify SMS queue system | `services/sms.ts` | Medium |
| Centralize realtime subscription cleanup | `hooks/useAdminRealtime.ts` | Medium |
| Optimize SELECT in checkCredits | `services/delivery.ts` | Low |
| Standardize error handling | Multiple files | Medium |

### Phase 4: Low Severity & Polish (1 week)

| Task | Files | Effort |
|------|-------|--------|
| Implement real till number verification | `lib/mpesa.ts` | Medium |
| Replace hardcoded brand name | `lib/messaging.ts`, config | Low |
| Use proper password hashing (bcrypt) | `lib/adminDatabase.ts`, Edge Function | Medium |
| Add comprehensive tests | `__tests__/` | Medium |

---

## Summary Statistics

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 6 |
| MEDIUM | 6 |
| LOW | 3 |
| SECURITY | 4 |
| **Total** | **23** |

**Estimated total remediation effort:** 6-8 weeks for a single developer, 3-4 weeks with two developers working in parallel.

The most urgent items are the XOR encryption replacement (CRIT-01) and the hardcoded credentials removal (CRIT-02), as these represent immediate financial and access risks.
