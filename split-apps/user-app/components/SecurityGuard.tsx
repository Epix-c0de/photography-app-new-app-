import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { Fingerprint, Delete } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 3;
const ATTEMPT_KEY = 'security_guard_attempts';

interface SecurityGuardProps {
  children: React.ReactNode;
  userId: string | null;
}

export default function SecurityGuard({ children, userId }: SecurityGuardProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const dotAnimations = useRef(
    Array.from({ length: PIN_LENGTH }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    initialize();
  }, [userId]);

  const initialize = async () => {
    try {
      const storedAttempts = await SecureStore.getItemAsync(ATTEMPT_KEY);
      const currentAttempts = storedAttempts ? parseInt(storedAttempts, 10) : 0;
      setAttempts(currentAttempts);
      if (currentAttempts >= MAX_ATTEMPTS) {
        setLockedOut(true);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('pin_hash')
        .eq('id', userId!)
        .single();

      if (!profile?.pin_hash) {
        setNeedsPin(false);
        return;
      }

      const biometricSupported = await LocalAuthentication.hasHardwareAsync();
      const biometricEnabled = await LocalAuthentication.isEnrolledAsync();
      setHasBiometric(biometricSupported && biometricEnabled);
      setNeedsPin(true);
    } catch (err) {
      console.error('SecurityGuard init error:', err);
      setNeedsPin(false);
    }
  };

  const animateDots = () => {
    dotAnimations.forEach((anim, index) => {
      if (index < pin.length) {
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }).start();
      } else {
        anim.setValue(0);
      }
    });
  };

  useEffect(() => {
    animateDots();
  }, [pin]);

  const hapticPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBiometric = async () => {
    hapticPress();
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to continue',
        cancelLabel: 'Use PIN',
      });
      if (result.success) {
        await SecureStore.setItemAsync(ATTEMPT_KEY, '0');
        setNeedsPin(false);
      }
    } catch (err) {
      console.error('Biometric auth error:', err);
    }
  };

  const handleNumberPress = (num: number) => {
    if (isProcessing || lockedOut) return;
    hapticPress();
    if (pin.length < PIN_LENGTH) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');

      if (newPin.length === PIN_LENGTH) {
        verifyPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    if (isProcessing || lockedOut) return;
    hapticPress();
    setPin(pin.slice(0, -1));
    setError('');
  };

  const verifyPin = async (enteredPin: string) => {
    setIsProcessing(true);
    try {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        enteredPin
      );

      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('pin_hash')
        .eq('id', userId!)
        .single();

      if (fetchError) throw fetchError;

      if (profile.pin_hash === hash) {
        await SecureStore.setItemAsync(ATTEMPT_KEY, '0');
        setNeedsPin(false);
      } else {
        const newAttempts = attempts + 1;
        await SecureStore.setItemAsync(ATTEMPT_KEY, newAttempts.toString());
        setAttempts(newAttempts);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        const remaining = MAX_ATTEMPTS - newAttempts;
        if (remaining > 0) {
          setError(`Incorrect PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
        } else {
          setLockedOut(true);
          setError('Too many failed attempts.');
        }
        setPin('');
      }
    } catch (err: any) {
      console.error('PIN verify error:', err);
      setError('Verification failed. Please try again.');
      setPin('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUsePassword = () => {
    hapticPress();
    setLockedOut(false);
    setNeedsPin(false);
    setError('');
    setPin('');
  };

  if (!userId || Platform.OS === 'web' || !needsPin) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <Fingerprint size={48} color={Colors.gold} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>Enter Your PIN</Text>
          <Text style={styles.subtitle}>Enter your 4-digit PIN to continue</Text>
        </View>

        <View style={styles.dotsContainer}>
          {Array.from({ length: PIN_LENGTH }).map((_, index) => {
            const isFilled = index < pin.length;
            const scale = dotAnimations[index].interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.2],
            });
            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  isFilled && styles.dotFilled,
                  !!error && styles.dotError,
                  { transform: [{ scale }] },
                ]}
              >
                {isFilled && <View style={styles.dotInner} />}
              </Animated.View>
            );
          })}
        </View>

        {!!error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {lockedOut ? (
          <View style={styles.lockedSection}>
            <Text style={styles.lockedText}>
              Too many failed attempts. PIN access is temporarily locked.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.passwordButton,
                pressed && styles.passwordButtonPressed,
              ]}
              onPress={handleUsePassword}
            >
              <Text style={styles.passwordButtonText}>Use Password</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.keypadSection}>
            <View style={styles.keypadRow}>
              {[1, 2, 3].map((num) => (
                <Pressable
                  key={num}
                  style={({ pressed }) => [
                    styles.keypadButton,
                    pressed && styles.keypadButtonPressed,
                  ]}
                  onPress={() => handleNumberPress(num)}
                >
                  <Text style={styles.keypadText}>{num}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.keypadRow}>
              {[4, 5, 6].map((num) => (
                <Pressable
                  key={num}
                  style={({ pressed }) => [
                    styles.keypadButton,
                    pressed && styles.keypadButtonPressed,
                  ]}
                  onPress={() => handleNumberPress(num)}
                >
                  <Text style={styles.keypadText}>{num}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.keypadRow}>
              {[7, 8, 9].map((num) => (
                <Pressable
                  key={num}
                  style={({ pressed }) => [
                    styles.keypadButton,
                    pressed && styles.keypadButtonPressed,
                  ]}
                  onPress={() => handleNumberPress(num)}
                >
                  <Text style={styles.keypadText}>{num}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.keypadRow}>
              {hasBiometric ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.keypadButton,
                    pressed && styles.keypadButtonPressed,
                  ]}
                  onPress={handleBiometric}
                >
                  <Fingerprint size={28} color={Colors.gold} />
                </Pressable>
              ) : (
                <View style={styles.keypadButtonEmpty} />
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.keypadButton,
                  pressed && styles.keypadButtonPressed,
                ]}
                onPress={() => handleNumberPress(0)}
              >
                <Text style={styles.keypadText}>0</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.keypadButton,
                  pressed && styles.keypadButtonPressed,
                ]}
                onPress={handleBackspace}
              >
                <Delete size={28} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.cardLight,
    borderWidth: 2,
    borderColor: Colors.border,
    marginHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotFilled: {
    borderColor: Colors.gold,
    backgroundColor: 'transparent',
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gold,
  },
  dotError: {
    borderColor: Colors.error,
  },
  errorContainer: {
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.2)',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  keypadSection: {
    width: '100%',
    maxWidth: 320,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  keypadButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keypadButtonPressed: {
    backgroundColor: Colors.cardHover,
    borderColor: Colors.gold,
    transform: [{ scale: 0.95 }],
  },
  keypadButtonEmpty: {
    width: 76,
    height: 76,
    marginHorizontal: 10,
  },
  keypadText: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.text,
  },
  lockedSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  lockedText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  passwordButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  passwordButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  passwordButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
    letterSpacing: 0.5,
  },
});
