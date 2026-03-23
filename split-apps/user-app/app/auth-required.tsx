import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { Lock, Fingerprint, ArrowRight, Shield, AlertCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

export default function AuthRequiredScreen() {
  const router = useRouter();
  const {
    profile,
    verifyPin,
    authenticateWithBiometrics,
    pinAttempts,
    pinLockedUntil,
    clearPinLock,
  } = useAuth();
  
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricAvailable(compatible && enrolled && profile?.biometric_enabled === true);
    } catch (error) {
      console.error('Biometric check error:', error);
      setIsBiometricAvailable(false);
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) {
      Alert.alert('Invalid PIN', 'PIN must be at least 4 digits long.');
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const isValid = await verifyPin(pin);
      
      if (isValid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (profile?.role === 'admin' || profile?.role === 'super_admin') {
          router.replace('/(admin)/dashboard' as any);
        } else {
          router.replace('/(tabs)/home');
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPin('');
        
        const remainingAttempts = 5 - pinAttempts;
        if (remainingAttempts > 0) {
          Alert.alert(
            'Incorrect PIN',
            `Incorrect PIN. ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining.`
          );
        }
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      Alert.alert('Error', 'Failed to verify PIN. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const success = await authenticateWithBiometrics();
      
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (profile?.role === 'admin' || profile?.role === 'super_admin') {
          router.replace('/(admin)/dashboard' as any);
        } else {
          router.replace('/(tabs)/home');
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Authentication Failed', 'Biometric authentication was not successful.');
      }
    } catch (error) {
      console.error('Biometric auth error:', error);
      Alert.alert('Error', 'Failed to authenticate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsePassword = () => {
    router.replace('/login');
  };

  const isPinLocked = pinLockedUntil && new Date() < pinLockedUntil;
  const remainingLockTime = isPinLocked 
    ? Math.ceil((pinLockedUntil.getTime() - Date.now()) / 1000 / 60) 
    : 0;

  if (isPinLocked) {
    return (
      <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.header}>
            <AlertCircle size={48} color={Colors.error} />
            <Text style={styles.title}>Account Locked</Text>
            <Text style={styles.subtitle}>
              Too many incorrect PIN attempts
            </Text>
          </View>

          <View style={styles.lockMessage}>
            <Text style={styles.lockText}>
              Your account is temporarily locked for security reasons.
            </Text>
            <Text style={styles.lockTime}>
              Please try again in {remainingLockTime} minute{remainingLockTime > 1 ? 's' : ''}.
            </Text>
          </View>

          <Pressable
            style={styles.secondaryBtn}
            onPress={handleUsePassword}
            disabled={isLoading}
          >
            <Text style={styles.secondaryBtnText}>Use Password Instead</Text>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Shield size={48} color={Colors.gold} />
          <Text style={styles.title}>Secure Access</Text>
          <Text style={styles.subtitle}>
            Verify your identity to continue
          </Text>
        </View>

        {isBiometricAvailable && (
          <Pressable
            style={[styles.biometricBtn, isLoading && styles.disabledBtn]}
            onPress={handleBiometricAuth}
            disabled={isLoading}
          >
            <Fingerprint size={24} color={Colors.background} />
            <Text style={styles.biometricBtnText}>
              {isLoading ? 'Verifying...' : 'Use Biometrics'}
            </Text>
          </Pressable>
        )}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.pinSection}>
          <Text style={styles.pinLabel}>Enter your PIN</Text>
          <TextInput
            style={styles.pinInput}
            placeholder="••••••"
            value={pin}
            onChangeText={setPin}
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
            autoFocus={!isBiometricAvailable}
            editable={!isLoading}
          />
          
          {pinAttempts > 0 && (
            <Text style={styles.attemptsText}>
              {5 - pinAttempts} attempt{5 - pinAttempts > 1 ? 's' : ''} remaining
            </Text>
          )}

          <Pressable
            style={[styles.primaryBtn, (pin.length < 4 || isLoading) && styles.disabledBtn]}
            onPress={handlePinSubmit}
            disabled={pin.length < 4 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.primaryBtnText}>Continue</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          style={styles.secondaryBtn}
          onPress={handleUsePassword}
          disabled={isLoading}
        >
          <Text style={styles.secondaryBtnText}>Use Password Instead</Text>
        </Pressable>

        <Text style={styles.securityNote}>
          Your security is important. This extra step protects your photos and orders.
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  biometricBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  biometricBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.background,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: Colors.textMuted,
    fontSize: 14,
  },
  pinSection: {
    marginBottom: 24,
  },
  pinLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  pinInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: Colors.white,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  attemptsText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  secondaryBtn: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryBtnText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  securityNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },
  lockMessage: {
    backgroundColor: Colors.error + '20',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  lockText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  lockTime: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
