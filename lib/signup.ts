import { z } from 'zod';
import { supabase } from '@/lib/supabase';

// Enhanced error types for better debugging
export interface EnhancedError extends Error {
  status?: number;
  code?: string;
  isNetworkError?: boolean;
  isAuthError?: boolean;
  isProfileError?: boolean;
  originalError?: unknown;
}

// Network diagnostic utilities
export async function checkSupabaseConnectivity(): Promise<{
  reachable: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}> {
  try {
    const startTime = Date.now();
    const response = await fetch('https://ujunohfpcmjywsblsoel.supabase.co/auth/v1/settings', {
      method: 'HEAD',
      headers: {
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdW5vaGZwY21qeXdzYmxzb2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDk5NzYsImV4cCI6MjA4NjIyNTk3Nn0.w4bhLUjaAXhB8B1sujLJWIG5-TokDPuEIInFeLm5EMg',
      },
    });
    const responseTime = Date.now() - startTime;
    
    return {
      reachable: true,
      responseTime,
      statusCode: response.status,
    };
  } catch (error: any) {
    return {
      reachable: false,
      error: error.message,
    };
  }
}

// Enhanced error creation with better diagnostics
export function createEnhancedError(
  message: string,
  originalError?: unknown,
  options?: { status?: number; code?: string; isNetworkError?: boolean; isAuthError?: boolean }
): EnhancedError {
  const error = new Error(message) as EnhancedError;
  
  if (originalError) {
    error.originalError = originalError;
    
    if (typeof originalError === 'object' && originalError !== null) {
      const anyError = originalError as any;
      error.status = anyError.status ?? options?.status;
      error.code = anyError.code ?? options?.code;
    }
  }
  
  error.status = options?.status ?? error.status;
  error.code = options?.code ?? error.code;
  error.isNetworkError = options?.isNetworkError ?? isTransientNetworkError(originalError);
  error.isAuthError = options?.isAuthError ?? 
    (typeof originalError === 'object' && originalError !== null && 
     'message' in (originalError as any) && 
     typeof (originalError as any).message === 'string' &&
     ((originalError as any).message.toLowerCase().includes('unauthorized') ||
      (originalError as any).message.toLowerCase().includes('401')));
  
  return error;
}

export type SignupFormState = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  pin: string;
};

export const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid phone number required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export function normalizeSignupForm(form: SignupFormState): SignupFormState {
  return {
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    email: form.email.trim().toLowerCase(),
    password: form.password,
    confirmPassword: form.confirmPassword,
    pin: form.pin.trim(),
  };
}

export function isTransientNetworkError(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  
  const message = 'message' in err && typeof (err as any).message === 'string' ? (err as any).message : '';
  const lower = message.toLowerCase();
  
  // First, exclude authentication and configuration errors that should NOT be treated as network errors
  if (
    lower.includes('unauthorized') ||
    lower.includes('401') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('429') ||
    lower.includes('supabase is not configured') ||
    (lower.includes('missing') && (lower.includes('supabase_url') || lower.includes('anon_key'))) ||
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('invalid login credentials') ||
    lower.includes('invalid email') ||
    (lower.includes('password') && (lower.includes('weak') || lower.includes('should be') || lower.includes('at least')))
  ) {
    return false;
  }
  
  // Then check for actual network connectivity issues
  return (
    message.includes('Failed to fetch') ||
    message.includes('Network request failed') ||
    message.includes('NetworkError') ||
    message.includes('Network connection') ||
    message.includes('connection failed') ||
    message.includes('timeout') ||
    message.includes('offline') ||
    message.includes('ERR_CONNECTION') ||
    message.includes('ERR_NETWORK') ||
    (typeof (err as any).code === 'string' && (err as any).code.includes('NETWORK'))
  );
}

export function getSignupFailureMessage(err: unknown) {
  const message = err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
    ? (err as any).message
    : 'An unknown error occurred.';

  const lower = message.toLowerCase();

  if (lower.includes('supabase is not configured') || (lower.includes('missing') && (lower.includes('supabase_url') || lower.includes('anon_key')))) {
    return 'Signup is unavailable because the app is missing Supabase configuration.';
  }

  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
    return 'Too many signup attempts. Please wait a few minutes before trying again.';
  }

  if (isTransientNetworkError(err)) {
    return 'Could not reach the server. Check your internet connection and try again.';
  }

  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Please log in instead.';
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid email')) {
    return 'That email address looks invalid. Please check and try again.';
  }

  if (lower.includes('password') && (lower.includes('weak') || lower.includes('should be') || lower.includes('at least'))) {
    return 'Your password does not meet the security requirements. Please choose a stronger password.';
  }

  // Handle authentication/authorization errors more specifically
  if (lower.includes('unauthorized') || lower.includes('401')) {
    return 'Authentication failed. Please check your Supabase configuration or contact support.';
  }

  return message;
}

// Enhanced profile creation with retry and validation
export async function createUserProfileWithRetry(
  userId: string,
  profileData: {
    name: string;
    phone: string;
    email: string;
    pinHash: string;
    biometricEnabled: boolean;
  }
) {
  const maxAttempts = 3;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          role: 'client',
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
          pin_hash: profileData.pinHash,
          biometric_enabled: profileData.biometricEnabled,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Verify the profile was created successfully and is complete
      const { data: createdProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('profile_complete')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      if (!createdProfile?.profile_complete) {
        throw new Error('Profile created but marked as incomplete');
      }

      return { success: true };
    } catch (err: any) {
      // Handle unique constraint violation for phone number
      if (err?.code === '23505' && err?.message?.includes('phone')) {
        console.warn('Phone number already in use, creating profile without phone');
        try {
          // Retry without phone number
          const { error: retryError } = await supabase
            .from('user_profiles')
            .upsert({
              id: userId,
              role: 'client',
              name: profileData.name,
              email: profileData.email,
              phone: null, // clear phone
              pin_hash: profileData.pinHash,
              biometric_enabled: profileData.biometricEnabled,
              updated_at: new Date().toISOString(),
            });
            
          if (retryError) throw retryError;
          return { success: true, warning: 'Phone number already in use' };
        } catch (retryErr) {
          // If even that fails, return the original error or the new one
          return { success: false, error: retryErr };
        }
      }

      const isLast = attempt === maxAttempts - 1;
      if (!isTransientNetworkError(err) || isLast) {
        return { 
          success: false, 
          error: err,
          attempt: attempt + 1
        };
      }
      
      const delayMs = 400 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  
  return { success: false, error: new Error('Profile creation failed after all retries') };
}

// Function to check if a profile is complete
export async function isProfileComplete(userId: string): Promise<boolean> {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('profile_complete')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error checking profile completeness:', error);
      return false;
    }

    return profile?.profile_complete ?? false;
  } catch (err) {
    console.error('Exception checking profile completeness:', err);
    return false;
  }
}

// Function to check if a profile exists (regardless of completeness)
export async function doesProfileExist(userId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('id', userId);

    if (error) {
      console.error('Error checking profile existence:', error);
      return false;
    }

    return (count ?? 0) > 0;
  } catch (err) {
    console.error('Exception checking profile existence:', err);
    return false;
  }
}

// Function to complete incomplete profiles
export async function completeIncompleteProfile(
  userId: string,
  profileData: {
    name: string;
    phone: string;
    email: string;
  }
) {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        name: profileData.name,
        phone: profileData.phone,
        email: profileData.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;

    // Verify the profile is now complete
    return await isProfileComplete(userId);
  } catch (err) {
    console.error('Error completing incomplete profile:', err);
    return false;
  }
}

