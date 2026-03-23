import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Animated, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking as NativeLinking } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';


WebBrowser.maybeCompleteAuthSession();

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

  useState(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  });

  const handleResendEmail = useCallback(async (emailToResend: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToResend,
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
      console.log('[Google Sign-In] Starting flow');

      if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
        Alert.alert('Google Sign-In', 'Google Sign-In works only in the installed mobile app.');
        setIsSubmitting(false);
        return;
      }

      // 1. Native-only redirect URI for Play Store app
      const redirectUrl = ExpoLinking.createURL('auth/callback');

      console.log('[Google Sign-In] redirectUrl:', redirectUrl);

      // 2. Start OAuth flow with Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) {
        console.error('[Google Sign-In] Supabase error:', error);
        throw error;
      }
      
      if (!data?.url) {
        console.error('[Google Sign-In] No URL returned from Supabase');
        throw new Error('Authentication URL missing from Supabase');
      }

      console.log('[Google Sign-In] Opening browser for:', data.url);

      if (Platform.OS === 'android') {
        await NativeLinking.openURL(data.url);
        setIsSubmitting(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        {
          showInRecents: true,
          dismissButtonStyle: 'cancel',
          createTask: false,
        }
      );

      console.log('[Google Sign-In] Browser result:', result.type);

      if (result.type === 'success' && result.url) {
        console.log('[Google Sign-In] Success! Redirecting to callback handler');
        // Navigate to the callback handler which extracts tokens and creates a session
        router.push({
          pathname: '/auth/callback',
          params: {
            url: result.url,
            provider: 'google',
          },
        });
      } else if (result.type === 'dismiss') {
        console.log('[Google Sign-In] User dismissed browser');
        setIsSubmitting(false);
      } else if (result.type === 'cancel') {
        console.log('[Google Sign-In] User cancelled');
        setIsSubmitting(false);
      } else {
        console.warn('[Google Sign-In] Unexpected result type:', result.type);
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error('[Google Sign-In] Error:', error?.message || error);
      setIsSubmitting(false);
      
      let errorMessage = error?.message || 'An error occurred during Google Sign-In';
      if (errorMessage.includes('developer_error')) {
        errorMessage = 'Configuration error: Ensure your Android Package Name and SHA-1 fingerprint are registered in Google Cloud Console for the EAS build.';
      }
      
      Alert.alert('Sign-In Failed', errorMessage);
    }
  }, [router]);


  const handleLogoTap = useCallback(() => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (newCount >= 3) {
      setTapCount(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/admin-login');
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <LinearGradient
        colors={['#0A0A0A', '#0F0F0F', '#0A0A0A']}
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
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <Pressable onPress={handleLogoTap} style={styles.logoArea}>
              <View style={styles.logoFrame}>
                <Text style={styles.logoIcon}>◈</Text>
              </View>
              <Text style={styles.logoText}>LENZ<Text style={styles.logoAccent}>ART</Text></Text>
              <Text style={styles.logoSubtitle}>P H O T O G R A P H Y</Text>
            </Pressable>

            <Text style={styles.welcomeText}>Welcome back</Text>
            <Text style={styles.welcomeSubtext}>Sign in to access your galleries</Text>

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

              <Pressable style={styles.forgotButton} onPress={() => router.push('/forgot-password' as any)}>
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

              <Pressable onPress={() => router.push('/signup')} style={{ marginTop: 20, alignItems: 'center' }}>
                  <Text style={{ color: Colors.textMuted }}>
                      {"Don't have an account? "}<Text style={{ color: Colors.gold, fontWeight: '600' }}>Sign Up</Text>
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
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    marginTop: 32,
  },
  trustText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
