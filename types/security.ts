// Task 6.2: TypeScript type definitions for security features
// Requirements: 7.3, 7.4, 8.1, 9.1

/**
 * User security profile from database
 */
export interface SecurityProfile {
  biometric_enabled: boolean;
  pin_hash: string | null;
  password_changed_at: string;
  last_password_change_reminder: string | null;
  '2fa_enabled': boolean;
  '2fa_secret': string | null;
  '2fa_backup_codes': string[] | null;
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Password change input
 */
export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Biometric authentication result
 */
export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometricType?: 'faceId' | 'fingerprint' | 'iris';
}

/**
 * PIN operation result (create, verify, change)
 */
export interface PINOperationResult {
  success: boolean;
  error?: string;
  attemptsRemaining?: number;
}

/**
 * PIN lock state for UI
 */
export interface PINLockState {
  mode: 'CREATE_PIN' | 'CONFIRM_PIN' | 'VERIFY_PIN' | 'CHANGE_PIN';
  pin: string;
  confirmedPin?: string;
  attempts: number;
  maxAttempts: number;
  locked: boolean;
}

/**
 * Session management result
 */
export interface SessionManagementResult {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Security settings update payload
 */
export interface SecuritySettingsUpdate {
  biometric_enabled?: boolean;
  pin_hash?: string | null;
}

/**
 * Audit log entry for security events
 */
export interface SecurityAuditLog {
  id: string;
  admin_id: string;
  action: 'password_changed' | 'biometric_enabled' | 'biometric_disabled' | 'pin_set' | 'pin_removed' | 'session_terminated';
  entity_type: 'user_profile';
  entity_id: string;
  changes: Record<string, any>;
  created_at: string;
}
