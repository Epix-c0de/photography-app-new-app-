import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '@/lib/supabase';
import { 
  AdminUser, 
  hashPassword, 
  logAdminAudit,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION
} from '@/lib/adminDatabase';

interface AdminAuthState {
  admin: AdminUser | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isLocked: boolean;
  remainingAttempts: number;
  lockoutTime: number | null;
}

interface AdminAuthContextType extends AdminAuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  verifyBiometric: () => Promise<boolean>;
  setupBiometric: () => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  resetLockout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const SESSION_KEY = 'admin_session_token';
const BIOMETRIC_KEY = 'admin_biometric_enabled';
const PIN_KEY = 'admin_pin_hash';
const LOCKOUT_KEY = 'admin_lockout_info';

interface LockoutInfo {
  attempts: number;
  lockedUntil: number | null;
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminAuthState>({
    admin: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    isLocked: false,
    remainingAttempts: MAX_LOGIN_ATTEMPTS,
    lockoutTime: null,
  });

  // Load session and lockout info on mount
  useEffect(() => {
    loadInitialState();
  }, []);

  const loadInitialState = useCallback(async () => {
    try {
      // Load session token
      const sessionToken = await SecureStore.getItemAsync(SESSION_KEY);
      
      // Load lockout info
      const lockoutInfoStr = await SecureStore.getItemAsync(LOCKOUT_KEY);
      const lockoutInfo: LockoutInfo = lockoutInfoStr 
        ? JSON.parse(lockoutInfoStr)
        : { attempts: 0, lockedUntil: null };

      const now = Date.now();
      const isLocked = !!(lockoutInfo.lockedUntil && lockoutInfo.lockedUntil > now);

      setState(prev => ({
        ...prev,
        isLoading: false,
        isLocked,
        remainingAttempts: isLocked ? 0 : MAX_LOGIN_ATTEMPTS - lockoutInfo.attempts,
        lockoutTime: lockoutInfo.lockedUntil,
      }));

      // If session exists, validate it
      if (sessionToken) {
        await validateSession(sessionToken);
      }
    } catch (error) {
      console.error('Failed to load initial state:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const validateSession = useCallback(async (sessionToken: string) => {
    try {
      // Verify session with Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        return;
      }

      // Get admin user data
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (adminError || !adminData) {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        return;
      }

      setState(prev => ({
        ...prev,
        admin: adminData,
        session: session,
        isAuthenticated: true,
      }));

      // Log successful session validation
      await logAdminAudit({
        admin_id: adminData.id,
        action: 'session_validated',
        details: 'Session validated successfully',
        ip_address: '', // Would get from request in real implementation
        user_agent: '',
      });

    } catch (error) {
      console.error('Session validation failed:', error);
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Check lockout status
      const lockoutInfoStr = await SecureStore.getItemAsync(LOCKOUT_KEY);
      const lockoutInfo: LockoutInfo = lockoutInfoStr 
        ? JSON.parse(lockoutInfoStr)
        : { attempts: 0, lockedUntil: null };

      const now = Date.now();
      if (lockoutInfo.lockedUntil && lockoutInfo.lockedUntil > now) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isLocked: true,
          remainingAttempts: 0,
          lockoutTime: lockoutInfo.lockedUntil,
        }));
        throw new Error(`Account locked. Try again in ${Math.ceil((lockoutInfo.lockedUntil - now) / 60000)} minutes.`);
      }

      // Get admin user by email
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (adminError || !adminData) {
        throw new Error('Invalid email or password');
      }

      // Check if account is active
      if (!adminData.is_active) {
        throw new Error('Account is deactivated');
      }

      // Verify password
      const hashedPassword = await hashPassword(password);
      if (adminData.password_hash !== hashedPassword) {
        // Increment failed attempts
        const newAttempts = lockoutInfo.attempts + 1;
        let newLockedUntil: number | null = null;

        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          newLockedUntil = now + LOCKOUT_DURATION;
        }

        const newLockoutInfo: LockoutInfo = {
          attempts: newAttempts,
          lockedUntil: newLockedUntil,
        };

        await SecureStore.setItemAsync(LOCKOUT_KEY, JSON.stringify(newLockoutInfo));

        // Log failed attempt
        await logAdminAudit({
          admin_id: adminData.id,
          action: 'login_failed',
          details: `Failed login attempt ${newAttempts}/${MAX_LOGIN_ATTEMPTS}`,
          ip_address: '',
          user_agent: '',
        });

        setState(prev => ({
          ...prev,
          isLoading: false,
          isLocked: newLockedUntil !== null,
          remainingAttempts: MAX_LOGIN_ATTEMPTS - newAttempts,
          lockoutTime: newLockedUntil,
        }));

