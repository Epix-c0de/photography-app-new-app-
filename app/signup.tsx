import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Pressable,
  Animated,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Mail, Lock, User, Phone, Fingerprint, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { 
  getSignupFailureMessage, 
  isTransientNetworkError, 
  normalizeSignupForm, 
  signupSchema, 
  type SignupFormState, 
  checkSupabaseConnectivity, 
  createEnhancedError
} from '@/lib/signup';
import Colors from '@/constants/colors';
import { ClientService } from '@/services/client';

export default function SignupScreen() {
  const router = useRouter();
  const [form, setForm] = useState<SignupFormState>({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    pin: '',
  });
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cooldownTime, setCooldownTime] = useState<number | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricSupported(compatible && enrolled);
    })();
  }, [fadeAnim]);

  useEffect(() => {
    let timer: any;
    if (cooldownTime) {
      timer = setInterval(() => {

        const remaining = Math.ceil((cooldownTime - Date.now()) / 1000);
        if (remaining <= 0) {
          setCooldownTime(null);
          clearInterval(timer);
        }
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldownTime]);

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
      });
      if (result.success) {
        setBiometricEnabled(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setBiometricEnabled(false);
      }
    } else {
      setBiometricEnabled(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const hashPin = async (pin: string) => {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pin
    );
    return digest;
  };

  const signUpWithRetry = async ({ 
    email, 
    password, 
    fullName, 
    phone, 
    metadata 
  }: { 
    email: string; 
    password: string; 
    fullName: string; 
    phone: string;
    metadata?: Record<string, any>;
  }) => {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: fullName,
              phone,
              ...metadata,
            }
          }
        });

        if (error) throw error;
        return data;
      } catch (err) {
        const isLast = attempt === maxAttempts - 1;
        if (!isTransientNetworkError(err) || isLast) throw err;
        const delayMs = 400 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('Signup failed');
  };

  const handleSignup = async () => {
    if (cooldownTime) {
      const remaining = Math.ceil((cooldownTime - Date.now()) / 1000);
      Alert.alert('Please Wait', `You are doing that too often. Please wait ${remaining} seconds.`);
      return;
    }

    setLoading(true);
    setErrors({});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // 1. Validation
    const normalized = normalizeSignupForm(form);
    const validationResult = signupSchema.safeParse(normalized);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        const pathKey = issue.path[0];
        if (typeof pathKey === 'string') {
          fieldErrors[pathKey] = issue.message;
        }
      });
      setErrors(fieldErrors);
      setLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {

      // Check server connectivity before attempting signup
      const connectivity = await checkSupabaseConnectivity();
      if (!connectivity.reachable) {
        throw createEnhancedError(
          `Cannot connect to Supabase server: ${connectivity.error}`,
          null,
          { isNetworkError: true }
        );
      }

      // 2. Hash PIN
      const pinHash = await hashPin(normalized.pin);

      // 3. Supabase Auth Signup
      const authData = await signUpWithRetry({
        email: normalized.email,
        password: normalized.password,
        fullName: normalized.fullName,
        phone: normalized.phone,
        // Pass additional data to metadata for the trigger to pick up
        metadata: {
          pin_hash: pinHash,
          biometric_enabled: biometricEnabled
        }
      });

      if (authData.user) {
        // The profile is created automatically by the database trigger
        // with security definer (bypasses RLS). Just verify it exists.
        if (authData.session) {
          let profileVerified = false;
          const maxAttempts = 3;
          
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
              const { data: profile, error: fetchError } = await supabase
                .from('user_profiles')
                .select('id, profile_complete')
                .eq('id', authData.user.id)
                .maybeSingle();

              if (profile) {
                profileVerified = true;
                console.log('Profile verified after signup:', profile);
                break;
              }

              if (attempt < maxAttempts - 1) {
                // Wait before retrying - trigger might still be executing
                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
              }
            } catch (verifyErr) {
              console.warn(`Profile verification attempt ${attempt + 1} failed:`, verifyErr);
              if (attempt === maxAttempts - 1) throw verifyErr;
              await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
          }

          if (!profileVerified) {
            console.warn('Profile could not be verified - may be created by trigger asynchronously');
          }
        } else {
          console.log('Session not available (email confirmation likely required). Profile will be created by server trigger.');
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // 5. Navigate
        // If email confirmation is required, Supabase returns user but session might be null.
        if (!authData.session) {
          Alert.alert('Check your email', 'Please verify your email address to continue.');
          router.replace('/login' as any);
        } else {
            await supabase.auth.refreshSession();
            try {
              await ClientService.clients.ensureLinkedRecordsForCurrentUser();
            } catch {}
            // Auto-login behavior - redirect to home (PIN forms are in the signup flow itself)
            router.replace('/(tabs)/home' as any);
        }
      } else {
        throw new Error('Signup succeeded but no user was returned.');
      }
    } catch (err: any) {
      // Enhanced error logging with detailed diagnostics
      console.error('Signup Error Details:', {
        message: err?.message,
        status: err?.status,
        code: err?.code,
        name: err?.name,
        isNetworkError: err?.isNetworkError,
        isAuthError: err?.isAuthError,
        stack: err?.stack,
        originalError: err?.originalError,
        timestamp: new Date().toISOString(),
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
        connectivity: await checkSupabaseConnectivity()
      });
      
      Alert.alert('Signup Failed', getSignupFailureMessage(err));
      
      // Handle rate limiting specifically
      const message = err?.message?.toLowerCase() || '';
      if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
        setCooldownTime(Date.now() + 60000); // 1 minute cooldown
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handlePressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#0A0A0A', '#111111', '#0A0A0A']}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                <View style={styles.header}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join Epix Visuals Studios.co today</Text>
                </View>

                <View style={styles.form}>
                    {/* Full Name */}
                    <View style={styles.inputGroup}>
                        <View style={[styles.inputContainer, errors.fullName && styles.inputError]}>
                            <User size={20} color={Colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Full Name"
                                placeholderTextColor={Colors.textMuted}
                                value={form.fullName}
                                onChangeText={(text) => handleChange('fullName', text)}
                            />
                        </View>
                        {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
                    </View>

                    {/* Mobile Number */}
                    <View style={styles.inputGroup}>
                        <View style={[styles.inputContainer, errors.phone && styles.inputError]}>
                            <Phone size={20} color={Colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Mobile Number"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="phone-pad"
                                value={form.phone}
                                onChangeText={(text) => handleChange('phone', text)}
                            />
                        </View>
                        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
                    </View>

                    {/* Email */}
                    <View style={styles.inputGroup}>
                        <View style={[styles.inputContainer, errors.email && styles.inputError]}>
                            <Mail size={20} color={Colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={form.email}
                                onChangeText={(text) => handleChange('email', text)}
                            />
                        </View>
                        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                    </View>

                    {/* Password */}
                    <View style={styles.inputGroup}>
                        <View style={[styles.inputContainer, errors.password && styles.inputError]}>
                            <Lock size={20} color={Colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={Colors.textMuted}
                                secureTextEntry={!showPassword}
                                value={form.password}
                                onChangeText={(text) => handleChange('password', text)}
                            />
                            <Pressable onPress={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
                            </Pressable>
                        </View>
                        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                    </View>

                    {/* Confirm Password */}
                    <View style={styles.inputGroup}>
                        <View style={[styles.inputContainer, errors.confirmPassword && styles.inputError]}>
                            <Lock size={20} color={Colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm Password"
                                placeholderTextColor={Colors.textMuted}
                                secureTextEntry={!showConfirmPassword}
                                value={form.confirmPassword}
                                onChangeText={(text) => handleChange('confirmPassword', text)}
                            />
                            <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                {showConfirmPassword ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
                            </Pressable>
                        </View>
                        {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                    </View>

                    {/* PIN */}
                    <View style={styles.inputGroup}>
                        <View style={[styles.inputContainer, errors.pin && styles.inputError]}>
                            <ShieldCheck size={20} color={Colors.textMuted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Create App PIN (4-6 digits)"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="number-pad"
                                secureTextEntry
                                maxLength={6}
                                value={form.pin}
                                onChangeText={(text) => handleChange('pin', text)}
                            />
                        </View>
                        {errors.pin && <Text style={styles.errorText}>{errors.pin}</Text>}
                    </View>

                    {/* Biometric Toggle */}
                    {isBiometricSupported && (
                        <View style={styles.biometricContainer}>
                            <View style={styles.biometricLabel}>
                                <Fingerprint size={24} color={Colors.gold} />
                                <Text style={styles.biometricText}>Enable Biometric Login</Text>
                            </View>
                            <Switch
                                value={biometricEnabled}
                                onValueChange={handleBiometricToggle}
                                trackColor={{ false: '#333', true: Colors.gold }}
                                thumbColor={biometricEnabled ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    )}

                    {/* Signup Button */}
                    <Pressable
                        onPress={handleSignup}
                        onPressIn={handlePressIn}
                        onPressOut={handlePressOut}
                        disabled={loading || !!cooldownTime}
                        style={{ marginTop: 20 }}
                    >
                        <Animated.View style={[styles.signupButton, { transform: [{ scale: buttonScale }], opacity: cooldownTime ? 0.7 : 1 }]}>
                            <LinearGradient
                                colors={cooldownTime ? ['#666', '#444'] : [Colors.gold, Colors.goldDark]}
                                style={styles.gradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                {loading ? (
                                    <ActivityIndicator color={Colors.background} />
                                ) : cooldownTime ? (
                                    <Text style={[styles.signupButtonText, { color: '#fff' }]}>
                                        Wait {Math.ceil((cooldownTime - Date.now()) / 1000)}s
                                    </Text>
                                ) : (
                                    <>
                                        <Text style={styles.signupButtonText}>Create Account</Text>
                                        <ArrowRight size={20} color={Colors.background} />
                                    </>
                                )}
                            </LinearGradient>
                        </Animated.View>
                    </Pressable>

                    <Pressable onPress={() => router.push('/login')} style={styles.loginLink}>
                        <Text style={styles.loginLinkText}>
                            Already have an account? <Text style={styles.loginLinkHighlight}>Log In</Text>
                        </Text>
                    </Pressable>
                </View>
            </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    marginLeft: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginLeft: 4,
  },
  biometricContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  biometricLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  biometricText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  signupButton: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 56,
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signupButtonText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: '600',
  },
  loginLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginLinkText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  loginLinkHighlight: {
    color: Colors.gold,
    fontWeight: '600',
  },
});
