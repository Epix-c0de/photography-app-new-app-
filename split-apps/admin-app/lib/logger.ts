/**
 * Logger with Sensitive Data Filtering
 *
 * Automatically masks sensitive values before logging.
 * Never logs: consumer_secret, passkey, access_token, full phone numbers, API keys.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('STK Push initiated', { phone, amount });
 *   logger.error('Payment failed', { error, checkoutRequestId });
 */

const SENSITIVE_KEYS = new Set([
  'consumer_secret',
  'consumer_key',
  'passkey',
  'access_token',
  'accessToken',
  'api_key',
  'apiKey',
  'authorization',
  'password',
  'secret',
  'token',
  'mpesa_number',
  'phone_number',
  'phoneNumber',
]);

const MASKED_VALUE = '••••••••';

/**
 * Check if a key name indicates sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  for (const sensitive of SENSITIVE_KEYS) {
    if (lowerKey.includes(sensitive.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Mask a phone number: 254712****678
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return MASKED_VALUE;
  const start = phone.slice(0, 6);
  const end = phone.slice(-3);
  return `${start}****${end}`;
}

/**
 * Deep clone and mask sensitive fields in an object
 */
function maskSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Check if it looks like a phone number (12 digits starting with 254)
    if (/^254\d{9}$/.test(data)) {
      return maskPhone(data);
    }
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }

  if (typeof data === 'object') {
    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        masked[key] = MASKED_VALUE;
      } else if (typeof value === 'string' && /^\d{10,12}$/.test(value)) {
        // Looks like a phone number
        masked[key] = maskPhone(value);
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }

  return data;
}

/**
 * Format log message with timestamp and context
 */
function formatMessage(level: string, message: string, context?: string): string {
  const timestamp = new Date().toISOString();
  const ctx = context ? `[${context}]` : '';
  return `${timestamp} ${level} ${ctx} ${message}`;
}

/**
 * Main logger object
 */
export const logger = {
  /**
   * Log info level message
   */
  info(message: string, data?: Record<string, any>, context?: string): void {
    const masked = data ? maskSensitiveData(data) : undefined;
    console.log(formatMessage('INFO', message, context), masked ? JSON.stringify(masked) : '');
  },

  /**
   * Log warning level message
   */
  warn(message: string, data?: Record<string, any>, context?: string): void {
    const masked = data ? maskSensitiveData(data) : undefined;
    console.warn(formatMessage('WARN', message, context), masked ? JSON.stringify(masked) : '');
  },

  /**
   * Log error level message
   */
  error(message: string, data?: Record<string, any>, context?: string): void {
    const masked = data ? maskSensitiveData(data) : undefined;
    console.error(formatMessage('ERROR', message, context), masked ? JSON.stringify(masked) : '');
  },

  /**
   * Log debug level message (only in development)
   */
  debug(message: string, data?: Record<string, any>, context?: string): void {
    if (Deno.env.get('DENO_ENV') === 'development') {
      const masked = data ? maskSensitiveData(data) : undefined;
      console.log(formatMessage('DEBUG', message, context), masked ? JSON.stringify(masked) : '');
    }
  },

  /**
   * Create a scoped logger for a specific module
   */
  scope(context: string) {
    return {
      info: (message: string, data?: Record<string, any>) => logger.info(message, data, context),
      warn: (message: string, data?: Record<string, any>) => logger.warn(message, data, context),
      error: (message: string, data?: Record<string, any>) => logger.error(message, data, context),
      debug: (message: string, data?: Record<string, any>) => logger.debug(message, data, context),
    };
  },

  /**
   * Mask sensitive data for external use
   */
  mask: maskSensitiveData,
  maskPhone,
};

export default logger;
