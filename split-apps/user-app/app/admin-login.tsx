import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Animated, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, Fingerprint, RefreshCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { supabase, supabaseUrl } from '@/lib/supabase';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { loginAsAdmin, loginWithOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Modes: 'password' (default), 'otp-request' (email only), 'otp-verify' (enter code)
  const [mode, setMode] = useState<'password' | 'otp-request' | 'otp-verify'>('password');
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const otpInputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [contentOpacity]);

  // Handle switching modes
  const switchMode = (newMode: 'password' | 'otp-request') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(newMode);
    // Clear fields that are not relevant? No, keep email.
  };

  const handleSubmit = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your admin email.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);

    try {
      if (mode === 'password') {
        if (!password.trim()) {
          Alert.alert('Missing Password', 'Please enter your password.');
          setIsSubmitting(false);
          return;
        }
        await loginAsAdmin(email, password.trim());
        router.replace('/(admin)/dashboard' as any);
      } else if (mode === 'otp-request') {
        // Send OTP
        await loginWithOtp(email);
        Alert.alert('Code Sent', `A verification code has been sent to ${email}`);
        setMode('otp-verify');
      } else if (mode === 'otp-verify') {
        if (otp.length < 6) {
          Alert.alert('Invalid OTP', 'Please enter the 6-digit code.');
          setIsSubmitting(false);
          return;
        }
        await verifyOtp(email, otp.trim());
        router.replace('/(admin)/dashboard' as any);
      }
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : 'An error occurred.';
      const normalizedEmail = email.trim().toLowerCase();
      const isEmailNotConfirmed =
        message.toLowerCase().includes('email not confirmed') ||
        message.toLowerCase().includes('email_not_confirmed') ||
        error?.code === 'email_not_confirmed';

      const isUnauthorizedAdminOnly = message.toLowerCase().includes('unauthorized: admin access only');

      if (isEmailNotConfirmed) {
        Alert.alert(
          'Email Not Confirmed',
          [
            'Supabase is still treating this email as unconfirmed.',
            '',
            'Fix options:',
            '1) Use OTP login (this also verifies the email) by tapping "Login via OTP / Forgot Password?"',
            '2) Resend the confirmation email and click the latest link',
            '',
            `Project: ${supabaseUrl}`,
          ].join('\n'),
          [
            {
              text: 'Send OTP Code',
              onPress: async () => {
                try {
                  setMode('otp-request');
                  await loginWithOtp(normalizedEmail);
                  Alert.alert('Code Sent', `A verification code has been sent to ${normalizedEmail}`);
                  setMode('otp-verify');
                } catch (e: any) {
                  Alert.alert('Error', e?.message || 'Failed to send code');
                }
              },
            },
            {
              text: 'Resend Confirmation',
              onPress: async () => {
                try {
                  const { error: resendError } = await supabase.auth.resend({
                    type: 'signup',
                    email: normalizedEmail,
                  });
                  if (resendError) throw resendError;
                  Alert.alert('Sent', `Confirmation email sent to ${normalizedEmail}`);
                } catch (e: any) {
                  Alert.alert('Error', e?.message || 'Failed to resend confirmation');
                }
              },
            },
            { text: 'OK' },
          ]
        );
        return;
      }

      if (isUnauthorizedAdminOnly) {
        const actions: { text: string; onPress?: () => void }[] = [
          { text: 'OK' },
          { text: 'Use OTP Login', onPress: () => switchMode('otp-request') },
        ];

        if (__DEV__ && mode === 'password' && normalizedEmail && password.trim()) {
          actions.unshift({
            text: 'Make Admin (Dev)',
            onPress: async () => {
              try {
                setIsSubmitting(true);
                const { data, error: fnError } = await supabase.functions.invoke('create_admin_user', {
                  body: { email: normalizedEmail, password: password.trim() },
                });
                if (fnError) throw fnError;
                if (data?.error) throw new Error(data.error);

                await loginAsAdmin(normalizedEmail, password.trim());
                router.replace('/(admin)/dashboard' as any);
              } catch (e: any) {
                if (e?.message?.includes('Failed to send a request to the Edge Function')) {
                  Alert.alert(
                    'Edge Function Error',
                    'Could not reach the "create_admin_user" function.\n\n' +
                    'If running locally: Ensure "supabase functions serve" is running.\n' +
                    'If running remotely: Ensure the function is deployed with "supabase functions deploy create_admin_user".'
                  );
                } else {
                  Alert.alert('Error', e?.message || 'Failed to promote admin');
                }
              } finally {
                setIsSubmitting(false);
              }
            },
          });
        }

        Alert.alert(
          'Login Failed',
          [
            'Your account is authenticated, but it is not marked as an admin.',
            '',
            'Fix:',
            '1) In Supabase Dashboard -> Table Editor -> user_profiles -> set role = admin for this user',
            '2) Or use OTP login if you just need access temporarily',
            '',
            __DEV__ ? 'Dev option: use "Make Admin (Dev)" to promote via Edge Function.' : '',
          ]
            .filter(Boolean)
            .join('\n'),
          actions
        );
        return;
      }
      if (
        email.trim().toLowerCase() === 'admin@lexnart.com' &&
        (message.includes('Invalid login credentials') || message.includes('Default admin user not found'))
      ) {
        Alert.alert(
          'Login Failed',
          [
            'The admin user does not exist in this Supabase project yet (or the password is different).',
            '',
            'Fix:',
            '1) Supabase Dashboard -> Authentication -> Users -> confirm admin@lexnart.com exists',
            '2) If missing, create it using the service_role key (keep it private; do not commit it):',
            '   node scripts/create_admin.js "<SUPABASE_URL>" "<SERVICE_ROLE_KEY>" "admin@lexnart.com" "admin1234"',
            '   or: node scripts/create_admin.js "<SERVICE_ROLE_KEY>" "admin@lexnart.com" "admin1234" (if EXPO_PUBLIC_SUPABASE_URL is already in .env)',
            '   Note: replace <SERVICE_ROLE_KEY> with the real Supabase service_role key (not the anon key).',
            '3) Supabase Dashboard -> Table Editor -> user_profiles -> ensure role is "admin"',
          ].join('\n')
        );
        return;
      }

      Alert.alert('Login Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, otp, mode, loginAsAdmin, loginWithOtp, verifyOtp, router]);

  const handlePressIn = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  }, [buttonScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  }, [buttonScale]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <LinearGradient
        colors={['#0A0A0A', '#0D0D0D', '#0A0A0A']}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
            <View style={styles.shieldContainer}>
              <LinearGradient
                colors={[Colors.goldMuted, 'transparent']}
                style={styles.shieldGlow}
              />
              <Shield size={40} color={Colors.gold} />
            </View>

            <Text style={styles.title}>Admin Access</Text>
            <Text style={styles.subtitle}>
              {mode === 'otp-verify' ? 'Enter verification code' : 'Secure Admin Login'}
            </Text>

            <View style={styles.form}>
              {/* Email Field - Always visible */}
              <View style={styles.inputContainer}>
                <Mail size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Admin Email"
                  placeholderTextColor={Colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!isSubmitting}
                />
              </View>

              {/* Password Field - Only in password mode */}
              {mode === 'password' && (
                <View style={styles.inputContainer}>
                  <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={Colors.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!isSubmitting}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={Colors.textSecondary} />
                    ) : (
                      <Eye size={20} color={Colors.textSecondary} />
                    )}
                  </Pressable>
                </View>
              )}

              {/* OTP Field - Only in otp-verify mode */}
              {mode === 'otp-verify' && (
                <View style={styles.inputContainer}>
                  <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    ref={otpInputRef}
                    style={[styles.input, styles.otpInput]}
                    placeholder="000000"
                    placeholderTextColor={Colors.textSecondary}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!isSubmitting}
                  />
                </View>
              )}

              {/* Action Button */}
              <Pressable
                onPress={handleSubmit}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isSubmitting}
              >
                <Animated.View style={[styles.button, { transform: [{ scale: buttonScale }] }]}>
                  <LinearGradient
                    colors={[Colors.gold, Colors.goldMuted]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                  >
                    {isSubmitting ? (
                      <Text style={styles.buttonText}>Processing...</Text>
                    ) : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.buttonText}>
                          {mode === 'otp-request' ? 'Send Code' : 
                           mode === 'otp-verify' ? 'Verify Code' : 'Login'}
                        </Text>
                        <ArrowRight size={20} color="#000" />
                      </View>
                    )}
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              {/* Mode Switchers */}
              <View style={styles.footer}>
                {mode === 'password' ? (
                  <Pressable onPress={() => switchMode('otp-request')}>
                    <Text style={styles.linkText}>Login via OTP / Forgot Password?</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => switchMode('password')}>
                    <Text style={styles.linkText}>Back to Password Login</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => router.push('/admin/signup')}>
                  <Text style={styles.linkText}>Need an admin account? Sign Up</Text>
                </Pressable>
              </View>

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
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  content: {
    alignItems: 'center',
  },
  shieldContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  shieldGlow: {
    position: 'absolute' as const,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 36,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 14,
    gap: 12,
  },
  inputIcon: {
    marginRight: 0,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.white,
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
  },
  otpInput: {
    letterSpacing: 4,
    fontSize: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginTop: 20,
    width: '100%',
  },
  gradient: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 16,
  },
  linkText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '500',
  },
});
