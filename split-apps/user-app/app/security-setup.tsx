import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { Fingerprint, Lock, Shield, ArrowRight, X, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

export default function SecuritySetupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'biometric' | 'pin' | 'skip' | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'choose' | 'setup-pin'>('choose');

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricSupported(compatible && enrolled);
  };

  const handleBiometricSetup = async () => {
    setLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login for your account',
      });

      if (result.success) {
        // Update user profile with biometric enabled
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('user_profiles')
            .update({ 
              biometric_enabled: true,
              profile_complete: true 
            })
            .eq('id', user.id);

          if (error) throw error;

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Biometric Login Enabled', 'You can now use your fingerprint or face to log in.');
          router.replace('/(tabs)/home' as any);
        }
      } else {
        Alert.alert('Setup Failed', 'Biometric authentication was not completed.');
      }
    } catch (error: any) {
      console.error('Biometric setup error:', error);
      Alert.alert('Error', 'Failed to enable biometric login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSetup = async () => {
    if (pin.length < 4) {
      Alert.alert('Invalid PIN', 'PIN must be at least 4 digits long.');
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'PIN and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      // Hash the PIN (using the same method as in signup)
      const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
      const pinHash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, pin);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ 
            pin_hash: pinHash,
            profile_complete: true 
          })
          .eq('id', user.id);

        if (error) throw error;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('PIN Set Up', 'Your PIN has been set up successfully.');
        router.replace('/(tabs)/home' as any);
      }
    } catch (error: any) {
      console.error('PIN setup error:', error);
      Alert.alert('Error', 'Failed to set up PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Remove the profile_complete update so the user can be prompted again tomorrow.
        // We do nothing to the profile here.

        Alert.alert(
            'Security Warning',
            'Your account is less secure without additional protection. You can enable security features later in settings.',
            [{ text: 'Continue', onPress: () => router.replace('/(tabs)/home' as any) }]
          );
      }
    } catch (error: any) {
      console.error('Skip error:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'setup-pin') {
    return (
      <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Lock size={32} color={Colors.gold} />
            <Text style={styles.title}>Set Up Your PIN</Text>
            <Text style={styles.subtitle}>Enter a 4-6 digit PIN for secure login</Text>
          </View>

          <View style={styles.pinContainer}>
            <TextInput
              style={styles.pinInput}
              placeholder="Enter PIN"
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              autoFocus
            />
            <TextInput
              style={styles.pinInput}
              placeholder="Confirm PIN"
              value={confirmPin}
              onChangeText={setConfirmPin}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
            />
          </View>

          <Pressable
            style={[styles.primaryBtn, loading && styles.disabledBtn]}
            onPress={handlePinSetup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.primaryBtnText}>Complete Setup</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.backBtn}
            onPress={() => setStep('choose')}
            disabled={loading}
          >
            <Text style={styles.backBtnText}>← Back to Options</Text>
          </Pressable>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Shield size={48} color={Colors.gold} />
          <Text style={styles.title}>Protect Your Account</Text>
          <Text style={styles.subtitle}>
            Secure your photos and orders with extra protection
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          {isBiometricSupported && (
            <Pressable
              style={[styles.optionCard, selectedOption === 'biometric' && styles.optionCardSelected]}
              onPress={() => setSelectedOption('biometric')}
              onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={styles.optionContent}>
                <Fingerprint size={24} color={Colors.gold} />
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Enable Biometric</Text>
                  <Text style={styles.optionSubtitle}>Use fingerprint or face recognition</Text>
                </View>
                {selectedOption === 'biometric' && (
                  <CheckCircle size={20} color={Colors.gold} />
                )}
              </View>
            </Pressable>
          )}

          <Pressable
            style={[styles.optionCard, selectedOption === 'pin' && styles.optionCardSelected]}
            onPress={() => setSelectedOption('pin')}
            onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <View style={styles.optionContent}>
              <Lock size={24} color={Colors.gold} />
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Set PIN</Text>
                <Text style={styles.optionSubtitle}>4-6 digit code for secure access</Text>
              </View>
              {selectedOption === 'pin' && (
                <CheckCircle size={20} color={Colors.gold} />
              )}
            </View>
          </Pressable>

          <Pressable
            style={[styles.optionCard, selectedOption === 'skip' && styles.optionCardSelected]}
            onPress={() => setSelectedOption('skip')}
            onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <View style={styles.optionContent}>
              <X size={24} color={Colors.textMuted} />
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, { color: Colors.textMuted }]}>Skip for Now</Text>
                <Text style={[styles.optionSubtitle, { color: Colors.textMuted }]}>
                  Less secure - enable later in settings
                </Text>
              </View>
              {selectedOption === 'skip' && (
                <CheckCircle size={20} color={Colors.textMuted} />
              )}
            </View>
          </Pressable>
        </View>

        <Pressable
          style={[styles.primaryBtn, (!selectedOption || loading) && styles.disabledBtn]}
          onPress={async () => {
            if (selectedOption === 'biometric') {
              await handleBiometricSetup();
            } else if (selectedOption === 'pin') {
              setStep('setup-pin');
            } else if (selectedOption === 'skip') {
              await handleSkip();
            }
          }}
          disabled={!selectedOption || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {selectedOption === 'skip' ? 'Continue' : 'Enable Security'}
            </Text>
          )}
        </Pressable>

        <Text style={styles.footerText}>
          Recommended: Enable at least one security method to protect your account and photos.
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
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
  optionsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  optionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: Colors.gold,
    backgroundColor: '#1a1a1a',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  optionTextContainer: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  optionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  pinContainer: {
    gap: 16,
    marginBottom: 24,
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
  },
  primaryBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  backBtn: {
    alignItems: 'center',
    padding: 12,
  },
  backBtnText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },
});