        throw new Error(`Invalid email or password. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempts remaining.`);
      }

      // Reset lockout on successful login
      await SecureStore.setItemAsync(LOCKOUT_KEY, JSON.stringify({ attempts: 0, lockedUntil: null }));

      // Create Supabase session
      const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
        email: adminData.email,
        password: password,
      });

      if (authError || !session) {
        throw new Error('Authentication failed');
      }

      // Store session token
      await SecureStore.setItemAsync(SESSION_KEY, session.access_token);

      // Update last login time
      await supabase
        .from('admin_users')
        .update({ 
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', adminData.id);

      // Log successful login
      await logAdminAudit({
        admin_id: adminData.id,
        action: 'login_success',
        details: 'Successful login',
        ip_address: '',
        user_agent: '',
      });

      setState(prev => ({
        ...prev,
        admin: adminData,
        session: session,
        isAuthenticated: true,
        isLoading: false,
        isLocked: false,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
        lockoutTime: null,
      }));

      return true;

    } catch (error: any) {
      console.error('Login error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!state.admin) {
      throw new Error('No admin user found');
    }

    try {
      // Verify current password
      const hashedCurrentPassword = await hashPassword(currentPassword);
      if (state.admin.password_hash !== hashedCurrentPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password in database
      const { error } = await supabase
        .from('admin_users')
        .update({ 
          password_hash: hashedNewPassword,
          force_password_change: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', state.admin.id);

      if (error) {
        throw new Error('Failed to update password');
      }

      // Log password change
      await logAdminAudit({
        admin_id: state.admin.id,
        action: 'password_changed',
        details: 'Password changed successfully',
        ip_address: '',
        user_agent: '',
      });

      // Update local state
      setState(prev => ({
        ...prev,
        admin: {
          ...prev.admin!,
          password_hash: hashedNewPassword,
          force_password_change: false,
        }
      }));

    } catch (error: any) {
      console.error('Password change error:', error);
      throw error;
    }
  }, [state.admin]);

  const logout = useCallback(async () => {
    try {
      if (state.session) {
        await supabase.auth.signOut();
      }

      // Clear secure storage
      await Promise.all([
        SecureStore.deleteItemAsync(SESSION_KEY),
        SecureStore.deleteItemAsync(LOCKOUT_KEY),
      ]);

      // Log logout
      if (state.admin) {
        await logAdminAudit({
          admin_id: state.admin.id,
          action: 'logout',
          details: 'User logged out',
          ip_address: '',
          user_agent: '',
        });
      }

      setState({
        admin: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        isLocked: false,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
        lockoutTime: null,
      });

    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, [state.session, state.admin]);

  const verifyBiometric = useCallback(async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to continue',
        fallbackLabel: 'Use password instead',
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }, []);

  const setupBiometric = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware) {
        throw new Error('Biometric authentication not available on this device');
      }

      if (!isEnrolled) {
        throw new Error('No biometric credentials enrolled on this device');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Set up biometric authentication',
        fallbackLabel: 'Cancel',
      });

      if (result.success) {
        await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true');
        
        if (state.admin) {
          await logAdminAudit({
            admin_id: state.admin.id,
            action: 'biometric_setup',
            details: 'Biometric authentication enabled',
            ip_address: '',
            user_agent: '',
          });
        }
      } else {
        throw new Error('Biometric setup failed');
      }
    } catch (error: any) {
      console.error('Biometric setup error:', error);
      throw error;
    }
  }, [state.admin]);

  const setupPin = useCallback(async (pin: string) => {
    if (!state.admin) {
      throw new Error('No admin user found');
    }

    if (pin.length !== 6) {
      throw new Error('PIN must be 6 digits');
    }

    try {
      const hashedPin = await hashPassword(pin);
      await SecureStore.setItemAsync(PIN_KEY, hashedPin);

      await logAdminAudit({
        admin_id: state.admin.id,
        action: 'pin_setup',
        details: 'PIN authentication enabled',
        ip_address: '',
        user_agent: '',
      });
    } catch (error: any) {
      console.error('PIN setup error:', error);
      throw error;
    }
  }, [state.admin]);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const storedPinHash = await SecureStore.getItemAsync(PIN_KEY);
      if (!storedPinHash) {
        return false;
      }

      const hashedPin = await hashPassword(pin);
      return hashedPin === storedPinHash;
    } catch (error) {
      console.error('PIN verification error:', error);
      return false;
    }
  }, []);

  const resetLockout = useCallback(async () => {
    try {
      await SecureStore.setItemAsync(LOCKOUT_KEY, JSON.stringify({ attempts: 0, lockedUntil: null }));
      setState(prev => ({
        ...prev,
        isLocked: false,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
        lockoutTime: null,
      }));
    } catch (error) {
      console.error('Reset lockout error:', error);
      throw error;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const sessionToken = await SecureStore.getItemAsync(SESSION_KEY);
      if (sessionToken) {
        await validateSession(sessionToken);
      }
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  }, [validateSession]);

  const value: AdminAuthContextType = {
    ...state,
    login,
    logout,
    changePassword,
    verifyBiometric,
    setupBiometric,
    setupPin,
    verifyPin,
    resetLockout,
    refreshSession,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
