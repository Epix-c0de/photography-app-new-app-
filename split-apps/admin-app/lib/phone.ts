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
 *
 * @example
 * normalizePhone('0712345678') // '254712345678'
 * normalizePhone('+254712345678') // '254712345678'
 * normalizePhone('712345678') // '254712345678'
 * normalizePhone('invalid') // null
 */
export function normalizePhone(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  // Remove all non-digit characters (spaces, dashes, parentheses, +, etc.)
  const digits = input.replace(/\D/g, '');

  // Already in correct format: 254 + 9 digits = 12 digits
  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }

  // Local format: 07XX or 01XX (10 digits)
  if (
    (digits.startsWith('07') || digits.startsWith('01')) &&
    digits.length === 10
  ) {
    return `254${digits.slice(1)}`;
  }

  // Without leading zero: 7XX (9 digits)
  if (digits.startsWith('7') && digits.length === 9) {
    return `254${digits}`;
  }

  // Invalid format
  return null;
}

/**
 * Format a normalized phone number for display
 *
 * @param phone - Normalized phone number (2547XXXXXXXX)
 * @returns Formatted string like "0712 345 678"
 *
 * @example
 * formatPhoneDisplay('254712345678') // '0712 345 678'
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';

  // Handle normalized format (2547XXXXXXXX)
  if (phone.length === 12 && phone.startsWith('254')) {
    const localNumber = phone.slice(3); // Remove 254 prefix
    return `0${localNumber.slice(0, 3)} ${localNumber.slice(3, 6)} ${localNumber.slice(6)}`;
  }

  // Already formatted or unknown format - return as-is
  return phone;
}

/**
 * Validate a Kenyan phone number
 *
 * @param phone - Phone number to validate
 * @returns true if valid Kenyan phone number
 *
 * @example
 * isValidKenyanPhone('0712345678') // true
 * isValidKenyanPhone('254712345678') // true
 * isValidKenyanPhone('12345') // false
 */
export function isValidKenyanPhone(phone: string): boolean {
  return normalizePhone(phone) !== null;
}

/**
 * Mask a phone number for display (privacy)
 *
 * @param phone - Phone number to mask
 * @returns Masked string like "0712 ***678"
 *
 * @example
 * maskPhone('254712345678') // '0712 ***678'
 */
export function maskPhone(phone: string): string {
  const formatted = formatPhoneDisplay(phone);
  if (formatted.length < 8) return formatted;

  const visibleStart = formatted.slice(0, 4);
  const visibleEnd = formatted.slice(-3);
  const maskedMiddle = '***';

  return `${visibleStart} ${maskedMiddle}${visibleEnd}`;
}

/**
 * Get the Safaricom line type (Safaricom, Airtel, Telkom)
 * Based on the phone number prefix
 *
 * @param phone - Normalized phone number
 * @returns Line type string
 */
export function getLineType(phone: string): string {
  const prefix = phone.slice(3, 6); // Get the 3 digits after 254

  // Safaricom prefixes (07XX, 01XX)
  if (['701', '702', '703', '704', '705', '706', '708', '709',
       '710', '711', '712', '713', '714', '715', '716', '717', '718', '719',
       '720', '721', '722', '723', '724', '725', '726', '727', '728', '729',
       '740', '741', '742', '743', '744', '745', '746', '747', '748', '749',
       '757', '758', '759',
       '768', '769',
       '790', '791', '792', '793', '794', '795', '796', '797', '798', '799',
       '110', '111'].includes(prefix)) {
    return 'Safaricom';
  }

  // Airtel prefixes
  if (['730', '731', '732', '733', '734', '735', '736', '737', '738', '739',
       '750', '751', '752', '753', '754', '755', '756'].includes(prefix)) {
    return 'Airtel';
  }

  // Telkom prefixes
  if (['770', '771', '772', '773', '774', '775', '776', '777', '778', '779'].includes(prefix)) {
    return 'Telkom';
  }

  return 'Unknown';
}
