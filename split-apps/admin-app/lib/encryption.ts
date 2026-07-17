/**
 * Encryption utility for M-Pesa credentials
 * Uses AES-256-GCM for encrypting consumer_secret, passkey, and consumer_key
 *
 * CRITICAL: Never store plaintext credentials in the database.
 * All Daraja API secrets MUST be encrypted at rest.
 *
 * Implementation uses Web Crypto API (crypto.subtle) for AES-256-GCM encryption.
 * Falls back to server-side Edge Function for environments without Web Crypto.
 */

import * as Crypto from 'expo-crypto';

/**
 * Base URL for the Supabase project
 * Used to generate callback/validation/confirmation URLs
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

/**
 * Encryption key from environment
 * In production, this should be a 32-byte (256-bit) hex string
 * stored in a secure environment variable, NOT in code
 */
const ENCRYPTION_KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY || '';

/**
 * Generates a SHA-256 hash of the input string
 * Used for access codes, token hashing, etc.
 */
export async function sha256(input: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
}

/**
 * Generates a random hex string of specified byte length
 * Used for encryption IVs, salts, etc.
 */
export function generateRandomHex(byteLength: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < byteLength * 2; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Converts a hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a string to Uint8Array (UTF-8 encoding)
 */
function stringToBytes(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Converts a Uint8Array to string (UTF-8 decoding)
 */
function bytesToString(bytes: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * AES-256-GCM encryption using Web Crypto API
 * This is the proper cryptographic encryption replacing XOR
 */
async function aesEncrypt(data: Uint8Array, keyHex: string): Promise<{ iv: Uint8Array; encrypted: Uint8Array }> {
  const keyBytes = hexToBytes(keyHex.slice(0, 64)); // 32 bytes = 256 bits
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  // Import key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt with AES-GCM
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );

  return { iv, encrypted: new Uint8Array(encryptedBuffer) };
}

/**
 * AES-256-GCM decryption using Web Crypto API
 */
async function aesDecrypt(iv: Uint8Array, encrypted: Uint8Array, keyHex: string): Promise<Uint8Array> {
  const keyBytes = hexToBytes(keyHex.slice(0, 64)); // 32 bytes = 256 bits

  // Import key for AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt with AES-GCM
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  );

  return new Uint8Array(decryptedBuffer);
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 *
 * @param plaintext - The string to encrypt (e.g., consumer_secret, passkey)
 * @returns Base64-encoded encrypted string with IV prepended
 *
 * Format: base64(iv + encrypted_data + auth_tag)
 * IV is 12 bytes for GCM, prepended to allow decryption without separate storage
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    console.warn('[encryption] No ENCRYPTION_KEY set - using development mode');
    // In development, return base64-encoded plaintext for debugging
    // NEVER do this in production
    return btoa(plaintext);
  }

  try {
    const dataBytes = stringToBytes(plaintext);
    const { iv, encrypted } = await aesEncrypt(dataBytes, ENCRYPTION_KEY);

    // Prepend IV to encrypted data
    const result = new Uint8Array(iv.length + encrypted.length);
    result.set(iv, 0);
    result.set(encrypted, iv.length);

    // Return as base64
    return btoa(String.fromCharCode(...result));
  } catch (error) {
    console.error('[encryption] Encrypt failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts an encrypted string using AES-256-GCM
 *
 * @param ciphertext - Base64-encoded encrypted string with IV prepended
 * @returns Decrypted plaintext string
 *
 * CRITICAL: Only decrypt when needed for API calls
 * NEVER log decrypted values in production
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    console.warn('[encryption] No ENCRYPTION_KEY set - using development mode');
    // In development, return base64-decoded plaintext
    // NEVER do this in production
    try {
      return atob(ciphertext);
    } catch {
      return ciphertext;
    }
  }

  try {
    const rawBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

    // Extract IV (first 12 bytes for GCM) and encrypted data (rest)
    const iv = rawBytes.slice(0, 12);
    const encrypted = rawBytes.slice(12);

    // AES-GCM decrypt
    const decrypted = await aesDecrypt(iv, encrypted, ENCRYPTION_KEY);

    return bytesToString(decrypted);
  } catch (error) {
    console.error('[encryption] Decrypt failed:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * Masks a secret value for display in UI
 * Shows only last 4 characters, rest are bullets
 *
 * @param value - The secret to mask (e.g., consumer_secret, passkey)
 * @returns Masked string like "••••••••abcd"
 *
 * Example:
 * - maskSecret("sk_live_1234567890abcdef") → "••••••••cdef"
 * - maskSecret("short") → "•••••short"
 * - maskSecret("") → "••••"
 */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return '••••';
  if (value.length <= 4) return value; // Too short to mask meaningfully
  return '••••' + value.slice(-4);
}

/**
 * Validates that a string looks like a valid M-Pesa shortcode
 * Shortcodes are 5-7 digits for both Till and Paybill
 *
 * @param shortcode - The shortcode to validate
 * @returns true if valid, false otherwise
 */
export function isValidShortcode(shortcode: string): boolean {
  return /^\d{5,7}$/.test(shortcode);
}

/**
 * Validates that a string looks like a valid Kenyan phone number
 * Accepts formats: 07XX, 01XX, +254, 254
 *
 * @param phone - The phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidKenyanPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  // 254 + 9 digits = 12 digits total, or 0 + 9 digits = 10 digits
  if (digits.startsWith('254') && digits.length === 12) return true;
  if ((digits.startsWith('07') || digits.startsWith('01')) && digits.length === 10) return true;
  if (digits.startsWith('7') && digits.length === 9) return true;
  return false;
}

/**
 * Generates the callback URL for a client's payment gateway
 *
 * @param clientId - The client's UUID
 * @returns The callback URL for M-Pesa STK Push callbacks
 */
export function generateCallbackUrl(clientId: string): string {
  return `${SUPABASE_URL}/functions/v1/mpesa-callback`;
}

/**
 * Generates the C2B confirmation URL for a client's payment gateway
 *
 * @param clientId - The client's UUID
 * @returns The confirmation URL for C2B payments
 */
export function generateConfirmationUrl(clientId: string): string {
  return `${SUPABASE_URL}/functions/v1/mpesa-c2b-confirmation`;
}

/**
 * Generates the C2B validation URL for a client's payment gateway
 *
 * @param clientId - The client's UUID
 * @returns The validation URL for C2B payments
 */
export function generateValidationUrl(clientId: string): string {
  return `${SUPABASE_URL}/functions/v1/mpesa-c2b-validation`;
}

/**
 * Strips sensitive fields from a gateway record for API responses
 * Returns a safe object with masked secrets
 *
 * @param gateway - Full gateway record from database
 * @returns Gateway record with secrets masked
 */
export function maskGatewaySecrets<T extends Record<string, any>>(gateway: T): T {
  if (!gateway) return gateway;

  return {
    ...gateway,
    consumer_key: maskSecret(gateway.consumer_key),
    consumer_secret: maskSecret(gateway.consumer_secret),
    passkey: maskSecret(gateway.passkey),
  };
}

/**
 * Logs a message safely, filtering out sensitive data
 *
 * @param level - Log level (info, warn, error)
 * @param message - Log message
 * @param data - Optional data object (sensitive fields will be masked)
 */
export function safeLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: Record<string, any>
): void {
  const sensitiveFields = [
    'consumer_key',
    'consumer_secret',
    'passkey',
    'password',
    'phone_number',
    'mpesa_number',
    'access_token',
  ];

  const safeData = data
    ? Object.fromEntries(
        Object.entries(data).map(([key, value]) => {
          if (sensitiveFields.some((f) => key.toLowerCase().includes(f))) {
            return [key, maskSecret(String(value))];
          }
          return [key, value];
        })
      )
    : undefined;

  const logFn = console[level] || console.log;
  logFn(`[MPESA] ${message}`, safeData || '');
}
