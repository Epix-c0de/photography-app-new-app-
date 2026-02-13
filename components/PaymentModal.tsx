import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, ActivityIndicator, Pressable, Alert, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Smartphone, CheckCircle, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Gallery = Database['public']['Tables']['galleries']['Row'];

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  gallery: Gallery | null;
  clientPhone?: string;
  onSuccess: () => void;
}

type PaymentState = 'idle' | 'processing' | 'success' | 'failed';

export default function PaymentModal({ visible, onClose, gallery, clientPhone, onSuccess }: PaymentModalProps) {
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [phoneNumber, setPhoneNumber] = useState(clientPhone || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [recipientName, setRecipientName] = useState('');

  const readString = useCallback((value: unknown, key: string): string | null => {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const raw = record[key];
    return typeof raw === 'string' ? raw : null;
  }, []);
  
  // Animation values
  const scaleAnim = useState(new Animated.Value(0.9))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      setPaymentState('idle');
      setErrorMessage('');
      setPhoneNumber(clientPhone || '');
      loadRecipientName();
      
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 20,
          stiffness: 300,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible, clientPhone]);

  const loadRecipientName = async () => {
    try {
      const { data } = await supabase
        .from('payment_config')
        .select('payment_recipient_name')
        .limit(1)
        .maybeSingle();
      
      if (data?.payment_recipient_name) {
        setRecipientName(data.payment_recipient_name);
      }
    } catch (e) {
      console.error('Error loading recipient name:', e);
    }
  };

  const handlePay = async () => {
    if (!gallery) return;
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid M-Pesa phone number.');
      return;
    }

    setPaymentState('processing');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // 1. Trigger STK Push via Edge Function
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone_number: phoneNumber,
          amount: gallery.price,
          gallery_id: gallery.id,
          reference: gallery.access_code || gallery.name,
        },
      });

      if (error) throw error;

      const checkoutRequestId =
        readString(data, 'checkout_request_id') ??
        readString(data, 'CheckoutRequestID') ??
        readString(data, 'mpesa_checkout_request_id');

      if (!checkoutRequestId) {
        throw new Error('Payment initiated but missing checkout request id.');
      }

      startPolling(checkoutRequestId, gallery.id);

    } catch (e: any) {
      console.error('Payment initiation failed:', e);
      setPaymentState('failed');
      setErrorMessage(e.message || 'Could not initiate payment.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const startPolling = async (checkoutRequestId: string, galleryId: string) => {
    // Poll every 3 seconds for 2 minutes
    const pollInterval = 3000;
    const maxAttempts = 40; // 2 minutes
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('status')
          .eq('mpesa_checkout_request_id', checkoutRequestId)
          .eq('gallery_id', galleryId)
          .eq('status', 'paid')
          .gt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // last 5 mins
          .maybeSingle();

        if (error) throw error;

        if (data) {
          clearInterval(interval);
          setPaymentState('success');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPaymentState('failed');
          setErrorMessage('Payment timed out. Please try again.');
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, pollInterval);
  };
  
  // For demo/dev purposes, let's allow a "Simulate Success" if long press on title
  const handleSimulateSuccess = () => {
    if (__DEV__) {
      setPaymentState('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    }
  };

  const handleRetry = () => {
    setPaymentState('idle');
  };

  if (!gallery) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        </Pressable>

        <Animated.View 
          style={[
            styles.modalContainer, 
            { 
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim
            }
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle} onLongPress={handleSimulateSuccess}>
              {paymentState === 'success' ? 'Payment Successful' : 'Unlock Full Gallery'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.content}>
            {paymentState === 'idle' && (
              <>
                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryLabel}>Total Amount</Text>
                  <Text style={styles.summaryAmount}>KES {gallery.price?.toLocaleString()}</Text>
                  <Text style={styles.summaryDescription}>
                    Unlock all photos in {gallery.name}, remove watermarks, and enable high-res downloads.
                  </Text>
                </View>

                {recipientName ? (
                  <View style={styles.recipientBadge}>
                    <Text style={styles.recipientText}>Paying to: {recipientName}</Text>
                  </View>
                ) : null}

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>M-Pesa Phone Number</Text>
                  <View style={styles.inputWrapper}>
                    <Smartphone size={20} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder="e.g. 0712345678"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="phone-pad"
                      autoFocus={false}
                    />
                  </View>
                </View>

                <Pressable style={styles.payButton} onPress={handlePay}>
                  <Text style={styles.payButtonText}>Pay Now (M-Pesa)</Text>
                </Pressable>
              </>
            )}

            {paymentState === 'processing' && (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color={Colors.gold} style={styles.spinner} />
                <Text style={styles.stateTitle}>Check your phone!</Text>
                <Text style={styles.stateDescription}>
                  We have sent an M-Pesa prompt to {phoneNumber}. Please enter your PIN to complete the payment.
                </Text>
                <View style={styles.loaderBar}>
                  <View style={styles.loaderProgress} />
                </View>
              </View>
            )}

            {paymentState === 'success' && (
              <View style={styles.stateContainer}>
                <CheckCircle size={64} color="#4CAF50" style={styles.stateIcon} />
                <Text style={styles.stateTitle}>Payment Received!</Text>
                <Text style={styles.stateDescription}>
                  Unlocking your gallery...
                </Text>
              </View>
            )}

            {paymentState === 'failed' && (
              <View style={styles.stateContainer}>
                <AlertCircle size={64} color="#F44336" style={styles.stateIcon} />
                <Text style={styles.stateTitle}>Payment Failed</Text>
                <Text style={styles.stateDescription}>
                  {errorMessage || 'Something went wrong. Please try again.'}
                </Text>
                <Pressable style={styles.retryButton} onPress={handleRetry}>
                  <Text style={styles.retryButtonText}>Retry Payment</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 24,
  },
  summaryContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 8,
  },
  summaryDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  recipientBadge: {
    backgroundColor: Colors.background,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recipientText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  payButton: {
    backgroundColor: '#4CAF50', // M-Pesa Green
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  stateIcon: {
    marginBottom: 16,
  },
  spinner: {
    marginBottom: 20,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  stateDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  loaderBar: {
    width: '60%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
  },
  loaderProgress: {
    width: '40%',
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
});
