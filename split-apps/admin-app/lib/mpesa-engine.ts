/**
 * M-Pesa Engine - Core utility functions for Daraja API integration
 *
 * This module provides shared utilities for all M-Pesa edge functions.
 * It handles:
 * - Phone number normalization (Kenyan format)
 * - Timestamp generation (Africa/Nairobi timezone)
 * - Password generation for STK Push
 * - Gateway config fetching with decryption
 * - Rate limiting
 */

import { supabase } from "./supabase";
import { decrypt, maskSecret } from "./encryption";

/**
 * Normalize a Kenyan phone number to 2547XXXXXXXX format
 *
 * Accepts:
 * - 0712345678 (local format)
 * - 0112345678 (local format)
 * - +254712345678 (international with +)
 * - 254712345678 (international without +)
 * - 712345678 (without leading 0)
 *
 * Returns null if the number is invalid
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;

  // Remove all non-digit characters
  const digits = input.replace(/\D/g, "");

  // Already in correct format: 254 + 9 digits = 12 digits
  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }

  // Local format: 07XX or 01XX (10 digits)
  if (
    (digits.startsWith("07") || digits.startsWith("01")) &&
    digits.length === 10
  ) {
    return `254${digits.slice(1)}`;
  }

  // Without leading zero: 7XX (9 digits)
  if (digits.startsWith("7") && digits.length === 9) {
    return `254${digits}`;
  }

  // Invalid format
  return null;
}

/**
 * Get timestamp in Africa/Nairobi timezone
 *
 * CRITICAL: Safaricom requires the timestamp in YYYYMMDDHHmmss format
 * in the Africa/Nairobi timezone. Using UTC or any other timezone
 * will silently break STK push with a cryptic 400 error.
 *
 * Format: YYYYMMDDHHmmss (e.g., "20260705143022")
 */
export function getNairobiTimestamp(): string {
  const now = new Date();
  const nairobiTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
  );

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${nairobiTime.getFullYear()}${pad(nairobiTime.getMonth() + 1)}${pad(
    nairobiTime.getDate()
  )}${pad(nairobiTime.getHours())}${pad(nairobiTime.getMinutes())}${pad(
    nairobiTime.getSeconds()
  )}`;
}

/**
 * Generate the password for STK Push
 *
 * Password = Base64(BusinessShortCode + Passkey + Timestamp)
 *
 * CRITICAL: The passkey is the Lipa Na M-Pesa online passkey from Daraja.
 * The timestamp must be the same one used in the STK Push request.
 */
export function generateSTKPassword(
  shortcode: string,
  passkey: string,
  timestamp: string
): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

/**
 * Fetch active gateway config for a client with decrypted secrets
 *
 * CRITICAL: Always decrypt secrets immediately before use.
 * NEVER store decrypted values or log them.
 *
 * @param clientId - The client's UUID
 * @returns Gateway config with decrypted secrets
 * @throws {ConfigurationError} if no active gateway found
 */
export async function getActiveGateway(clientId: string) {
  const { data: gateway, error } = await supabase
    .from("payment_gateways")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !gateway) {
    throw new Error(
      JSON.stringify({
        type: "ConfigurationError",
        message:
          "No active payment gateway found. Please configure M-Pesa in settings.",
      })
    );
  }

  // Decrypt secrets immediately before use
  const decryptedConsumerKey = decrypt(gateway.consumer_key);
  const decryptedConsumerSecret = decrypt(gateway.consumer_secret);
  const decryptedPasskey = decrypt(gateway.passkey);

  return {
    ...gateway,
    // Decrypted values - use immediately, never store or log
    _decrypted: {
      consumer_key: decryptedConsumerKey,
      consumer_secret: decryptedConsumerSecret,
      passkey: decryptedPasskey,
    },
  };
}

/**
 * Get Daraja base URL from environment
 *
 * CRITICAL: Sandbox and production credentials must NEVER be mixed.
 * Always validate that the environment matches the base URL.
 */
export function getDarajaBaseUrl(
  environment: "sandbox" | "production"
): string {
  return environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

/**
 * Check rate limit for STK push initiation per client
 *
 * Prevents abuse/spam prompts to end users.
 * Default: 5 attempts per minute per client.
 *
 * @param clientId - The client's UUID
 * @param maxAttempts - Maximum attempts (default: 5)
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns true if within rate limit, false if exceeded
 */
export async function checkRateLimit(
  clientId: string,
  maxAttempts: number = 5,
  windowMs: number = 60000
): Promise<boolean> {
  // Check recent pending transactions for this client
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "pending")
    .gte("created_at", windowStart);

  if (error) {
    console.error("[rate-limit] Error checking rate limit:", error);
    // On error, allow the request (fail open)
    return true;
  }

  return (count || 0) < maxAttempts;
}

/**
 * Prevent duplicate payments
 *
 * Checks for existing successful or recent pending transactions
 * for the same gallery/amount/phone within the specified window.
 *
 * @param clientId - The client's UUID
 * @param amount - The payment amount
 * @param phone - The phone number
 * @param windowMs - Time window (default: 2 minutes)
 * @returns true if no duplicate found, false if duplicate exists
 */
export async function checkDuplicatePayment(
  clientId: string,
  amount: number,
  phone: string,
  windowMs: number = 120000 // 2 minutes
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  // Check for successful transactions
  const { data: successful } = await supabase
    .from("transactions")
    .select("id")
    .eq("client_id", clientId)
    .eq("phone_number", phone)
    .eq("amount", amount)
    .eq("status", "success")
    .gte("created_at", windowStart)
    .maybeSingle();

  if (successful) {
    return false; // Duplicate found
  }

  // Check for recent pending transactions
  const { data: pending } = await supabase
    .from("transactions")
    .select("id")
    .eq("client_id", clientId)
    .eq("phone_number", phone)
    .eq("amount", amount)
    .eq("status", "pending")
    .gte("created_at", windowStart)
    .maybeSingle();

  if (pending) {
    return false; // Duplicate found
  }

  return true; // No duplicate
}
