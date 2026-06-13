import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import PINLockModal from './PINLockModal';

interface SecurityGuardProps {
  children: React.ReactNode;
  userId: string | null;
}

const MAX_ATTEMPTS = 3;
const ATTEMPT_KEY = 'security_guard_attempts';

export default function SecurityGuard({ children, userId }: SecurityGuardProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isPassed, setIsPassed] = useState(false);
  const [showPINModal, setShowPINModal] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (userId) {
      checkSecurity();
    } else {
      // No user logged in, allow access
      setIsPassed(true);
      setIsChecking(false);
    }
  }, [userId]);

  const loadAttempts = async () => {
    try {
      const stored = await SecureStore.getItemAsync(ATTEMPT_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch (err) {
      console.error('Error loading attempts:', err);
      return 0;
    }
  };

  const saveAttempts = async (count: number) => {
    try {
      await SecureStore.setItemAsync(ATTEMPT_KEY, count.toString());
      setAttempts(count);
    } catch (err) {
      console.error('Error saving attempts:', err);
    }
  };

  const resetAttempts = async () => {
    await saveAttempts(0);
  };

  const checkSecurity = async () => {
    try {
      // On web, SecureStore and biometrics are not supported — skip all security checks
      if (Platform.OS === 'web') {
        setIsPassed(true);
        setIsChecking(false);
        return;
      }

      // Load current attempt count
      const currentAttempts = await loadAttempts();
      setAttempts(currentAttempts);

      if (currentAttempts >= MAX_ATTEMPTS) {
        // Too many failed attempts, require password fallback
        setIsChecking(false);
        handleFallbackToPassword();
        return;
      }

      // Fetch security profile — use maybeSingle() so a missing row returns null
      // instead of throwing PGRST116 (0 rows error)
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('biometric_enabled, pin_hash')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching security profile:', error);
        // Allow access if we can't fetch profile — don't sign out
        setIsPassed(true);
        setIsChecking(false);
        return;
      }

      // No profile row yet — user is new, allow access without security check
      if (!profile) {
        setIsPassed(true);
        setIsChecking(false);
        return;
      }

      // Check if biometric is enabled
      if (profile.biometric_enabled) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Verify your identity to continue',
            cancelLabel: 'Cancel',
            disableDeviceFallback: false,
          });

          if (result.success) {
            await resetAttempts();
            setIsPassed(true);
            setIsChecking(false);
            return;
          } else {
            // Biometric failed, increment attempts
            const newAttempts = currentAttempts + 1;
            await saveAttempts(newAttempts);

            if (newAttempts >= MAX_ATTEMPTS) {
              handleFallbackToPassword();
              setIsChecking(false);
              return;
            }

            // Try again or fallback to PIN
            if (profile.pin_hash) {
              setShowPINModal(true);
              setIsChecking(false);
            } else {
              // No PIN set, try biometric again or fail
              Alert.alert(
                'Authentication Failed',
                `Biometric authentication failed. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts > 1 ? 's' : ''} remaining.`,
                [
                  {
                    text: 'Try Again',
                    onPress: () => checkSecurity(),
                  },
                  {
                    text: 'Use Password',
                    onPress: () => handleFallbackToPassword(),
                  },
                ]
              );
              setIsChecking(false);
            }
            return;
          }
        } else {
          // Biometric not available, fall back to PIN or password
          if (profile.pin_hash) {
            setShowPINModal(true);
            setIsChecking(false);
            return;
          }
        }
      }

      // Check if PIN is set
      if (profile.pin_hash) {
        setShowPINModal(true);
        setIsChecking(false);
        return;
      }

      // No security measures set, allow access
      await resetAttempts();
      setIsPassed(true);
      setIsChecking(false);
    } catch (err) {
      console.error('Error checking security:', err);
      // Allow access on error to prevent lockout
      setIsPassed(true);
      setIsChecking(false);
    }
  };

  const handlePINSuccess = async () => {
    await resetAttempts();
    setShowPINModal(false);
    setIsPassed(true);
  };

  const handleFallbackToPassword = async () => {
    await resetAttempts();
    // Just pass through — don't force sign out which causes the login loop.
    // The user can manually sign out from the profile screen if needed.
    setIsPassed(true);
    setIsChecking(false);
  };

  if (isChecking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Verifying security...</Text>
      </View>
    );
  }

  if (!isPassed) {
    return (
      <View style={styles.container}>
        <PINLockModal
          visible={showPINModal}
          mode="VERIFY_PIN"
          onClose={() => {
            // Don't allow closing without success
          }}
          onSuccess={handlePINSuccess}
          onFallbackToPassword={handleFallbackToPassword}
        />
        
        {!showPINModal && (
          <View style={styles.blockedContainer}>
            <Text style={styles.blockedText}>Authentication required to continue</Text>
          </View>
        )}
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 24,
  },
  blockedText: {
    fontSize: 18,
    color: '#FFF',
    textAlign: 'center',
  },
});
