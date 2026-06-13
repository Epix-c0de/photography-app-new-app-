// Task 9.1: Code Entry Modal for photographer code assignment
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8, 2.10
// Task 27.1: Network failure error handling with retry logic
// Requirements: 16.1, 16.7

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, WifiOff, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

interface CodeEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (photographerName: string, photographerId: string) => void;
}

// Detect whether an error represents a network/connection failure.
function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkrequest failed') ||
      msg.includes('load failed')
    ) return true;
  }
  if (typeof error === 'object') {
    const err = error as any;
    const msg: string = (err.message || '').toLowerCase();
    if (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('connection') ||
      msg.includes('timeout')
    ) return true;
    const code: string = err.code || '';
    if (code === 'PGRST000' || code === 'NETWORK_ERROR') return true;
  }
  return false;
}

// Sleep helper for retry back-off
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function CodeEntryModal({ visible, onClose, onSuccess }: CodeEntryModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Inline network-error state — shows a banner instead of consuming an Alert
  // so the user can retry without re-entering the code (Req 16.7).
  const [networkError, setNetworkError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const attemptAssignment = useCallback(async (trimmedCode: string, attempt: number): Promise<void> => {
    const { data, error } = await supabase.rpc('assign_client_to_photographer', {
      p_client_id: user!.id,
      p_photographer_code: trimmedCode,
    });

    if (error) {
      if (isNetworkError(error) && attempt < MAX_RETRIES) {
        // Auto-retry with back-off for transient failures
        await sleep(RETRY_DELAY_MS * attempt);
        return attemptAssignment(trimmedCode, attempt + 1);
      }
      if (isNetworkError(error)) {
        setNetworkError(true);
        return;
      }
      throw error;
    }

    if (!data?.success) {
      if (data?.error?.includes('already assigned')) {
        Alert.alert(
          'Already Assigned',
          'You are already connected to a photographer. Contact support if you need to change photographers.'
        );
      } else if (data?.error?.includes('invalid') || data?.error?.includes('not found')) {
        Alert.alert(
          'Invalid Code',
          'This photographer code is not valid. Please check with your photographer and try again.'
        );
      } else {
        Alert.alert('Error', data?.error || 'Unable to connect. Please check the code and try again.');
      }
      return;
    }

    // Success
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const photographerName = data.admin_name || 'your photographer';
    const photographerId = data.admin_id;

    Alert.alert(
      'Connected!',
      `Connected to ${photographerName}! You can now access your galleries and packages.`,
      [
        {
          text: 'OK',
          onPress: () => {
            setCode('');
            setNetworkError(false);
            setRetryCount(0);
            onClose();
            onSuccess(photographerName, photographerId);
          },
        },
      ]
    );
  }, [user, onClose, onSuccess]);

  const handleCodeSubmit = async () => {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      Alert.alert('Invalid Code', 'Please enter a photographer code.');
      return;
    }
    if (trimmedCode.length !== 8) {
      Alert.alert('Invalid Code', 'Photographer code must be exactly 8 characters.');
      return;
    }
    const alphanumericRegex = /^[A-Z0-9]+$/;
    if (!alphanumericRegex.test(trimmedCode)) {
      Alert.alert('Invalid Code', 'Photographer code can only contain letters and numbers.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to enter a photographer code.');
      return;
    }

    setSubmitting(true);
    setNetworkError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await attemptAssignment(trimmedCode, 1);
    } catch (err) {
      console.error('[CodeEntryModal] Unexpected error:', err);
      if (isNetworkError(err)) {
        setNetworkError(true);
      } else {
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Retry handler — keeps the entered code intact (Req 16.7)
  const handleRetry = () => {
    setRetryCount((c) => c + 1);
    handleCodeSubmit();
  };

  const handleClose = () => {
    if (submitting) return;
    setCode('');
    setNetworkError(false);
    setRetryCount(0);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleClose}
        />
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Enter Photographer Code</Text>
            <Pressable
              onPress={handleClose}
              style={styles.modalClose}
              disabled={submitting}
            >
              <X size={24} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.modalDescription}>
            Enter the 8-character code provided by your photographer to access your galleries and packages.
          </Text>

          {/* Inline network error banner — keeps entered code intact (Req 16.7) */}
          {networkError && (
            <View style={styles.networkErrorBanner}>
              <WifiOff size={16} color="#FF3B30" />
              <Text style={styles.networkErrorText}>
                Connection lost. Please check your internet and try again.
              </Text>
              <Pressable onPress={handleRetry} style={styles.retryButton} disabled={submitting}>
                <RefreshCw size={16} color={Colors.gold} />
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          )}

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(text) => {
              setNetworkError(false);
              setCode(text.toUpperCase());
            }}
            placeholder="ABC12345"
            placeholderTextColor={Colors.textMuted}
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            editable={!submitting}
            onSubmitEditing={handleCodeSubmit}
            returnKeyType="done"
          />

          <Pressable
            style={[
              styles.modalSubmitButton,
              (submitting || code.trim().length !== 8) && styles.modalSubmitButtonDisabled,
            ]}
            onPress={handleCodeSubmit}
            disabled={submitting || code.trim().length !== 8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.background} />
            ) : (
              <Text style={styles.modalSubmitButtonText}>Connect</Text>
            )}
          </Pressable>

          <Text style={styles.footerText}>
            Don't have a code? Contact your photographer to receive one.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  modalClose: {
    padding: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  codeInput: {
    width: '100%',
    height: 56,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalSubmitButton: {
    width: '100%',
    height: 56,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalSubmitButtonDisabled: {
    opacity: 0.5,
  },
  modalSubmitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.background,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  networkErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  networkErrorText: {
    flex: 1,
    fontSize: 13,
    color: '#FF3B30',
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
});
