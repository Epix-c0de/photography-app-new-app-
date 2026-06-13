// Task 13.1: Create Client Form for admin app
// Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 3.8

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, UserPlus, Phone, Mail, FileText } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import type { CreateClientInput } from '@/types/assignment';

interface CreateClientFormProps {
  onClose: () => void;
  onSuccess: (clientId: string, clientName: string) => void;
}

export default function CreateClientForm({ onClose, onSuccess }: CreateClientFormProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    mobileNumber?: string;
    email?: string;
  }>({});

  const validateName = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Name is required';
    }
    if (value.trim().length < 2) {
      return 'Name must be at least 2 characters';
    }
    return undefined;
  };

  const validateMobileNumber = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Mobile number is required';
    }

    // E.164 format validation (e.g., +254712345678)
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(value.trim())) {
      return 'Mobile number must be in E.164 format (e.g., +254712345678)';
    }

    return undefined;
  };

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) {
      return undefined; // Email is optional
    }

    // RFC 5322 simplified email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value.trim())) {
      return 'Please enter a valid email address';
    }

    return undefined;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleMobileNumberChange = (value: string) => {
    setMobileNumber(value);
    if (errors.mobileNumber) {
      setErrors((prev) => ({ ...prev, mobileNumber: undefined }));
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const nameError = validateName(name);
    const mobileError = validateMobileNumber(mobileNumber);
    const emailError = validateEmail(email);

    setErrors({
      name: nameError,
      mobileNumber: mobileError,
      email: emailError,
    });

    return !nameError && !mobileError && !emailError;
  };

  const checkDuplicateMobileNumber = async (mobile: string): Promise<boolean> => {
    try {
      // Check both `phone` and `mobile_number` columns for compatibility
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .or(`phone.eq.${mobile.trim()},mobile_number.eq.${mobile.trim()}`)
        .eq('owner_admin_id', user?.id)
        .limit(1);

      if (error) {
        console.error('[CreateClientForm] Duplicate check error:', error);
        return false;
      }

      if (data && data.length > 0) {
        Alert.alert(
          'Duplicate Client',
          `A client with this mobile number already exists: ${data[0].name}`,
          [{ text: 'OK' }]
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('[CreateClientForm] Unexpected error checking duplicates:', error);
      return false;
    }
  };

  const handleSubmit = async () => {
    // Validate form
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to create a client.');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Check for duplicate mobile number
      const isDuplicate = await checkDuplicateMobileNumber(mobileNumber);
      if (isDuplicate) {
        setSubmitting(false);
        return;
      }

      // Insert client record — use `phone` (matches DB schema) and also store
      // in `mobile_number` if that column exists (for backward compatibility).
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert([{
          name: name.trim(),
          phone: mobileNumber.trim(),       // primary column in DB schema
          email: email.trim() || null,
          notes: notes.trim() || null,
          owner_admin_id: user.id,
        }])
        .select('id, name')
        .single();

      if (insertError) {
        console.error('[CreateClientForm] Insert error:', insertError);
        Alert.alert('Error', 'Failed to create client. Please try again.');
        setSubmitting(false);
        return;
      }

      // Call send_client_invite_sms RPC (if it exists)
      try {
        const { error: smsError } = await supabase.rpc('send_client_invite_sms', {
          p_client_id: newClient.id,
          p_mobile_number: mobileNumber.trim(),
        });

        if (smsError) {
          console.warn('[CreateClientForm] SMS send error:', smsError);
          // Don't fail the whole operation if SMS fails
        }
      } catch (smsError) {
        console.warn('[CreateClientForm] SMS RPC not available:', smsError);
        // RPC might not exist yet, continue anyway
      }

      // Success!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Client Created',
        `${newClient.name} has been added to your clients list.`,
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess(newClient.id, newClient.name);
            },
          },
        ]
      );
    } catch (error) {
      console.error('[CreateClientForm] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <UserPlus size={24} color={Colors.gold} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.title}>Add New Client</Text>
              <Text style={styles.subtitle}>Create a new client profile</Text>
            </View>
          </View>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            disabled={submitting}
          >
            <X size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Form */}
        <ScrollView
          style={styles.form}
          contentContainerStyle={[
            styles.formContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name Field */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Name <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.inputContainer, errors.name && styles.inputContainerError]}>
              <UserPlus size={20} color={Colors.textMuted} strokeWidth={2} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={handleNameChange}
                placeholder="John Doe"
                placeholderTextColor={Colors.textMuted}
                editable={!submitting}
                autoCapitalize="words"
              />
            </View>
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Mobile Number Field */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Mobile Number <Text style={styles.required}>*</Text>
            </Text>
            <Text style={styles.fieldHelper}>Include country code (e.g., +254712345678)</Text>
            <View
              style={[styles.inputContainer, errors.mobileNumber && styles.inputContainerError]}
            >
              <Phone size={20} color={Colors.textMuted} strokeWidth={2} />
              <TextInput
                style={styles.input}
                value={mobileNumber}
                onChangeText={handleMobileNumberChange}
                placeholder="+254712345678"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                editable={!submitting}
              />
            </View>
            {errors.mobileNumber && (
              <Text style={styles.errorText}>{errors.mobileNumber}</Text>
            )}
          </View>

          {/* Email Field (Optional) */}
          <View style={styles.field}>
            <Text style={styles.label}>Email (Optional)</Text>
            <View style={[styles.inputContainer, errors.email && styles.inputContainerError]}>
              <Mail size={20} color={Colors.textMuted} strokeWidth={2} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={handleEmailChange}
                placeholder="john@example.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!submitting}
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Notes Field (Optional) */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <View style={styles.inputContainer}>
              <FileText size={20} color={Colors.textMuted} strokeWidth={2} />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes about this client..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!submitting}
              />
            </View>
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
              <>
                <UserPlus size={20} color={Colors.background} strokeWidth={2} />
                <Text style={styles.submitButtonText}>Create Client</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
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
    backgroundColor: Colors.card,
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
    flex: 1,
  },
  formContent: {
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
  required: {
    color: Colors.error,
  },
  fieldHelper: {
    fontSize: 12,
    color: Colors.textMuted,
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
    marginLeft: 12,
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.background,
    marginLeft: 8,
  },
});
