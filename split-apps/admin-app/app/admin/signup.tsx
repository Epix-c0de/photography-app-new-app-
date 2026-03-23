import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Animated, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, User, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

export default function AdminSignupScreen() {
  const router = useRouter();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [contentOpacity]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your admin email.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Missing Phone', 'Please enter your phone number.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Missing Password', 'Please enter a password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords Don\'t Match', 'Please confirm your password correctly.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            role: 'admin',
            name: name.trim(),
            phone: phone.trim(),
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Profile is created automatically by the database trigger
        // No need to upsert here - the trigger handles it with security definer
        console.log('Admin user created:', authData.user.id, '- Profile will be created by trigger');

        if (!authData.session) {
          Alert.alert(
            'Check Your Email',
            'Your admin account was created, but you must confirm your email before password login.\n\nUse the confirmation email link, then return here to log in.',
            [{ text: 'Go to Login', onPress: () => router.replace('/admin-login') }]
          );
        } else {
          Alert.alert(
            'Admin Account Created!',
            'Your admin account has been created successfully. You can now log in.',
            [{ text: 'Go to Login', onPress: () => router.replace('/admin-login') }]
          );
        }
      }
    } catch (error: any) {
      console.error('Admin signup error:', error);
      const message = typeof error?.message === 'string' ? error.message : 'An error occurred during signup.';
      Alert.alert('Signup Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [name, email, phone, password, confirmPassword, router]);

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

            <Text style={styles.title}>Admin Registration</Text>
            <Text style={styles.subtitle}>Create Admin Account</Text>

            <View style={styles.form}>
              {/* Name Field */}
              <View style={styles.inputContainer}>
                <User size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={Colors.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!isSubmitting}
                />
              </View>

              {/* Email Field */}
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

              {/* Phone Field */}
              <View style={styles.inputContainer}>
                <Phone size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number"
                  placeholderTextColor={Colors.textSecondary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!isSubmitting}
                />
              </View>

              {/* Password Field */}
              <View style={styles.inputContainer}>
                <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password (min 6 characters)"
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

              {/* Confirm Password Field */}
              <View style={styles.inputContainer}>
                <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={Colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  editable={!isSubmitting}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={Colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={Colors.textSecondary} />
                  )}
                </Pressable>
              </View>

              {/* Sign Up Button */}
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
                      <Text style={styles.buttonText}>Creating Account...</Text>
                    ) : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.buttonText}>Create Admin Account</Text>
                        <ArrowRight size={20} color="#000" />
                      </View>
                    )}
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              {/* Navigation to Login */}
              <View style={styles.footer}>
                <Pressable onPress={() => router.replace('/admin-login')}>
                  <Text style={styles.linkText}>Already have an account? Login</Text>
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
