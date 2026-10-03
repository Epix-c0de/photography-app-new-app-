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
import { Mail, Lock, Eye, EyeOff, KeyRound, CheckCircle, ArrowRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

function friendlyError(message: string): string {
  if (message.includes('Security purposes') || message.includes('rate limit')) {
    return 'Too many requests. Please wait 60 seconds and try again.';
  }
  if (message.includes('User not found') || message.includes('not found')) {
    return 'No account found with that email or phone number.';
  }
  if (message.includes('Invalid') && message.includes('code')) {
    return 'Invalid code. Please check and try again.';
  }
  if (message.includes('expired')) {
    return 'The code has expired. Please request a new one.';
  }
  return message;
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [sessionVerified, setSessionVerified] = useState(false);

  // Step 1 Data
  const [contact, setContact] = useState('');
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');

  // Step 2 Data
  const [otp, setOtp] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  // Step 3 Data
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

  // Recovery mode (deep link): verify session exists before showing password form
  useEffect(() => {
    if (mode !== 'recovery') return;

    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session) {
          setSessionVerified(true);
          setStep(3);
        } else {
          Alert.alert(
            'Link Expired',
            'This reset link is invalid or has expired. Please request a new one.',
            [{ text: 'OK', onPress: () => router.replace('/admin-login') }]
          );
        }
      } catch {
        if (!cancelled) {
          Alert.alert('Error', 'Something went wrong. Please try again.', [
            { text: 'OK', onPress: () => router.replace('/admin-login') },
          ]);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [mode, router]);

  const handleSendCode = async () => {
    if (!contact.trim()) {
      Alert.alert('Required', 'Please enter your email or phone number.');
      return;
    }

    setLoading(true);
    const isEmail = contact.includes('@');
    setContactType(isEmail ? 'email' : 'phone');
    const normalizedContact = contact.trim();

    try {
      if (isEmail) {
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedContact.toLowerCase(),
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: normalizedContact });
        if (error) throw error;
      }
      setOtp('');
      setStep(2);
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    try {
      if (contactType === 'email') {
        const { error } = await supabase.auth.signInWithOtp({
          email: contact.trim().toLowerCase(),
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: contact.trim() });
        if (error) throw error;
      }
      Alert.alert('Sent', 'A new code has been sent.');
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err.message));
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code.');
      return;
    }
    setLoading(true);

    try {
      const verifyParams: any = {
        token: otp,
        type: contactType === 'email' ? 'email' : 'sms',
      };

      if (contactType === 'email') {
        verifyParams.email = contact.trim().toLowerCase();
      } else {
        verifyParams.phone = contact.trim();
      }

      const { error } = await supabase.auth.verifyOtp(verifyParams);
      if (error) throw error;

      setSessionVerified(true);
      setStep(3);
    } catch (err: any) {
      Alert.alert('Verification Failed', friendlyError(err.message));
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
        { text: 'Login', onPress: () => router.replace('/admin-login') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconCircle}>
        <Mail size={32} color={Colors.gold} />
      </View>
      <Text style={styles.title}>Forgot Password?</Text>
      <Text style={styles.subtitle}>Enter your email or phone and we'll send you a code.</Text>

      <View style={styles.inputContainer}>
        <Mail size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Email or Phone Number"
          placeholderTextColor={Colors.textMuted}
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
          autoFocus
        />
      </View>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSendCode}
        disabled={loading}
      >
        <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.gradient}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Send Reset Code</Text>}
        </LinearGradient>
      </Pressable>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconCircle}>
        <KeyRound size={32} color={Colors.gold} />
      </View>
      <Text style={styles.title}>Verify Code</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to{'\n'}
        <Text style={styles.contactText}>{contact}</Text>
      </Text>

      <View style={styles.inputContainer}>
        <KeyRound size={20} color={Colors.textMuted} />
        <TextInput
          style={[styles.input, styles.otpInput]}
          placeholder="000000"
          placeholderTextColor={Colors.textMuted}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />
      </View>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerifyOtp}
        disabled={loading}
      >
        <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.gradient}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Verify Code</Text>}
        </LinearGradient>
      </Pressable>

      <Pressable
        style={[styles.resendButton, resendLoading && styles.buttonDisabled]}
        onPress={handleResendCode}
        disabled={resendLoading}
      >
        {resendLoading ? (
          <ActivityIndicator size="small" color={Colors.gold} />
        ) : (
          <Text style={styles.resendText}>Didn't get a code? Resend</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setStep(1)} style={styles.secondaryLink}>
        <Text style={styles.secondaryLinkText}>Use a different email/phone</Text>
      </Pressable>
    </View>
  );

  const renderStep3 = () => (
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
          <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
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
            {step === 2 && renderStep2()}
            {step === 3 && sessionVerified && renderStep3()}
          </Animated.View>

          <Pressable onPress={() => router.replace('/admin-login')} style={styles.backLink}>
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
  contactText: {
    color: Colors.gold,
    fontWeight: '600',
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
  otpInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
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
  resendButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  secondaryLinkText: {
    color: Colors.textMuted,
    fontSize: 13,
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
