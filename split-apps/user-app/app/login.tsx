import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Animated, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert, ImageBackground, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Fingerprint, Phone, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = '767341239944-cudtttstl53ojun1od4jrdof1ddmvj4.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '767341239944-t52927a5reph33862jg2ksrjn1m79fp3.apps.googleusercontent.com';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [tapCount, setTapCount] = useState<number>(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [hasBiometrics, setHasBiometrics] = useState<boolean>(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState('https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=1000&auto=format&fit=crop');
  const [loginTagline, setLoginTagline] = useState('Every moment deserves to be captured beautifully.');

  // Phone collection state
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<any>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);

  // Google OAuth request
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setHasBiometrics(compatible && enrolled);

      const email = await AsyncStorage.getItem('saved_login_email');
      const token = await AsyncStorage.getItem('saved_login_token');
      if (email && token && compatible && enrolled) {
        setSavedEmail(email);
        setEmail(email);
      }
    })();

    (async () => {
      try {
        const { data } = await supabase
          .from('screen_settings')
          .select('login_background_image, login_tagline')
          .eq('id', 'default')
          .maybeSingle();
        if (data) {
          if (data.login_background_image) setBgImage(data.login_background_image);
          if (data.login_tagline) setLoginTagline(data.login_tagline);
        }
      } catch {}
    })();
  }, []);

  // Handle Google OAuth response
  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type === 'success') {
      const { id_token } = googleResponse.authentication as any;
      handleGoogleIdToken(id_token);
    } else if (googleResponse.type === 'error') {
      console.error('[Google Sign-In] Error:', googleResponse.error);
      Alert.alert('Sign-In Failed', googleResponse.error?.message || 'Google Sign-In failed. Please try again.');
      setIsSubmitting(false);
    } else if (googleResponse.type === 'cancel' || googleResponse.type === 'dismiss') {
      console.log('[Google Sign-In] User cancelled');
      setIsSubmitting(false);
    }
  }, [googleResponse]);

  const handleGoogleIdToken = async (idToken: string) => {
    try {
      console.log('[Google Sign-In] Exchanging ID token with Supabase');
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;

      console.log('[Google Sign-In] Success! User:', data.user?.email);

      // Check if user has phone number — prompt collection for new users
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('phone, profile_complete')
        .eq('id', data.user!.id)
        .maybeSingle();

      if (!profile?.phone) {
        setPendingGoogleUser(data.user);
        setPhoneInput('');
        setShowPhoneModal(true);
        setIsSubmitting(false);
        return;
      }

      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error('[Google Sign-In] Exchange error:', error?.message || error);
      Alert.alert('Sign-In Failed', error?.message || 'Failed to complete Google Sign-In. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleSavePhone = async () => {
    if (!pendingGoogleUser?.id) {
      Alert.alert('Error', 'Session expired. Please sign in again.');
      setShowPhoneModal(false);
      return;
    }

    const cleaned = phoneInput.replace(/\D/g, '');
    if (cleaned.length < 9) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (at least 9 digits).');
      return;
    }

    setPhoneSaving(true);
    try {
      // Convert local format (0712...) to international (+254712...)
      let fullPhone = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
      if (fullPhone.startsWith('+0')) {
        fullPhone = '+254' + fullPhone.slice(2);
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({ phone: fullPhone })
        .eq('id', pendingGoogleUser.id);

      if (error) throw error;

      setShowPhoneModal(false);
      setPendingGoogleUser(null);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save phone number.');
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!hasBiometrics) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to sign in',
        fallbackLabel: 'Use password',
      });

      if (result.success) {
        setIsSubmitting(true);
        const accessToken = await AsyncStorage.getItem('saved_login_token');
        const refreshToken = await AsyncStorage.getItem('saved_refresh_token');
        if (accessToken && refreshToken) {
          // Restore the full Supabase session
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            router.replace('/(tabs)/home');
            return;
          }
        }

        Alert.alert('Session Expired', 'Please sign in with your password once to re-enable FaceID/TouchID.');
        setIsSubmitting(false);
      }
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = useCallback(async (emailToResend: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToResend,
        options: {
          emailRedirectTo: 'epix-visuals://auth/callback',
        },
      });
      if (error) throw error;
      Alert.alert('Email Sent', 'Confirmation email has been resent. Please check your inbox and spam folder.');
    } catch (error: any) {
      console.error('Resend Error:', error);
      Alert.alert('Error', error?.message || 'Failed to resend confirmation email.');
    }
  }, []);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password to continue.');
      return;
    }
    console.log('[Login] Attempting login for:', email);
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await login(email, password);

      if (hasBiometrics) {
        await AsyncStorage.setItem('saved_login_email', email);
        const session = await supabase.auth.getSession();
        if (session.data.session?.access_token) {
          await AsyncStorage.setItem('saved_login_token', session.data.session.access_token);
        }
        if (session.data.session?.refresh_token) {
          await AsyncStorage.setItem('saved_refresh_token', session.data.session.refresh_token);
        }
      }

      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error('[Login] Error:', error);
      let message = error?.message || 'Check your email or password and try again.';

      if (message.toLowerCase().includes('email not confirmed')) {
        Alert.alert(
          'Email Not Confirmed',
          'Please confirm your email address before logging in. Check your inbox.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Resend Email', onPress: () => handleResendEmail(email) }
          ]
        );
        return;
      } else if (message.toLowerCase().includes('invalid login credentials')) {
        message = 'Invalid email or password.';
      }

      Alert.alert('Login Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, login, router, handleResendEmail]);

  const handleGoogleLogin = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsSubmitting(true);
      console.log('[Google Sign-In] Starting via expo-auth-session/providers/google');
      await googlePromptAsync();
    } catch (error: any) {
      console.error('[Google Sign-In] Error:', error?.message || error);
      Alert.alert('Sign-In Failed', error?.message || 'An error occurred during Google Sign-In');
      setIsSubmitting(false);
    }
  }, [googlePromptAsync]);

  const handleLogoTap = useCallback(() => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (newCount >= 3) {
      setTapCount(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(admin)/dashboard' as any);
      return;
    }
    tapTimerRef.current = setTimeout(() => setTapCount(0), 800);
  }, [tapCount, router]);

  const handlePressIn = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  }, [buttonScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  }, [buttonScale]);

  return (
    <ImageBackground
      source={{ uri: bgImage }}
      style={styles.container}
      blurRadius={Platform.OS === 'ios' ? 8 : 4}
    >
      <LinearGradient
        colors={['rgba(10,10,12,0.4)', 'rgba(10,10,12,0.95)', Colors.background]}
        style={StyleSheet.absoluteFillObject}
      />
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <Pressable onPress={handleLogoTap} style={styles.logoArea}>
              <View style={styles.logoFrame}>
                <Text style={styles.logoIcon}>◈</Text>
              </View>
              <Text style={styles.logoText}>EPIX<Text style={styles.logoAccent}>VISUALS</Text></Text>
              <Text style={styles.logoSubtitle}>P H O T O G R A P H Y</Text>
            </Pressable>

            <Text style={styles.welcomeText}>Welcome back</Text>
            <Text style={styles.welcomeSubtext}>{loginTagline || 'Sign in to access your galleries'}</Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Mail size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Email or phone number"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="login-email"
                />
              </View>

              <View style={styles.inputContainer}>
                <Lock size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  testID="login-password"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  {showPassword ? <EyeOff size={18} color={Colors.textMuted} /> : <Eye size={18} color={Colors.textMuted} />}
                </Pressable>
              </View>

              <Pressable style={styles.forgotButton} onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>

              <Pressable
                onPress={handleLogin}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isSubmitting}
              >
                <Animated.View style={[styles.loginButton, { transform: [{ scale: buttonScale }] }]}>
                  <LinearGradient
                    colors={[Colors.gold, Colors.goldDark]}
                    style={styles.loginButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.loginButtonText}>{isSubmitting ? 'Signing in...' : 'Sign In'}</Text>
                    {!isSubmitting && <ArrowRight size={18} color={Colors.background} />}
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              {hasBiometrics && savedEmail && (
                <Pressable onPress={handleBiometricLogin} style={styles.biometricButton}>
                  <Fingerprint size={24} color={Colors.gold} />
                  <Text style={styles.biometricText}>Sign in with Biometrics</Text>
                </Pressable>
              )}

              <Pressable onPress={() => router.push('/signup')} style={{ marginTop: 20, alignItems: 'center' }}>
                  <Text style={{ color: Colors.textMuted }}>
                      {"Don't have an account? "}<Text style={{ color: Colors.gold, fontWeight: '600' }}>Sign up</Text>
                  </Text>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <Pressable style={styles.socialButton} onPress={handleGoogleLogin}>
                  <Text style={styles.socialIcon}>G</Text>
                  <Text style={styles.socialButtonText}>Google</Text>
                </Pressable>
                <Pressable style={styles.socialButton} onPress={() => Alert.alert('Coming Soon', 'Apple Sign-In is coming soon.')}>
                  <Text style={styles.socialIcon}></Text>
                  <Text style={styles.socialButtonText}>Apple</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.trustRow}>
              <Lock size={12} color={Colors.textMuted} />
              <Text style={styles.trustText}>Your photos are private and secure</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Phone Collection Modal */}
      <Modal visible={showPhoneModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable onPress={() => { setShowPhoneModal(false); setPendingGoogleUser(null); }} style={styles.modalClose}>
              <X size={20} color={Colors.textMuted} />
            </Pressable>
            <Phone size={40} color={Colors.gold} style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={styles.modalTitle}>Add Your Phone Number</Text>
            <Text style={styles.modalSubtitle}>We need your phone number to connect you with your photographer.</Text>

            <View style={styles.modalInputContainer}>
              <Phone size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.modalInput}
                placeholder="+254712345678"
                placeholderTextColor={Colors.textMuted}
                value={phoneInput}
                onChangeText={setPhoneInput}
                keyboardType="phone-pad"
                autoFocus
              />
            </View>

            <Pressable style={styles.modalButton} onPress={handleSavePhone} disabled={phoneSaving}>
              <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.modalButtonGradient}>
                {phoneSaving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.modalButtonText}>Continue</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => { setShowPhoneModal(false); setPendingGoogleUser(null); router.replace('/(tabs)/home'); }} style={styles.modalSkip}>
              <Text style={styles.modalSkipText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ImageBackground>
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
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoFrame: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 26,
    color: Colors.gold,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '200' as const,
    color: Colors.white,
    letterSpacing: 10,
  },
  logoAccent: {
    color: Colors.gold,
    fontWeight: '600' as const,
  },
  logoSubtitle: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 5,
    marginTop: 6,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 6,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 32,
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
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.white,
  },
  forgotButton: {
    alignSelf: 'flex-end' as const,
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    color: Colors.gold,
  },
  loginButton: {
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginBottom: 24,
  },
  loginButtonGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: -10,
    marginBottom: 20,
  },
  biometricText: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  dividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  socialRow: {
    flexDirection: 'row' as const,
    gap: 14,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  socialIcon: {
    fontSize: 18,
    color: Colors.white,
    fontWeight: '600' as const,
  },
  socialButtonText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 32,
  },
  trustText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 20,
    gap: 12,
  },
  modalInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.white,
  },
  modalButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  modalButtonGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  modalSkip: {
    alignItems: 'center',
    padding: 8,
  },
  modalSkipText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
