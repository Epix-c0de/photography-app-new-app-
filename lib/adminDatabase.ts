import { supabase } from './supabase';
import * as Crypto from 'expo-crypto';

// Admin roles
export type AdminRole = 'super_admin' | 'admin' | 'support_admin';

// Admin user interface
export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  name: string;
  password_hash: string;
  force_password_change: boolean;
  biometric_enabled: boolean;
  pin_hash: string | null;
  pin_enabled: boolean;
  failed_attempts: number;
  account_locked_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Audit log interface
export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  ip_address: string | null;
  device_info: string | null;
  timestamp: string;
  details: any;
}

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION = 15 * 60 * 1000;

// Default admin account setup
export const DEFAULT_ADMIN_ACCOUNT = {
  email: 'admin@yourapp.com',
  password: 'Admin@1234', // Temporary strong password
  role: 'super_admin' as AdminRole,
  name: 'System Administrator',
  force_password_change: true,
  is_active: true
};

// Hash password using SHA256 (compatible with existing Crypto setup)
export const hashPassword = async (password: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
};

// Initialize default admin account
export const initializeDefaultAdmin = async (): Promise<void> => {
  try {
    // Check if default admin already exists
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', DEFAULT_ADMIN_ACCOUNT.email)
      .single();

    if (existingAdmin) {
      console.log('Default admin account already exists');
      return;
    }

    // Hash the default password
    const passwordHash = await hashPassword(DEFAULT_ADMIN_ACCOUNT.password);

    // Create default admin account
    const { error } = await supabase.from('admin_users').insert([{
      email: DEFAULT_ADMIN_ACCOUNT.email,
      password_hash: passwordHash,
      role: DEFAULT_ADMIN_ACCOUNT.role,
      name: DEFAULT_ADMIN_ACCOUNT.name,
      force_password_change: DEFAULT_ADMIN_ACCOUNT.force_password_change,
      is_active: DEFAULT_ADMIN_ACCOUNT.is_active,
      failed_attempts: 0,
      account_locked_until: null,
      biometric_enabled: false,
      pin_enabled: false,
      pin_hash: null
    }]);

    if (error) {
      console.error('Failed to create default admin account:', error);
      throw error;
    }

    console.log('Default admin account created successfully');
    
    // Log the creation in audit log
    await logAdminAction('system', 'default_admin_created', {
      email: DEFAULT_ADMIN_ACCOUNT.email,
      auto_generated: true
    });

  } catch (error) {
    console.error('Error initializing default admin:', error);
  }
};

// Audit logging function
export const logAdminAction = async (
  adminId: string,
  action: string,
  details?: any,
  ipAddress?: string,
  deviceInfo?: string
): Promise<void> => {
  try {
    const { error } = await supabase.from('admin_audit_logs').insert([{
      admin_id: adminId,
      action,
      ip_address: ipAddress,
      device_info: deviceInfo,
      details,
      timestamp: new Date().toISOString()
    }]);

    if (error) {
      console.error('Failed to log admin action:', error);
    }
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
};

export const logAdminAudit = async ({
  admin_id,
  action,
  details,
  ip_address,
  user_agent,
  device_info,
}: {
  admin_id: string;
  action: string;
  details?: any;
  ip_address?: string | null;
  user_agent?: string | null;
  device_info?: string | null;
}): Promise<void> => {
  const deviceInfo = device_info ?? user_agent ?? null;
  await logAdminAction(admin_id, action, details, ip_address ?? undefined, deviceInfo ?? undefined);
};

// Check if account is locked
export const isAccountLocked = (lockedUntil: string | null): boolean => {
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
};

// Get remaining lockout time in minutes
export const getRemainingLockoutTime = (lockedUntil: string | null): number => {
  if (!lockedUntil) return 0;
  const remainingMs = new Date(lockedUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(remainingMs / 60000));
};
