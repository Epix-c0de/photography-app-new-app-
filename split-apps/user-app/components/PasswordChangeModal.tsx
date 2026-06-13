// Task 16.1: Password Change Modal for user app
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Eye, EyeOff, Lock, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

interface PasswordChangeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PasswordChangeModal({
  visible,
  onClose,
  onSuccess,
}: PasswordChangeModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Password validation
  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('At least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('One uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('One number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  const passwordValidation = validatePassword(newPassword);

  const handleSubmit = async () => {
    // Reset errors
    setErrors({});

    // Validate all fields
    const newErrors: typeof errors = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = 'New password is required';
    } else {
      const validation = validatePassword(newPassword);
      if (!validation.valid) {
        newErrors.newPassword = `Password must have: ${validation.errors.join(', ')}`;
      }
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!user?.email) {
      Alert.alert('Error', 'User email not found. Please log in again.');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Step 1: Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setErrors({ currentPassword: 'Incorrect current password' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setSubmitting(false);
        return;
      }

      // Step 2: Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error('[PasswordChangeModal] Update error:', updateError);
        Alert.alert('Error', updateError.message || 'Failed to update password');
        setSubmitting(false);
        return;
      }

      // Step 3: Log password change to audit log
      try {
        await supabase.from('admin_audit_log').insert({
          admin_id: user.id,
          action: 'password_changed',
          entity_type: 'user_profile',
          entity_id: user.id,
          changes: { password_changed: true },
          created_at: new Date().toISOString(),
        });
      } catch (logError) {
        console.warn('[PasswordChangeModal] Audit log error:', logError);
        // Don't fail the operation if audit logging fails
      }

      // Success!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Password Updated',
        'Your password has been changed successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              onSuccess();
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('[PasswordChangeModal] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    
    // Reset form
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                <Lock size={24} color={Colors.gold} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.title}>Change Password</Text>
                <Text style={styles.subtitle}>Update your account password</Text>
              </View>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton} disabled={submitting}>
              <X size={24} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {/* Form */}
          <ScrollView
            style={styles.form}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Current Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Current Password</Text>
              <View style={[styles.inputContainer, errors.currentPassword && styles.inputContainerError]}>
                <Lock size={20} color={Colors.textMuted} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={(text) => {
                    setCurrentPassword(text);
                    if (errors.currentPassword) {
                      setErrors((prev) => ({ ...prev, currentPassword: undefined }));
                    }
                  }}
                  placeholder="Enter current password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting}
                />
                <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                  {showCurrentPassword ? (
                    <EyeOff size={20} color={Colors.textMuted} />
                  ) : (
                    <Eye size={20} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>
              {errors.currentPassword && (
                <Text style={styles.errorText}>{errors.currentPassword}</Text>
              )}
            </View>

            {/* New Password */}
            <View style={styles.field}>
              <Text style={styles.label}>New Password</Text>
              <View style={[styles.inputContainer, errors.newPassword && styles.inputContainerError]}>
                <Lock size={20} color={Colors.textMuted} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (errors.newPassword) {
                      setErrors((prev) => ({ ...prev, newPassword: undefined }));
                    }
                  }}
                  placeholder="Enter new password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting}
                />
                <Pressable onPress={() => setShowNewPassword(!showNewPassword)}>
                  {showNewPassword ? (
                    <EyeOff size={20} color={Colors.textMuted} />
                  ) : (
                    <Eye size={20} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>
              {errors.newPassword && (
                <Text style={styles.errorText}>{errors.newPassword}</Text>
              )}
              
              {/* Password Requirements */}
              {newPassword.length > 0 && (
                <View style={styles.requirements}>
                  <RequirementRow
                    text="At least 8 characters"
                    met={newPassword.length >= 8}
                  />
                  <RequirementRow
                    text="One uppercase letter"
                    met={/[A-Z]/.test(newPassword)}
                  />
                  <RequirementRow
                    text="One number"
                    met={/[0-9]/.test(newPassword)}
                  />
                </View>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={[styles.inputContainer, errors.confirmPassword && styles.inputContainerError]}>
                <Lock size={20} color={Colors.textMuted} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  placeholder="Re-enter new password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting}
                />
                <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={Colors.textMuted} />
                  ) : (
                    <Eye size={20} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            {/* Submit Button */}
            <Pressable
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Text style={styles.submitButtonText}>Change Password</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RequirementRow({ text, met }: { text: string; met: boolean }) {
  return (
    <View style={styles.requirement}>
      <View style={[styles.requirementIcon, met && styles.requirementIconMet]}>
        {met && <Check size={12} color={Colors.success} strokeWidth={3} />}
      </View>
      <Text style={[styles.requirementText, met && styles.requirementTextMet]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  closeButton: {
    padding: 8,
  },
  form: {
    paddingHorizontal: 24,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputContainerError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.white,
    marginHorizontal: 12,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 8,
  },
  requirements: {
    marginTop: 12,
    gap: 8,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requirementIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  requirementIconMet: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '20',
  },
  requirementText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  requirementTextMet: {
    color: Colors.success,
  },
  submitButton: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.background,
  },
});
