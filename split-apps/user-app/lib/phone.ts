/**
 * Phone Number Utilities
 *
 * Normalizes Kenyan phone numbers to the standard format (2547XXXXXXXX).
 * Accepts multiple input formats and validates before normalization.
 */

/**
 * Normalize a Kenyan phone number to 2547XXXXXXXX format
 *
 * Accepts:
 * - 0712345678 (local format, 10 digits)
 * - 0112345678 (local format, 10 digits)
 * - +254712345678 (international with +, 13 chars)
 * - 254712345678 (international without +, 12 digits)
 * - 712345678 (without leading 0, 9 digits)
 *
 * @param input - Raw phone number input
 * @returns Normalized phone number (2547XXXXXXXX) or null if invalid
 */
export function normalizePhone(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  const digits = input.replace(/\D/g, '');

  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }

  if (
    (digits.startsWith('07') || digits.startsWith('01')) &&
    digits.length === 10
  ) {
    return `254${digits.slice(1)}`;
  }

  if (digits.startsWith('7') && digits.length === 9) {
    return `254${digits}`;
  }

  return null;
}

/**
 * Format a normalized phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';

  if (phone.length === 12 && phone.startsWith('254')) {
    const localNumber = phone.slice(3);
    return `0${localNumber.slice(0, 3)} ${localNumber.slice(3, 6)} ${localNumber.slice(6)}`;
  }

  return phone;
}

/**
 * Validate a Kenyan phone number
 */
export function isValidKenyanPhone(phone: string): boolean {
  return normalizePhone(phone) !== null;
}

/**
 * Mask a phone number for display (privacy)
 */
export function maskPhone(phone: string): string {
  const formatted = formatPhoneDisplay(phone);
  if (formatted.length < 8) return formatted;

  const visibleStart = formatted.slice(0, 4);
  const visibleEnd = formatted.slice(-3);
  const maskedMiddle = '***';

  return `${visibleStart} ${maskedMiddle}${visibleEnd}`;
}
