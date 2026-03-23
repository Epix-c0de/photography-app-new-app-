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
  ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Phone, ArrowRight, Lock, Eye, EyeOff, KeyRound, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1 Data
  const [contact, setContact] = useState('');
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');

  // Step 2 Data
  const [otp, setOtp] = useState('');

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

  useEffect(() => {
    if (mode === 'recovery') {
      setContactType('email');
      setStep(3);
    }
  }, [mode]);

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
        Alert.alert('Code Sent', 'Check your email for the 6-digit verification code.');
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: normalizedContact });
        if (error) throw error;
        Alert.alert('Code Sent', 'Check your SMS for the code.');
      }
      setStep(2);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
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

      const { data, error } = await supabase.auth.verifyOtp(verifyParams);

      if (error) throw error;

      // If successful, we have a session.
      setStep(3);
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message);
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

      Alert.alert('Success', 'Your password has been reset.', [
        { text: 'Login', onPress: () => router.replace('/login') }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Forgot Password?</Text>
      <Text style={styles.subtitle}>Enter your email or phone to reset it.</Text>
      
      <View style={styles.inputContainer}>
        <Mail size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Email or Phone Number"
          placeholderTextColor={Colors.textMuted}
          value={contact}
          onChangeText={setContact}
          autoCapitalize="none"
        />
      </View>

      <Pressable style={styles.button} onPress={handleSendCode} disabled={loading}>
        <LinearGradient
          colors={[Colors.gold, Colors.goldDark]}
          style={styles.gradient}
        >
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Send Reset Code</Text>}
        </LinearGradient>
      </Pressable>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Verify Code</Text>
      <Text style={styles.subtitle}>Enter the code sent to {contact}</Text>

      <View style={styles.inputContainer}>
        <KeyRound size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="6-Digit Code"
          placeholderTextColor={Colors.textMuted}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
        />
      </View>

      <Pressable style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
        <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            style={styles.gradient}
        >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Verify Code</Text>}
        </LinearGradient>
      </Pressable>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
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

      <Pressable style={styles.button} onPress={handleResetPassword} disabled={loading}>
        <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            style={styles.gradient}
        >
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
                {step === 3 && renderStep3()}
            </Animated.View>

            <Pressable onPress={() => router.back()} style={styles.backLink}>
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
  backLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  backLinkText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
