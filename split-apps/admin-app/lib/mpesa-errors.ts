/**
 * M-Pesa Error Classes and Result Code Mapping
 *
 * Typed errors for Daraja API integration.
 * Every function must validate inputs and handle Daraja errors explicitly.
 * No silent failures - all errors are actionable with Daraja's actual error body.
 */

/**
 * Base error class for all M-Pesa related errors
 */
export class MpesaError extends Error {
  public readonly type: string;
  public readonly darajaError: any;
  public readonly statusCode: number;

  constructor(
    type: string,
    message: string,
    darajaError?: any,
    statusCode: number = 400
  ) {
    super(message);
    this.name = "MpesaError";
    this.type = type;
    this.darajaError = darajaError;
    this.statusCode = statusCode;
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
      daraja_error: this.darajaError,
      status_code: this.statusCode,
    };
  }
}

/**
 * Invalid credentials error - thrown when Daraja rejects consumer_key/secret
 * Attach the raw Daraja error body for debugging
 */
export class InvalidCredentialsError extends MpesaError {
  constructor(message: string, darajaError?: any) {
    super("InvalidCredentialsError", message, darajaError, 401);
    this.name = "InvalidCredentialsError";
  }
}

/**
 * STK Push error - thrown when STK Push request fails
 * Attach the raw Daraja error body for debugging
 */
export class STKPushError extends MpesaError {
  constructor(message: string, darajaError?: any) {
    super("STKPushError", message, darajaError, 400);
    this.name = "STKPushError";
  }
}

/**
 * Rate limit error - thrown when too many STK push attempts
 */
export class RateLimitError extends MpesaError {
  constructor(message: string) {
    super("RateLimitError", message, null, 429);
    this.name = "RateLimitError";
  }
}

/**
 * Transaction not found error
 */
export class TransactionNotFoundError extends MpesaError {
  constructor(message: string) {
    super("TransactionNotFoundError", message, null, 404);
    this.name = "TransactionNotFoundError";
  }
}

/**
 * Configuration error - thrown when gateway config is missing or invalid
 */
export class ConfigurationError extends MpesaError {
  constructor(message: string) {
    super("ConfigurationError", message, null, 500);
    this.name = "ConfigurationError";
  }
}

/**
 * Daraja ResultCode mapping to human-readable messages
 *
 * Common Safaricom STK Push result codes:
 * - 0: Success
 * - 1032: Request cancelled by user (they tapped Cancel on the STK prompt)
 * - 1037: Request timed out (they didn't respond in time)
 * - 1: Insufficient balance
 * - 2001: Wrong PIN entered
 * - 1039: Invalid developer/plugin ID
 * - 2003: Duplicate transaction reference
 * - 2026: Debit account insufficient funds
 * - 2027: Credit account does not exist
 */
export const MPESA_RESULT_CODES: Record<number, { message: string; customerMessage: string }> = {
  0: {
    message: "Success",
    customerMessage: "Payment successful",
  },
  1032: {
    message: "Request cancelled by user",
    customerMessage: "You cancelled the payment",
  },
  1037: {
    message: "Request timed out - no response in time",
    customerMessage: "Request timed out — you didn't respond in time",
  },
  1: {
    message: "Insufficient balance",
    customerMessage: "Insufficient balance in your M-Pesa account",
  },
  2001: {
    message: "Wrong M-Pesa PIN entered",
    customerMessage: "Wrong M-Pesa PIN entered",
  },
  1039: {
    message: "Invalid developer/plugin ID",
    customerMessage: "Payment failed — please try again",
  },
  2003: {
    message: "Duplicate transaction reference",
    customerMessage: "Payment failed — please try again",
  },
  2026: {
    message: "Debit account insufficient funds",
    customerMessage: "Insufficient balance in your M-Pesa account",
  },
  2027: {
    message: "Credit account does not exist",
    customerMessage: "Payment failed — please try again",
  },
  2028: {
    message: "Debit account limit exceeded",
    customerMessage: "Payment failed — limit exceeded",
  },
  2029: {
    message: "Debit account closed",
    customerMessage: "Payment failed — account closed",
  },
  2030: {
    message: "Debit account frozen",
    customerMessage: "Payment failed — account frozen",
  },
  2031: {
    message: "Debit account dormant",
    customerMessage: "Payment failed — account dormant",
  },
};

/**
 * Get customer-facing error message from result code
 * Never expose raw Safaricom codes to customers
 */
export function getResultMessage(code: number): string {
  return MPESA_RESULT_CODES[code]?.customerMessage || "Payment failed — please try again";
}

/**
 * Get internal error message from result code
 * For logging and debugging
 */
export function getInternalResultMessage(code: number): string {
  return MPESA_RESULT_CODES[code]?.message || `Unknown error code: ${code}`;
}

/**
 * Check if a result code indicates a successful transaction
 */
export function isSuccessCode(code: number): boolean {
  return code === 0;
}

/**
 * Check if a result code indicates a pending/in-progress transaction
 */
export function isPendingCode(code: number): boolean {
  // 1032 means the user hasn't responded yet (still showing STK prompt)
  return code === 1032;
}

/**
 * Check if a result code indicates a failed transaction
 */
export function isFailedCode(code: number): boolean {
  return code !== 0 && code !== 1032;
}
