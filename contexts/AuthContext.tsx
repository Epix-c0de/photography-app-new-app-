import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { ClientService } from '@/services/client';

interface UserProfile {
  id: string;
  role: 'admin' | 'client' | 'super_admin';
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  pin_hash: string | null;
  biometric_enabled: boolean | null;
  client_type: string | null;
  profile_complete: boolean;
  created_at: string;
}

interface AuthState {
  user: any | null;
  profile: UserProfile | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  requiresSecuritySetup: boolean;
  requiresAuthOnLaunch: boolean;
  pinAttempts: number;
  pinLockedUntil: Date | null;
}

interface AdminSecurityDevice {
  id: string;
  label: string;
  lastUsedLabel: string;
  status: 'active' | 'revoked';
}

interface AdminSecurityState {
  lastLoginAtLabel: string;
  biometricEnabled: boolean;
  requireBiometricForDashboard: boolean;
  requireBiometricForUpload: boolean;
  requireBiometricForMpesa: boolean;
  requireBiometricForSmsBundles: boolean;
  remoteLockEnabled: boolean;
  registeredDevices: AdminSecurityDevice[];
}

type AdminGuardAction = 'open_dashboard' | 'upload_galleries' | 'buy_sms_bundles' | 'mpesa_payment';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginAsAdmin: (email: string, password: string) => Promise<void>;
  loginWithOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  authenticateWithBiometrics: () => Promise<boolean>;
  checkAuthOnLaunch: () => Promise<void>;
  clearPinLock: () => void;
  completeOnboarding: () => Promise<void>;
  getGreeting: () => string;
  adminSecurity: AdminSecurityState;
  updateAdminSecurity: (updates: Partial<AdminSecurityState>) => void;
  verifyAdminGuard: (action: AdminGuardAction) => Promise<boolean>;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Secure storage keys
const PIN_ATTEMPTS_KEY = 'pin_attempts';
const PIN_LOCKED_UNTIL_KEY = 'pin_locked_until';
const ONBOARDING_KEY = 'has_seen_onboarding';

