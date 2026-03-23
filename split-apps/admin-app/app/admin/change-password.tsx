import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Pressable, 
  Animated, 
  StatusBar, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Alert,
  Dimensions 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle,
  XCircle,
  Key,
  AlertTriangle
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import Colors from '@/constants/colors';

const { width } = Dimensions.get('window');

export default function AdminChangePasswordScreen() {
  const router = useRouter();
  const { changePassword, logout } = useAdminAuth();
  
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [passwordStrength, setPasswordStrength] = useState<{
    hasLength: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  }>({
    hasLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });
  
  const buttonScale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const errorShake = useRef(new Animated.Value(0)).current;
  
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Check password strength
  const checkPasswordStrength = useCallback((password: string) => {
    setPasswordStrength({
      hasLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  }, []);

  // Animation for error shake
  const animateError = useCallback(() => {
    errorShake.setValue(0);
    Animated.sequence([
      Animated.timing(errorShake, { 
        toValue: 10, 
        duration: 50, 
        useNativeDriver: true 
      }),
      Animated.timing(errorShake, { 
        toValue: -10, 
        duration: 50, 
        useNativeDriver: true 
      }),
      Animated.timing(errorShake, { 
        toValue: 10, 
        duration: 50, 
        useNativeDriver: true 
      }),
      Animated.timing(errorShake, { 
        toValue: 0, 
        duration: 50, 
        useNativeDriver: true 
      }),
    ]).start();
  }, [errorShake]);

  // Button press animation
  const animateButtonPress = useCallback(() => {
    Animated.sequence([
      Animated.timing(buttonScale, { 
        toValue: 0.95, 
        duration: 100, 
        useNativeDriver: true 
      }),
      Animated.timing(buttonScale, { 
        toValue: 1, 
        duration: 100, 
        useNativeDriver: true 
      }),
    ]).start();
  }, [buttonScale]);

  useEffect(() => {
    // Fade in animation
    Animated.timing(contentOpacity, { 
      toValue: 1, 
      duration: 800, 
      useNativeDriver: true 
    }).start();
  }, [contentOpacity]);

  // Handle password change
  const handlePasswordChange = useCallback(async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      animateError();
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      animateError();
      return;
    }

    // Check password strength
    const isStrong = Object.values(passwordStrength).every(Boolean);
    if (!isStrong) {
      setError('Password does not meet strength requirements');
      animateError();
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await changePassword(currentPassword, newPassword);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Password Changed',
        'Your password has been updated successfully. You will be redirected to the admin dashboard.',
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/(admin)/dashboard')
          }
        ]
      );
      
    } catch (error: any) {
      console.error('Password change error:', error);
      setError(error.message || 'Failed to change password');
      animateError();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentPassword, newPassword, confirmPassword, passwordStrength, changePassword, router, animateError]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/admin-login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [logout, router]);

  const translateX = errorShake.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  const isPasswordValid = Object.values(passwordStrength).every(Boolean);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Shield size={48} color="#f59e0b" />
                <AlertTriangle size={24} color="#f59e0b" style={styles.warningIcon} />
              </View>
              
              <Text style={styles.title}>Security Update Required</Text>
              <Text style={styles.subtitle}>
                You must change your password before accessing the admin dashboard
              </Text>
            </View>

            {/* Error Message */}
            {error ? (
              <Animated.View 
                style={[
                  styles.errorContainer, 
                  { transform: [{ translateX }] }
                ]}
              >
                <XCircle size={18} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            {/* Password Form */}
            <View style={styles.form}>
              {/* Current Password */}
              <View style={styles.inputContainer}>
                <Lock size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Current Password"
                  placeholderTextColor="#64748b"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => newPasswordRef.current?.focus()}
                  editable={!isSubmitting}
                />
                <Pressable 
                  style={styles.eyeIcon}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  hitSlop={10}
                >
                  {showCurrentPassword ? (
                    <EyeOff size={20} color="#64748b" />
                  ) : (
                    <Eye size={20} color="#64748b" />
                  )}
                </Pressable>
              </View>

              {/* New Password */}
              <View style={styles.inputContainer}>
                <Key size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  ref={newPasswordRef}
                  style={styles.input}
                  placeholder="New Password"
                  placeholderTextColor="#64748b"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    checkPasswordStrength(text);
                  }}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  editable={!isSubmitting}
                />
                <Pressable 
                  style={styles.eyeIcon}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  hitSlop={10}
                >
                  {showNewPassword ? (
                    <EyeOff size={20} color="#64748b" />
                  ) : (
                    <Eye size={20} color="#64748b" />
                  )}
                </Pressable>
              </View>

              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <Text style={styles.strengthTitle}>Password Requirements:</Text>
                  <View style={styles.requirementRow}>
                    {passwordStrength.hasLength ? (
                      <CheckCircle size={16} color="#22c55e" />
                    ) : (
                      <XCircle size={16} color="#ef4444" />
                    )}
                    <Text style={styles.requirementText}>At least 8 characters</Text>
                  </View>
                  <View style={styles.requirementRow}>
                    {passwordStrength.hasUpperCase ? (
                      <CheckCircle size={16} color="#22c55e" />
                    ) : (
                      <XCircle size={16} color="#ef4444" />
                    )}
                    <Text style={styles.requirementText}>One uppercase letter</Text>
                  </View>
                  <View style={styles.requirementRow}>
                    {passwordStrength.hasLowerCase ? (
                      <CheckCircle size={16} color="#22c55e" />
                    ) : (
                      <XCircle size={16} color="#ef4444" />
                    )}
                    <Text style={styles.requirementText}>One lowercase letter</Text>
                  </View>
                  <View style={styles.requirementRow}>
                    {passwordStrength.hasNumber ? (
                      <CheckCircle size={16} color="#22c55e" />
                    ) : (
                      <XCircle size={16} color="#ef4444" />
                    )}
                    <Text style={styles.requirementText}>One number</Text>
                  </View>
                  <View style={styles.requirementRow}>
                    {passwordStrength.hasSpecialChar ? (
                      <CheckCircle size={16} color="#22c55e" />
                    ) : (
                      <XCircle size={16} color="#ef4444" />
                    )}
                    <Text style={styles.requirementText}>One special character</Text>
                  </View>
                </View>
              )}

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Lock size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.input}
                  placeholder="Confirm New Password"
                  placeholderTextColor="#64748b"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handlePasswordChange}
                  editable={!isSubmitting}
                />
                <Pressable 
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={10}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color="#64748b" />
                  ) : (
                    <Eye size={20} color="#64748b" />
                  )}
                </Pressable>
              </View>

              {/* Password Match Indicator */}
              {confirmPassword.length > 0 && (
                <View style={styles.matchContainer}>
                  {passwordsMatch ? (
                    <CheckCircle size={16} color="#22c55e" />
                  ) : (
                    <XCircle size={16} color="#ef4444" />
                  )}
                  <Text style={[
                    styles.matchText,
                    passwordsMatch ? styles.matchSuccess : styles.matchError
                  ]}>
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <Pressable
                  style={[
                    styles.submitButton,
                    (!isPasswordValid || !passwordsMatch || isSubmitting) && styles.submitButtonDisabled
                  ]}
                  onPress={handlePasswordChange}
                  onPressIn={animateButtonPress}
                  disabled={!isPasswordValid || !passwordsMatch || isSubmitting}
                >
                  {isSubmitting ? (
                    <Text style={styles.submitButtonText}>Updating...</Text>
                  ) : (
                    <>
                      <Text style={styles.submitButtonText}>Update Password</Text>
                      <ArrowRight size={20} color="#fff" />
                    </>
                  )}
                </Pressable>
              </Animated.View>

              {/* Logout Option */}
              <Pressable
                style={styles.logoutButton}
                onPress={handleLogout}
                disabled={isSubmitting}
              >
                <Text style={styles.logoutText}>Logout Instead</Text>
              </Pressable>

              {/* Security Note */}
              <View style={styles.securityNote}>
                <Shield size={14} color="#4ade80" />
                <Text style={styles.securityText}>
                  For security reasons, you must change your password on first login
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  warningIcon: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    color: '#b91c1c',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    color: '#fff',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  strengthContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  strengthTitle: {
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
    fontSize: 14,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  requirementText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  matchText: {
    fontSize: 13,
    fontWeight: '500',
  },
  matchSuccess: {
    color: '#22c55e',
  },
  matchError: {
    color: '#ef4444',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    height: 56,
    marginBottom: 16,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
  },
  logoutText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#065f46',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    gap: 6,
  },
  securityText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
