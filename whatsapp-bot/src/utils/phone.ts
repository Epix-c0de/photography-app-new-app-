export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('+254')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('254')) {
    // already okay
  } else if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }

  if (!cleaned.startsWith('254') || cleaned.length !== 12) {
    throw new Error(`Invalid Kenyan phone number: ${phone}`);
  }

  return cleaned;
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  const local = normalized.substring(3);
  return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized.substring(0, 7) + '***';
}
