import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Animated,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Mail from 'lucide-react-native/dist/esm/icons/mail';
import Lock from 'lucide-react-native/dist/esm/icons/lock';
import Eye from 'lucide-react-native/dist/esm/icons/eye';
import EyeOff from 'lucide-react-native/dist/esm/icons/eye-off';
import CheckCircle from 'lucide-react-native/dist/esm/icons/check-circle';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

type Step = 1 | 1.5 | 2;

function friendlyError(message: string): string {
  if (message.includes('Security purposes') || message.includes('rate limit')) {
    return 'Too many requests. Please wait 60 seconds and try again.';
  }
  if (message.includes('not found') || message.includes('No user found')) {
    return 'No account found with that email address.';
  }
  if (message.includes('Signup requires') || message.includes('confirm')) {
    return 'Please confirm your email address first.';
  }
  return message;
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [sessionVerified, setSessionVerified] = useState(false);

  // Step 1: email input
  const [email, setEmail] = useState('');

  // Step 1.5: confirmation (email sent)
  const [sentTo, setSentTo] = useState('');

  // Step 2: new password (only when mode=recovery via deep link)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [step]);

  // Recovery mode: verify a session exists before showing the password form
  useEffect(() => {
    if (mode !== 'recovery') return;

    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session) {
          setSessionVerified(true);
          setStep(2);
        } else {
          // No session — the link is invalid/expired
          Alert.alert(
            'Link Expired',
            'This reset link is invalid or has expired. Please request a new one.',
            [{ text: 'OK', onPress: () => router.replace('/login') }]
          );
        }
      } catch {
        if (!cancelled) {
          Alert.alert('Error', 'Something went wrong. Please try again.', [
            { text: 'OK', onPress: () => router.replace('/login') },
          ]);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [mode, router]);

  const handleSendResetEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: 'epix-visuals://reset-password' }
      );
      if (error) throw error;
      setSentTo(email.trim().toLowerCase());
      setStep(1.5);
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        sentTo,
        { redirectTo: 'epix-visuals://reset-password' }
      );
      if (error) throw error;
      Alert.alert('Sent', 'A new reset link has been sent to your email.');
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // Sign out so the app doesn't treat this as a regular login session
      await supabase.auth.signOut();

      Alert.alert('Success', 'Your password has been reset. Please log in with your new password.', [
        { text: 'Login', onPress: () => router.replace('/login') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  // Step 1: email input
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Forgot Password?</Text>
      <Text style={styles.subtitle}>Enter your email and we'll send you a reset link.</Text>

      <View style={styles.inputContainer}>
        <Mail size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={Colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus
        />
      </View>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSendResetEmail}
        disabled={loading}
      >
        <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.gradient}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
        </LinearGradient>
      </Pressable>
    </View>
  );

  // Step 1.5: email sent confirmation
  const renderStep1_5 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconCircle}>
        <Mail size={32} color={Colors.gold} />
      </View>
      <Text style={styles.title}>Check Your Email</Text>
      <Text style={styles.subtitle}>
        We've sent a password reset link to{'\n'}
        <Text style={styles.emailText}>{sentTo}</Text>
      </Text>
      <Text style={styles.hint}>
        Tap the link in the email to reset your password. The link expires in 1 hour.
      </Text>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleResendEmail}
        disabled={loading}
      >
        <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.gradient}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Resend Link</Text>}
        </LinearGradient>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => setStep(1)}
      >
        <Text style={styles.secondaryButtonText}>Use a different email</Text>
      </Pressable>
    </View>
  );

  // Step 2: set new password
  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconCircle}>
        <CheckCircle size={32} color={Colors.gold} />
      </View>
      <Text style={styles.title}>New Password</Text>
      <Text style={styles.subtitle}>Create a strong password.</Text>

      <View style={styles.inputGroup}>
        <View style={styles.inputContainer}>
          <Lock size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry={!showPassword}
            value={newPassword}
            onChangeText={setNewPassword}
            autoFocus
          />
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
          </Pressable>
        </View>

        <View style={styles.inputContainer}>
          <Lock size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry={!showPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>
      </View>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleResetPassword}
        disabled={loading || !sessionVerified}
      >
        <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.gradient}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Reset Password</Text>}
        </LinearGradient>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <LinearGradient
        colors={['#0A0A0A', '#111111', '#0A0A0A']}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.content}>
          <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
            {step === 1 && renderStep1()}
            {step === 1.5 && renderStep1_5()}
            {step === 2 && sessionVerified && renderStep2()}
          </Animated.View>

          <Pressable onPress={() => router.replace('/login')} style={styles.backLink}>
            <Text style={styles.backLinkText}>Back to Login</Text>
          </Pressable>
        </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  stepContainer: {
    gap: 20,
    width: '100%',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  emailText: {
    color: Colors.gold,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  inputGroup: {
    gap: 16,
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
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    marginLeft: 12,
  },
  button: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '500',
  },
  backLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  backLinkText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
