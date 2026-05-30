import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Animated, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking as NativeLinking, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Fingerprint } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';


WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { login, enableDemoMode } = useAuth();
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

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    
    // Check if biometrics are available and we have a saved email
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
  }, []);

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
        // We'd ideally use the saved token here with Supabase, 
        // but for now we'll check if session is still valid or trigger a magic link
        const token = await AsyncStorage.getItem('saved_login_token');
        if (token) {
           const { data, error } = await supabase.auth.getUser(token);
           if (!error && data?.user) {
             router.replace('/(tabs)/home');
             return;
           }
        }
        
        // If no token or invalid, fallback to normal auth prompt or error
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
      
      // Save credentials for biometrics
      if (hasBiometrics) {
        await AsyncStorage.setItem('saved_login_email', email);
        const session = await supabase.auth.getSession();
        if (session.data.session?.access_token) {
          await AsyncStorage.setItem('saved_login_token', session.data.session.access_token);
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
      console.log('[Google Sign-In] Starting flow with IdToken');

      if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
        Alert.alert('Google Sign-In', 'Google Sign-In works only in the installed mobile app.');
        setIsSubmitting(false);
        return;
      }

      // Check if Google Client ID is configured
      const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        throw new Error('Google Client ID is not configured. Please check your environment variables.');
      }

      const redirectUrl = ExpoLinking.createURL('auth/callback');
      console.log('[Google Sign-In] redirectUrl:', redirectUrl);

      // Create a random nonce for security
      const nonce = Crypto.getRandomBytesAsync(16).then(bytes => 
        Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
      );
      const nonceString = await nonce;

      // Configure the auth request
      const request = new AuthSession.AuthRequest({
        clientId: googleClientId,
        scopes: ['openid', 'profile', 'email'],
        redirectUri: redirectUrl,
        responseType: AuthSession.ResponseType.IdToken,
        extraParams: {
          nonce: nonceString,
          prompt: 'select_account',
        },
      });

      const result = await request.promptAsync({});

      console.log('[Google Sign-In] Auth result type:', result.type);

      if (result.type === 'success') {
        const { params } = result;
        const idToken = params.id_token;

        if (!idToken) {
          throw new Error('No ID token received from Google');
        }

        console.log('[Google Sign-In] ID token received, signing in with Supabase');

        // Sign in with Supabase using the ID token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          nonce: nonceString,
        });

        if (error) {
          console.error('[Google Sign-In] Supabase sign-in error:', error);
          throw error;
        }

        console.log('[Google Sign-In] Success! User signed in:', data.user?.email);
        
        // Navigate to home screen on successful sign-in
        router.replace('/(tabs)/home');
        
      } else if (result.type === 'dismiss') {
        console.log('[Google Sign-In] User dismissed browser');
      } else if (result.type === 'cancel') {
        console.log('[Google Sign-In] User cancelled');
      } else {
        console.warn('[Google Sign-In] Unexpected result type:', result.type);
        throw new Error('Authentication was cancelled or failed');
      }
    } catch (error: any) {
      console.error('[Google Sign-In] Error:', error?.message || error);
      
      let errorMessage = error?.message || 'An error occurred during Google Sign-In';
      if (errorMessage.includes('developer_error')) {
        errorMessage = 'Configuration error: Ensure your Android Package Name and SHA-1 fingerprint are registered in Google Cloud Console for the EAS build.';
      } else if (errorMessage.includes('EXPO_PUBLIC_GOOGLE_CLIENT_ID')) {
        errorMessage = 'Google Sign-In is not properly configured. Please contact support.';
      }
      
      Alert.alert('Sign-In Failed', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [router]);

  const handleDemoLogin = useCallback(async () => {
    try {
      setIsSubmitting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await enableDemoMode();
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Demo Mode Error', error?.message || 'Failed to enable demo mode.');
    } finally {
      setIsSubmitting(false);
    }
  }, [enableDemoMode, router]);


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
      source={{ uri: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=1000&auto=format&fit=crop' }}
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

              <Pressable
                onPress={handleDemoLogin}
                style={styles.demoButton}
                disabled={isSubmitting}
              >
                <Text style={styles.demoButtonText}>Continue in Demo Mode</Text>
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
  demoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    marginTop: -8,
    marginBottom: 20,
  },
  demoButtonText: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: '700' as const,
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
