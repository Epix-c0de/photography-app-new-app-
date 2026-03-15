import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, ActivityIndicator, Pressable, Alert, Animated, Image, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Smartphone, CheckCircle, AlertCircle, CreditCard } from 'lucide-react-native';
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

type PaymentState = 'idle' | 'initiating' | 'waiting' | 'verifying' | 'success' | 'failed';

export default function PaymentModal({ visible, onClose, gallery, clientPhone, onSuccess }: PaymentModalProps) {
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [phoneNumber, setPhoneNumber] = useState(clientPhone || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<any>(null);

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
      loadPaymentSettings();

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

  const loadPaymentSettings = async () => {
    try {
      if (!gallery?.owner_admin_id) return;

      // Try simple settings first
      const { data: simple } = await supabase
        .from('simple_payment_settings')
        .select('*')
        .eq('admin_id', gallery.owner_admin_id)
        .maybeSingle();
      
      if (simple) {
        setPaymentSettings(simple);
        setRecipientName(simple.business_name || 'Photographer');
        return;
      }

      // Try advanced settings
      const { data: advanced } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('admin_id', gallery.owner_admin_id)
        .maybeSingle();

      if (advanced) {
        setPaymentSettings(advanced);
        setRecipientName(`Paybill/Till: ${advanced.shortcode}`);
      }
    } catch (e) {
      console.error('Error loading payment settings:', e);
    }
  };

  const handlePay = async () => {
    if (!gallery) return;
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid M-Pesa phone number.');
      return;
    }

    setPaymentState('initiating');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

      setPaymentState('waiting');
      startPolling(checkoutRequestId, gallery.id);

    } catch (e: any) {
      console.error('Payment initiation failed:', e);
      setPaymentState('failed');
      setErrorMessage(e.message || 'Could not initiate payment.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const startPolling = async (checkoutRequestId: string, galleryId: string) => {
    // Poll every 2 seconds for 1.5 minutes (Daraja timeout is usually 60s)
    const pollInterval = 2000;
    const maxAttempts = 45; 
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      
      // After 20 seconds of waiting, switch UI to "verifying"
      if (attempts > 10 && paymentState === 'waiting') {
        setPaymentState('verifying');
      }

      try {
        const { data, error } = await supabase
          .from('mpesa_transactions')
          .select('status, result_desc')
          .eq('checkout_request_id', checkoutRequestId)
          .eq('gallery_id', galleryId)
          .gt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .maybeSingle();

        if (error) throw error;

        if (data?.status === 'success') {
          clearInterval(interval);
          setPaymentState('success');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 3000); // Give time for celebration
        } else if (data?.status === 'failed' || data?.status === 'cancelled') {
          clearInterval(interval);
          setPaymentState('failed');
          setErrorMessage(data.result_desc || 'Payment was unsuccessful.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPaymentState('failed');
          setErrorMessage('Payment verification timed out. If you have been charged, please contact support.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
                  {gallery.cover_photo_url ? (
                    <View style={styles.previewWrapper}>
                      <Image
                        source={{ uri: gallery.cover_photo_url }}
                        style={styles.previewImage}
                        blurRadius={Platform.OS === 'ios' ? 10 : 5}
                      />
                      <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
                    </View>
                  ) : (
                    <View style={[styles.previewWrapper, { backgroundColor: Colors.background }]}>
                      <CreditCard size={40} color={Colors.textMuted} style={{ opacity: 0.3 }} />
                    </View>
                  )}

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

                {paymentSettings?.payment_mode === 'STK_PUSH' || !paymentSettings?.payment_mode ? (
                  <>
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
                      <Text style={styles.payButtonText}>Pay via STK Push</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.instructionContainer}>
                    <Text style={styles.instructionTitle}>Manual Payment Instructions</Text>
                    <View style={styles.instructionBox}>
                      <Text style={styles.instructionStep}>1. Go to M-Pesa menu</Text>
                      <Text style={styles.instructionStep}>2. Select Lipa na M-Pesa</Text>
                      <Text style={styles.instructionStep}>
                        3. Select {paymentSettings.payment_mode === 'PAYBILL' ? 'Paybill' : 'Buy Goods'}
                      </Text>
                      <Text style={styles.instructionStep}>
                        4. {paymentSettings.payment_mode === 'PAYBILL' ? 'Enter Business No: ' : 'Enter Till No: '}
                        <Text style={{ fontWeight: 'bold', color: Colors.gold }}>{paymentSettings.mpesa_number}</Text>
                      </Text>
                      {paymentSettings.payment_mode === 'PAYBILL' && (
                        <Text style={styles.instructionStep}>
                          5. Enter Account: <Text style={{ fontWeight: 'bold', color: Colors.gold }}>{gallery.access_code}</Text>
                        </Text>
                      )}
                      <Text style={styles.instructionStep}>
                        {paymentSettings.payment_mode === 'PAYBILL' ? '6.' : '5.'} Enter Amount: <Text style={{ fontWeight: 'bold', color: Colors.gold }}>{gallery.price}</Text>
                      </Text>
                    </View>
                    <Text style={styles.instructionHint}>
                      Your gallery will be unlocked automatically once the payment is confirmed.
                    </Text>
                    <Pressable 
                      style={[styles.payButton, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.gold }]} 
                      onPress={() => setPaymentState('verifying')}
                    >
                      <Text style={[styles.payButtonText, { color: Colors.gold }]}>I have paid, check status</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}

            {paymentState === 'initiating' && (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color={Colors.gold} style={styles.spinner} />
                <Text style={styles.stateTitle}>Initiating Secure Payment</Text>
                <Text style={styles.stateDescription}>
                  Connecting to M-Pesa...
                </Text>
                <View style={styles.progressSteps}>
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <View style={styles.stepDot} />
                  <View style={styles.stepDot} />
                </View>
              </View>
            )}

            {paymentState === 'waiting' && (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color={Colors.gold} style={styles.spinner} />
                <Text style={styles.stateTitle}>Check your phone!</Text>
                <Text style={styles.stateDescription}>
                  We've sent an M-Pesa prompt to {phoneNumber}. Enter your PIN to confirm.
                </Text>
                <View style={styles.progressSteps}>
                  <View style={[styles.stepDot, styles.stepDotCompleted]} />
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                  <View style={styles.stepDot} />
                </View>
                <View style={styles.loaderBar}>
                  <Animated.View style={[styles.loaderProgress, { width: '60%' }]} />
                </View>
              </View>
            )}

            {paymentState === 'verifying' && (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color={Colors.gold} style={styles.spinner} />
                <Text style={styles.stateTitle}>Verifying Payment</Text>
                <Text style={styles.stateDescription}>
                  Waiting for M-Pesa to confirm your transaction. This usually takes a few seconds...
                </Text>
                <View style={styles.progressSteps}>
                  <View style={[styles.stepDot, styles.stepDotCompleted]} />
                  <View style={[styles.stepDot, styles.stepDotCompleted]} />
                  <View style={[styles.stepDot, styles.stepDotActive]} />
                </View>
              </View>
            )}

            {paymentState === 'success' && (
              <View style={styles.stateContainer}>
                <Animated.View style={{ transform: [{ scale: 1.2 }] }}>
                  <CheckCircle size={80} color="#4CAF50" style={styles.stateIcon} />
                </Animated.View>
                <Text style={[styles.stateTitle, { color: '#4CAF50' }]}>Payment Successful!</Text>
                <Text style={styles.stateDescription}>
                  Your gallery is being unlocked right now. Get ready to enjoy your photos!
                </Text>
                <View style={styles.celebrationContainer}>
                   <ActivityIndicator size="small" color="#4CAF50" />
                   <Text style={{color: '#4CAF50', marginLeft: 8, fontWeight: '600'}}>Applying access...</Text>
                </View>
              </View>
            )}

            {paymentState === 'failed' && (
              <View style={styles.stateContainer}>
                <AlertCircle size={64} color="#F44336" style={styles.stateIcon} />
                <Text style={styles.stateTitle}>Payment Failed</Text>
                <Text style={styles.stateDescription}>
                  {errorMessage || 'Something went wrong. Please try again.'}
                </Text>
                <View style={styles.failedActions}>
                  <Pressable style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </Pressable>
                  <Pressable style={[styles.retryButton, {borderColor: 'transparent'}]} onPress={onClose}>
                    <Text style={[styles.retryButtonText, {color: Colors.textMuted}]}>Cancel</Text>
                  </Pressable>
                </View>
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
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewWrapper: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  progressSteps: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.gold,
    width: 24,
  },
  stepDotCompleted: {
    backgroundColor: '#4CAF50',
  },
  celebrationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    marginTop: 10,
  },
  failedActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  instructionContainer: {
    gap: 16,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
  instructionBox: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  instructionStep: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  instructionHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