// PIN lockout configuration
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    hasSeenOnboarding: false,
    requiresSecuritySetup: false,
    requiresAuthOnLaunch: false,
    pinAttempts: 0,
    pinLockedUntil: null,
  });
  const [adminSecurity, setAdminSecurity] = useState<AdminSecurityState>({
    lastLoginAtLabel: 'Just now',
    biometricEnabled: false,
    requireBiometricForDashboard: false,
    requireBiometricForUpload: false,
    requireBiometricForMpesa: false,
    requireBiometricForSmsBundles: false,
    remoteLockEnabled: false,
    registeredDevices: [
      {
        id: 'current-device',
        label: 'Current device',
        lastUsedLabel: 'Just now',
        status: 'active',
      },
    ],
  });
  const ADMIN_SECURITY_KEY = 'admin_security_state';

  const router = useRouter();

  const loadOnboardingState = useCallback(async () => {
    try {
      const value = await SecureStore.getItemAsync(ONBOARDING_KEY);
      setState(prev => ({ ...prev, hasSeenOnboarding: value === 'true' }));
    } catch (error) {
      console.error('Failed to load onboarding state:', error);
    }
  }, []);

  // Load PIN lock state from secure storage
  const loadPinLockState = useCallback(async () => {
    try {
      const attempts = await SecureStore.getItemAsync(PIN_ATTEMPTS_KEY);
      const lockedUntil = await SecureStore.getItemAsync(PIN_LOCKED_UNTIL_KEY);

      setState(prev => ({
        ...prev,
        pinAttempts: attempts ? parseInt(attempts) : 0,
        pinLockedUntil: lockedUntil ? new Date(lockedUntil) : null,
      }));
    } catch (error) {
      console.error('Failed to load PIN lock state:', error);
    }
  }, []);

  // Save PIN lock state to secure storage
  const savePinLockState = useCallback(async (attempts: number, lockedUntil: Date | null) => {
    try {
      await SecureStore.setItemAsync(PIN_ATTEMPTS_KEY, attempts.toString());
      if (lockedUntil) {
        await SecureStore.setItemAsync(PIN_LOCKED_UNTIL_KEY, lockedUntil.toISOString());
      } else {
        await SecureStore.deleteItemAsync(PIN_LOCKED_UNTIL_KEY);
      }
    } catch (error) {
      console.error('Failed to save PIN lock state:', error);
    }
  }, []);

  // Check if PIN is currently locked
  const isPinLocked = useCallback(() => {
    if (state.pinLockedUntil && new Date() < state.pinLockedUntil) {
      return true;
    }
    return false;
  }, [state.pinLockedUntil]);

  // Clear PIN lock
  const clearPinLock = useCallback(async () => {
    setState(prev => ({
      ...prev,
      pinAttempts: 0,
      pinLockedUntil: null,
    }));
    await savePinLockState(0, null);
  }, [savePinLockState]);

  const completeOnboarding = useCallback(async () => {
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
      setState(prev => ({ ...prev, hasSeenOnboarding: true }));
    } catch (error) {
      console.error('Failed to persist onboarding state:', error);
    }
  }, []);

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const updateAdminSecurity = useCallback((updates: Partial<AdminSecurityState>) => {
    setAdminSecurity((prev) => {
      const next = { ...prev, ...updates };
      SecureStore.setItemAsync(ADMIN_SECURITY_KEY, JSON.stringify(next)).catch(() => {});
      
      // Sync seamlessly to backend user_metadata in real time
      supabase.auth.updateUser({ data: { adminSecurity: next } }).catch(console.error);

      // If biometricEnabled toggled, also persist to user_profiles table directly
      if (updates.biometricEnabled !== undefined && state.user?.id) {
        supabase.from('user_profiles')
          .update({ biometric_enabled: updates.biometricEnabled })
          .eq('id', state.user.id)
          .then(({ error }) => { if (error) console.error('Failed to sync biometric state:', error); });
      }

      return next;
    });
  }, [state.user?.id]);

  const verifyAdminGuard = useCallback(async (action: AdminGuardAction): Promise<boolean> => {
    if (adminSecurity.remoteLockEnabled) return false;

    const requiresBiometric =
      adminSecurity.biometricEnabled &&
      ((action === 'open_dashboard' && adminSecurity.requireBiometricForDashboard) ||
        (action === 'upload_galleries' && adminSecurity.requireBiometricForUpload) ||
        (action === 'buy_sms_bundles' && adminSecurity.requireBiometricForSmsBundles) ||
        (action === 'mpesa_payment' && adminSecurity.requireBiometricForMpesa));

    if (!requiresBiometric) return true;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify to continue',
      });
      return result.success;
    } catch (error) {
      console.error('Admin guard verification error:', error);
      return false;
    }
  }, [adminSecurity]);

  // Increment PIN attempts and handle lockout
  const incrementPinAttempts = useCallback(async () => {
    const newAttempts = state.pinAttempts + 1;
    let newLockedUntil: Date | null = null;

    if (newAttempts >= MAX_PIN_ATTEMPTS) {
      newLockedUntil = new Date(Date.now() + PIN_LOCKOUT_DURATION);
    }

    setState(prev => ({
      ...prev,
      pinAttempts: newAttempts,
      pinLockedUntil: newLockedUntil,
    }));

    await savePinLockState(newAttempts, newLockedUntil);
  }, [state.pinAttempts, savePinLockState]);

  // Verify PIN against stored hash
  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!state.profile?.pin_hash) return false;
    if (isPinLocked()) return false;

    try {
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin
      );

      const isValid = digest === state.profile.pin_hash;

      if (!isValid) {
        await incrementPinAttempts();
        return false;
      }

      // Clear lock on successful verification
      await clearPinLock();
      return true;
    } catch (error) {
      console.error('PIN verification error:', error);
      return false;
    }
  }, [state.profile?.pin_hash, isPinLocked, incrementPinAttempts, clearPinLock]);

  // Authenticate with biometrics
  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!state.profile?.biometric_enabled) return false;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your account',
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }, [state.profile?.biometric_enabled]);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    setState(prev => ({
      ...prev,
      user: data.user,
      session: data.session,
      isAuthenticated: true,
    }));

    // Load user profile after login
    if (data.user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        const isAdminProfile = profile.role === 'admin' || profile.role === 'super_admin';
        const hasSecurity = profile.pin_hash !== null || profile.biometric_enabled === true;
        
        let requiresSecuritySetup = false;
        if (!isAdminProfile && !hasSecurity && !profile.profile_complete) {
          const lastPrompt = await SecureStore.getItemAsync('last_security_prompt');
          const now = Date.now();
          if (!lastPrompt || now - parseInt(lastPrompt) > 24 * 60 * 60 * 1000) {
            requiresSecuritySetup = true;
            await SecureStore.setItemAsync('last_security_prompt', now.toString());
          }
        }

        setState(prev => ({
          ...prev,
          profile,
          requiresSecuritySetup,
          requiresAuthOnLaunch: isAdminProfile ? false : hasSecurity,
        }));
      }
    }
  }, []);

  const loginAsAdmin = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (normalizedEmail === 'admin@lexnart.com' && error.message.includes('Invalid login credentials')) {
        throw new Error(
          'Default admin user not found or password not set in Supabase. Create it in Supabase Auth first, then try again.'
        );
      }
      throw error;
    }

    const authRole =
      (data.user?.app_metadata as any)?.role ??
      (data.user?.user_metadata as any)?.role;
    const isAdminByAuth = authRole === 'admin' || authRole === 'super_admin';

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const isAdminByProfile = profile?.role === 'admin' || profile?.role === 'super_admin';
    if (!isAdminByProfile && !isAdminByAuth) {
      await supabase.auth.signOut();
      if (normalizedEmail === 'admin@lexnart.com') {
        if (profileError) {
          throw new Error('Admin role check failed. Ensure user_profiles is readable and role is admin for this user.');
        }
        throw new Error('Admin role is not set. Set user_profiles.role = admin for this user.');
      }
      throw new Error('Unauthorized: Admin access only');
    }

    const resolvedProfile: UserProfile = profile ?? {
      id: data.user.id,
      role: 'admin',
      name: null,
      email: data.user.email ?? normalizedEmail,
      phone: null,
      avatar_url: null,
      pin_hash: null,
      biometric_enabled: null,
      client_type: null,
      profile_complete: true,
      created_at: new Date().toISOString(),
    };

    const hasSecurity = resolvedProfile.pin_hash !== null || resolvedProfile.biometric_enabled === true;
    let requiresSecuritySetup = false;
    if (!hasSecurity && !resolvedProfile.profile_complete) {
      const lastPrompt = await SecureStore.getItemAsync('last_security_prompt');
      const now = Date.now();
      if (!lastPrompt || now - parseInt(lastPrompt) > 24 * 60 * 60 * 1000) {
        requiresSecuritySetup = true;
        await SecureStore.setItemAsync('last_security_prompt', now.toString());
      }
    }

    setState(prev => ({
      ...prev,
      user: data.user,
      session: data.session,
      profile: resolvedProfile,
      isAuthenticated: true,
      requiresSecuritySetup: false, // Admin never requires security setup via this flow
      requiresAuthOnLaunch: false,
    }));
  }, []);

  const loginWithOtp = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false }, // Only existing users
    });
    if (error) {
      if (normalizedEmail === 'admin@lexnart.com') {
        throw new Error('Default admin user must exist in Supabase before OTP login can work.');
      }
      throw error;
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: 'email',
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user data returned');

    const authRole =
      (data.user?.app_metadata as any)?.role ??
      (data.user?.user_metadata as any)?.role;
    const isAdminByAuth = authRole === 'admin' || authRole === 'super_admin';

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const isAdminByProfile = profile?.role === 'admin' || profile?.role === 'super_admin';
    if (!isAdminByProfile && !isAdminByAuth) {
      await supabase.auth.signOut();
      if (normalizedEmail === 'admin@lexnart.com') {
        if (profileError) {
          throw new Error('Admin role check failed. Ensure user_profiles is readable and role is admin for this user.');
        }
        throw new Error('Admin role is not set. Set user_profiles.role = admin for this user.');
      }
      throw new Error('Unauthorized: Admin access only');
    }

    const resolvedProfile: UserProfile = profile ?? {
      id: data.user.id,
      role: 'admin',
      name: null,
      email: data.user.email ?? normalizedEmail,
      phone: null,
      avatar_url: null,
      pin_hash: null,
      biometric_enabled: null,
      client_type: null,
      profile_complete: true,
      created_at: new Date().toISOString(),
    };

    const hasSecurity = resolvedProfile.pin_hash !== null || resolvedProfile.biometric_enabled === true;
    let requiresSecuritySetup = false;
    if (!hasSecurity && !resolvedProfile.profile_complete) {
      const lastPrompt = await SecureStore.getItemAsync('last_security_prompt');
      const now = Date.now();
      if (!lastPrompt || now - parseInt(lastPrompt) > 24 * 60 * 60 * 1000) {
        requiresSecuritySetup = true;
        await SecureStore.setItemAsync('last_security_prompt', now.toString());
      }
    }

    setState(prev => ({
      ...prev,
      user: data.user,
      session: data.session,
      profile: resolvedProfile,
      isAuthenticated: true,
      requiresSecuritySetup: false, // Admin never requires security setup from verifyOtp
      requiresAuthOnLaunch: false,
    }));
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setState(prev => ({
      ...prev,
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      requiresSecuritySetup: false,
      requiresAuthOnLaunch: false,
      pinAttempts: 0,
      pinLockedUntil: null,
    }));
    await clearPinLock();
  }, [clearPinLock]);

  const syncTemporaryUploads = useCallback(async () => {
    try {
      await ClientService.tempUploads.syncForCurrentUser();
    } catch (error) {
      console.warn('Temporary upload sync failed:', error);
    }
  }, []);

  // Check authentication status on app launch
  const checkAuthOnLaunch = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Prefer cloud-synced adminSecurity over local raw JSON if available
        let backendAdminSecurity = null;
        if (session?.user?.user_metadata?.adminSecurity) {
          backendAdminSecurity = session.user.user_metadata.adminSecurity;
        }

        const raw = await SecureStore.getItemAsync(ADMIN_SECURITY_KEY);
        if (backendAdminSecurity) {
          setAdminSecurity((prev) => ({ ...prev, ...backendAdminSecurity }));
        } else if (raw) {
          const parsed = JSON.parse(raw);
          setAdminSecurity((prev) => ({ ...prev, ...parsed }));
        }
      } catch {}
      await loadOnboardingState();
      // Load PIN lock state first
      await loadPinLockState();

      // Check current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      if (!session) {
        setState(prev => ({ ...prev, isLoading: false, isAuthenticated: false }));
        return;
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      const authRole = (session.user?.app_metadata as any)?.role;
      const isAdminByAuth = authRole === 'admin' || authRole === 'super_admin';

      if (profile) {
        const isAdminProfile = profile.role === 'admin' || profile.role === 'super_admin';
        const hasSecurity = profile.pin_hash !== null || profile.biometric_enabled === true;
        
        let requiresSecuritySetup = false;
        if (!isAdminProfile && !hasSecurity && !profile.profile_complete) {
          const lastPrompt = await SecureStore.getItemAsync('last_security_prompt');
          const now = Date.now();
          if (!lastPrompt || now - parseInt(lastPrompt) > 24 * 60 * 60 * 1000) {
            requiresSecuritySetup = true;
            await SecureStore.setItemAsync('last_security_prompt', now.toString());
          }
        }
        
        const requiresAuthOnLaunch = isAdminProfile ? false : hasSecurity;

        setState(prev => ({
          ...prev,
          user: session.user,
          profile,
          session,
          isAuthenticated: true,
          requiresSecuritySetup,
          requiresAuthOnLaunch,
          isLoading: false,
        }));

        // Redirect based on security requirements
        if (requiresSecuritySetup) {
          router.replace('/security-setup' as any);
        } else if (requiresAuthOnLaunch) {
          router.replace('/auth-required' as any);
        }
        if (profile.role === 'client') {
          try {
            await ClientService.clients.ensureLinkedRecordsForCurrentUser();
          } catch {}
        }
      } else if (isAdminByAuth) {
        const resolvedProfile: UserProfile = {
          id: session.user.id,
          role: 'admin',
          name: null,
          email: session.user.email ?? null,
          phone: null,
        avatar_url: null,
          pin_hash: null,
          biometric_enabled: null,
          client_type: null,
          profile_complete: true,
          created_at: new Date().toISOString(),
        };

        setState(prev => ({
          ...prev,
          user: session.user,
          profile: resolvedProfile,
          session,
          isAuthenticated: true,
          requiresSecuritySetup: false,
          requiresAuthOnLaunch: false,
          isLoading: false,
        }));
      } else {
        if (profileError) {
          console.error('Profile fetch failed:', profileError);
        }
        const fallbackProfile: UserProfile = {
          id: session.user.id,
          role: 'client',
          name:
            (session.user?.user_metadata as any)?.full_name ??
            (session.user?.user_metadata as any)?.name ??
            session.user.email ??
            null,
          email: session.user.email ?? null,
          phone: (session.user?.user_metadata as any)?.phone ?? null,
          avatar_url: (session.user?.user_metadata as any)?.avatar_url ?? null,
          pin_hash: null,
          biometric_enabled: null,
          client_type: null,
          profile_complete: false,
          created_at: new Date().toISOString(),
        };
        setState(prev => ({
          ...prev,
          user: session.user,
          profile: fallbackProfile,
          session,
          isAuthenticated: true,
          requiresSecuritySetup: false,
          requiresAuthOnLaunch: false,
          isLoading: false,
        }));
        try {
          await ClientService.clients.ensureLinkedRecordsForCurrentUser();
        } catch {}
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [loadOnboardingState, loadPinLockState, router]);

  // Initialize auth state
  useEffect(() => {
    checkAuthOnLaunch();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setState(prev => ({
            ...prev,
            user: null,
            profile: null,
            session: null,
            isAuthenticated: false,
            requiresSecuritySetup: false,
            requiresAuthOnLaunch: false,
          }));
        } else if (session && event === 'SIGNED_IN') {
          // Get user profile on sign in
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          const fallbackProfile = {
            id: session.user.id,
            role: ((session.user?.app_metadata as any)?.role ?? 'client') as any,
            name:
              (session.user?.user_metadata as any)?.full_name ??
              (session.user?.user_metadata as any)?.name ??
              session.user.email ??
              null,
            email: session.user.email ?? null,
            phone: (session.user?.user_metadata as any)?.phone ?? null,
            avatar_url: (session.user?.user_metadata as any)?.avatar_url ?? null,
            pin_hash: null,
            biometric_enabled: null,
            client_type: null,
            profile_complete: false,
            created_at: new Date().toISOString(),
          } as any;

          if (profile || fallbackProfile) {
            const effectiveProfile = (profile ?? fallbackProfile) as any;
            const isAdminProfile = effectiveProfile.role === 'admin' || effectiveProfile.role === 'super_admin';
            const hasSecurity = effectiveProfile.pin_hash !== null || effectiveProfile.biometric_enabled === true;
            
            let requiresSecuritySetup = false;
            if (!isAdminProfile && !hasSecurity && !effectiveProfile.profile_complete) {
              const lastPrompt = await SecureStore.getItemAsync('last_security_prompt');
              const now = Date.now();
              if (!lastPrompt || now - parseInt(lastPrompt) > 24 * 60 * 60 * 1000) {
                requiresSecuritySetup = true;
                await SecureStore.setItemAsync('last_security_prompt', now.toString());
              }
            }

            setState(prev => ({
              ...prev,
              user: session.user,
              profile: effectiveProfile,
              session,
              isAuthenticated: true,
              requiresSecuritySetup,
              requiresAuthOnLaunch: isAdminProfile ? false : hasSecurity,
            }));
            if (effectiveProfile.role === 'client') {
              await syncTemporaryUploads();
              try {
                await ClientService.clients.ensureLinkedRecordsForCurrentUser();
              } catch {}
            }
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [checkAuthOnLaunch, syncTemporaryUploads]);

  const value: AuthContextType = {
    ...state,
    login,
    loginAsAdmin,
    loginWithOtp,
    verifyOtp,
    logout,
    verifyPin,
    authenticateWithBiometrics,
    checkAuthOnLaunch,
    clearPinLock,
    completeOnboarding,
    getGreeting,
    adminSecurity,
    updateAdminSecurity,
    verifyAdminGuard,
    isLoggedIn: state.isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
