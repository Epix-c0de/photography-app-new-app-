import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, ActivityIndicator, Pressable, Alert, Animated, Image, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Smartphone, CheckCircle, AlertCircle, CreditCard } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { normalizePhone, isValidKenyanPhone } from '@/lib/phone';
import type { Database } from '@/types/supabase';

type Gallery = Database['public']['Tables']['galleries']['Row'];

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  gallery: Gallery | null;
  clientPhone?: string;
  onSuccess: () => void;
}

type PaymentState = 'idle' | 'initiating' | 'waiting' | 'verifying' | 'success' | 'failed' | 'manual_payment';

const MPESA_RESULT_ERRORS: Record<number, string> = {
  1: 'The initiator information is invalid.',
  1032: 'Request cancelled by user.',
  1037: 'DS timeout user cannot be reached.',
  17: 'Insufficient balance in M-Pesa account.',
  2001: 'Invalid credentials provided.',
  2002: 'Transaction limit exceeded.',
  2003: 'Duplicate transaction detected.',
  2026: 'Debtor account is frozen.',
  2027: 'Debtor account is closed.',
  2028: 'Transaction expired.',
  2029: 'Invalid amount.',
  2030: 'Wrong paybill or till number.',
  2031: 'Invalid account number.',
};

function getResultErrorMessage(resultCode: number | null | undefined): string {
  if (resultCode === undefined || resultCode === null) return 'Payment was unsuccessful.';
  if (resultCode === 0) return '';
  return MPESA_RESULT_ERRORS[resultCode] || `Payment failed (Error code: ${resultCode}).`;
}

export default function PaymentModal({ visible, onClose, gallery, clientPhone, onSuccess }: PaymentModalProps) {
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [mpesaMessage, setMpesaMessage] = useState('');

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paymentStateRef = useRef<PaymentState>('idle');
  const checkoutRequestIdRef = useRef<string | null>(null);

  const updatePaymentState = useCallback((state: PaymentState) => {
    paymentStateRef.current = state;
    setPaymentState(state);
  }, []);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  const readString = useCallback((value: unknown, key: string): string | null => {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const raw = record[key];
    return typeof raw === 'string' ? raw : null;
  }, []);

  const scaleAnim = useState(new Animated.Value(0.9))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      updatePaymentState('idle');
      setErrorMessage('');
      setPhoneNumber('');
      setMpesaMessage('');
      checkoutRequestIdRef.current = null;
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
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
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

      // Try payment_gateways table first (new system)
      const { data: gateway } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('admin_id', gallery.owner_admin_id)
        .eq('is_active', true)
        .maybeSingle();

      if (gateway) {
        setPaymentSettings({
          ...gateway,
          payment_mode: gateway.type,
          mpesa_number: gateway.shortcode,
          mpesa_enabled: true,
          auto_verification: true,
          use_new_gateway: true,
        });
        setRecipientName(`${gateway.type}: ${gateway.shortcode}`);
        return;
      }

      // Fallback to simple settings
      const { data: simple } = await supabase
        .from('simple_payment_settings')
        .select('*')
        .eq('admin_id', gallery.owner_admin_id)
        .maybeSingle();
      
      if (simple) {
        setPaymentSettings(simple);
        setRecipientName(simple.business_name || 'Photographer');
        if (simple.mpesa_enabled === false) {
          updatePaymentState('manual_payment');
        }
        return;
      }

      // Fallback to advanced settings
      const { data: advanced } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('admin_id', gallery.owner_admin_id)
        .maybeSingle();

      if (advanced) {
        setPaymentSettings(advanced);
        setRecipientName(`Paybill/Till: ${advanced.shortcode}`);
        if (advanced.mpesa_enabled === false) {
          updatePaymentState('manual_payment');
        }
      }
    } catch (e) {
      console.error('Error loading payment settings:', e);
    }
  };

  const checkDuplicatePayment = async (galleryId: string, phone: string): Promise<boolean> => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('mpesa_transactions')
      .select('id')
      .eq('gallery_id', galleryId)
      .eq('phone_number', phone)
      .in('status', ['pending', 'success'])
      .gt('created_at', fiveMinAgo)
      .maybeSingle();
    return !!data;
  };

  const querySTKStatus = async (checkoutRequestId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-stkquery', {
        body: { checkout_request_id: checkoutRequestId },
      });
      if (error) return null;
      return data?.ResultCode ?? data?.status ?? null;
    } catch {
      return null;
    }
  };

  const handlePay = async () => {
    if (!gallery) return;
    
    // Use new gateway system if available
    if (paymentSettings?.use_new_gateway) {
      if (!phoneNumber || !isValidKenyanPhone(phoneNumber)) {
        Alert.alert('Invalid Phone', 'Please enter a valid M-Pesa phone number (e.g. 0712345678).');
        return;
      }

      const normalizedPhone = normalizePhone(phoneNumber);
      if (!normalizedPhone) {
        Alert.alert('Invalid Phone', 'Could not normalize phone number. Please check and try again.');
        return;
      }

      updatePaymentState('initiating');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        // Check for duplicate payment
        const isDuplicate = await checkDuplicatePayment(gallery.id, normalizedPhone);
        if (isDuplicate) {
          updatePaymentState('failed');
          setErrorMessage('A recent payment was already initiated for this gallery. Please wait a few minutes before trying again.');
          return;
        }

        const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
          body: {
            phone_number: normalizedPhone,
            amount: gallery.price || 0,
            gallery_id: gallery.id,
            account_reference: gallery.access_code || gallery.name,
            admin_id: gallery.owner_admin_id,
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

        checkoutRequestIdRef.current = checkoutRequestId;
        updatePaymentState('waiting');
        startPolling(checkoutRequestId, gallery.id);

      } catch (e: any) {
        console.error('Payment initiation failed:', e);
        updatePaymentState('failed');
        setErrorMessage(e.message || 'Could not initiate payment.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }
    
    // Legacy flow - simple M-Pesa (manual payment)
    if (paymentSettings?.mpesa_number && !paymentSettings?.shortcode) {
      if (paymentSettings.auto_verification) {
        if (!phoneNumber || !isValidKenyanPhone(phoneNumber)) {
          Alert.alert('Invalid Phone', 'Please enter a valid M-Pesa phone number.');
          return;
        }

        const normalizedPhone = normalizePhone(phoneNumber);
        if (!normalizedPhone) {
          Alert.alert('Invalid Phone', 'Could not normalize phone number. Please check and try again.');
          return;
        }

        updatePaymentState('initiating');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
          const isDuplicate = await checkDuplicatePayment(gallery.id, normalizedPhone);
          if (isDuplicate) {
            updatePaymentState('failed');
            setErrorMessage('A recent payment was already initiated. Please wait before trying again.');
            return;
          }

          const { data, error } = await supabase.functions.invoke('client_payments_stkpush', {
            body: {
              phone_number: normalizedPhone,
              amount: gallery.price || 0,
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

          checkoutRequestIdRef.current = checkoutRequestId;
          updatePaymentState('waiting');
          startPolling(checkoutRequestId, gallery.id);

        } catch (e: any) {
          console.error('Payment initiation failed:', e);
          updatePaymentState('failed');
          setErrorMessage(e.message || 'Could not initiate payment.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } else {
        // Manual verification
        updatePaymentState('waiting');
        setErrorMessage('');
        
        try {
          const { error } = await supabase
            .from('manual_payments')
            .insert({
              gallery_id: gallery.id,
              client_id: gallery.client_id,
              admin_id: gallery.owner_admin_id,
              amount: gallery.price || 0,
              phone_number: phoneNumber,
              mpesa_number: paymentSettings.mpesa_number,
              status: 'pending',
            });
        
          if (error) throw error;
        
          Alert.alert(
            'Payment Instructions',
            `Send ${gallery.price} ${paymentSettings.currency || 'KES'} to:\n\n${paymentSettings.mpesa_number}\n\nOnce sent, the admin will verify and unlock your gallery.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'I\'ve Sent It', 
                onPress: () => {
                  updatePaymentState('verifying');
                  startManualPolling(gallery.id);
                }
              }
            ]
          );
        } catch (e: any) {
          console.error('Failed to create manual payment record:', e);
          updatePaymentState('failed');
          setErrorMessage('Could not initiate payment. Please try again.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
      return;
    }
    
    // Advanced M-PESA - STK push flow
    if (!phoneNumber || !isValidKenyanPhone(phoneNumber)) {
      Alert.alert('Invalid Phone', 'Please enter a valid M-Pesa phone number.');
      return;
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone) {
      Alert.alert('Invalid Phone', 'Could not normalize phone number. Please check and try again.');
      return;
    }

    updatePaymentState('initiating');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const isDuplicate = await checkDuplicatePayment(gallery.id, normalizedPhone);
      if (isDuplicate) {
        updatePaymentState('failed');
        setErrorMessage('A recent payment was already initiated. Please wait before trying again.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('client_payments_stkpush', {
        body: {
          phone_number: normalizedPhone,
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

      checkoutRequestIdRef.current = checkoutRequestId;
      updatePaymentState('waiting');
      startPolling(checkoutRequestId, gallery.id);

    } catch (e: any) {
      console.error('Payment initiation failed:', e);
      updatePaymentState('failed');
      setErrorMessage(e.message || 'Could not initiate payment.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const startPolling = (checkoutRequestId: string, galleryId: string) => {
    const pollInterval = 3000;
    const maxAttempts = 30; // 90 seconds max
    let attempts = 0;

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    pollingIntervalRef.current = setInterval(async () => {
      attempts++;

      if (attempts > 8 && paymentStateRef.current === 'waiting') {
        updatePaymentState('verifying');
      }

      try {
        // Check mpesa_transactions table first (new system)
        let { data, error } = await supabase
          .from('mpesa_transactions')
          .select('status, result_desc, result_code')
          .eq('checkout_request_id', checkoutRequestId)
          .eq('gallery_id', galleryId)
          .gt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .maybeSingle();

        // Fallback: check transactions table (unified)
        if (!data && !error) {
          const result = await supabase
            .from('transactions')
            .select('status, result_desc, result_code')
            .eq('checkout_request_id', checkoutRequestId)
            .eq('gallery_id', galleryId)
            .gt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .maybeSingle();
          data = result.data;
          error = result.error;
        }

        if (error) throw error;

        if (data?.status === 'success') {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          updatePaymentState('success');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 3000);
        } else if (data?.status === 'failed' || data?.status === 'cancelled') {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          updatePaymentState('failed');
          const resultCode = data.result_code;
          setErrorMessage(getResultErrorMessage(resultCode) || data.result_desc || 'Payment was unsuccessful.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (attempts >= maxAttempts) {
          // Timeout - try STK query as fallback
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          
          const stkResult = await querySTKStatus(checkoutRequestId);
          if (stkResult === '0') {
            updatePaymentState('success');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 3000);
          } else {
            updatePaymentState('failed');
            setErrorMessage('Payment verification timed out. If you have been charged, please contact support.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, pollInterval);
  };

  const startManualPolling = (galleryId: string) => {
    const pollInterval = 5000;
    const maxAttempts = 120;
    let attempts = 0;

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    pollingIntervalRef.current = setInterval(async () => {
      attempts++;

      try {
        const { data, error } = await supabase
          .from('manual_payments')
          .select('status')
          .eq('gallery_id', galleryId)
          .eq('client_id', gallery?.client_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data?.status === 'verified') {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          updatePaymentState('success');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 3000);
        } else if (data?.status === 'rejected') {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          updatePaymentState('failed');
          setErrorMessage('Payment was rejected. Please try again or contact support.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (attempts >= maxAttempts) {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          updatePaymentState('failed');
          setErrorMessage('Payment verification timed out. Please contact the admin to verify your payment.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch (e) {
        console.error('Manual polling error:', e);
      }
    }, pollInterval);
  };

  const handleSubmitManualMessage = async () => {
    if (!gallery) return;
    if (!mpesaMessage.trim()) {
      Alert.alert('Missing Message', 'Please paste your M-Pesa confirmation message.');
      return;
    }

    updatePaymentState('verifying');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const codeMatch = mpesaMessage.match(/\b([A-Z0-9]{10})\b/);
      const mpesaCode = codeMatch ? codeMatch[1] : null;

      if (!mpesaCode) {
        Alert.alert('Invalid Message', 'Could not extract M-Pesa transaction code. Please make sure you pasted the complete confirmation message.');
        updatePaymentState('manual_payment');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!clientData?.id) {
        throw new Error('Client record not found. Please contact support.');
      }

      const { error } = await supabase
        .from('manual_payment_verifications')
        .insert({
          client_id: clientData.id,
          admin_id: gallery.owner_admin_id,
          gallery_id: gallery.id,
          mpesa_code: mpesaCode,
          amount: gallery.price || 0,
          status: 'pending',
        });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Submission Received',
        'Your M-Pesa payment code has been sent to the admin. Your gallery will be unlocked once verified.',
        [{ text: 'OK', onPress: () => onClose() }]
      );
    } catch (e: any) {
      console.error('Failed to submit payment:', e);
      updatePaymentState('manual_payment');
      Alert.alert('Error', e.message || 'Failed to send payment. Please try again.');
    }
  };

  const handleSimulateSuccess = () => {
    if (__DEV__) {
      updatePaymentState('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    }
  };

  const handleRetry = () => {
    updatePaymentState('idle');
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
                  <Text style={styles.summaryAmount}>KES {(gallery.price || 0).toLocaleString()}</Text>
                  <Text style={styles.summaryDescription}>
                    Unlock all photos in {gallery.name}, remove watermarks, and enable high-res downloads.
                  </Text>
                </View>

                {recipientName ? (
                  <View style={styles.recipientBadge}>
                    <Text style={styles.recipientText}>Paying to: {recipientName}</Text>
                  </View>
                ) : null}

                {paymentSettings?.payment_mode === 'PAYBILL' || paymentSettings?.payment_mode === 'TILL_NUMBER' ? (
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
                      onPress={() => updatePaymentState('verifying')}
                    >
                      <Text style={[styles.payButtonText, { color: Colors.gold }]}>I have paid, check status</Text>
                    </Pressable>
                  </View>
                ) : (
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
                )}
              </>
            )}

            {paymentState === 'manual_payment' && (
              <View style={styles.manualPaymentContainer}>
                <Text style={styles.manualPaymentTitle}>Manual Payment</Text>
                <Text style={styles.manualPaymentDesc}>
                  M-Pesa STK push is currently disabled. Please send payment manually:
                </Text>

                <View style={styles.payeeCard}>
                  <Text style={styles.payeeLabel}>Send to:</Text>
                  <Text style={styles.payeeName}>
                    {paymentSettings?.manual_mpesa_name || paymentSettings?.business_name || 'Photographer'}
                  </Text>
                  <Text style={styles.payeeNumber}>
                    {paymentSettings?.manual_mpesa_number || paymentSettings?.mpesa_number || 'Contact admin'}
                  </Text>
                </View>

                <View style={styles.amountCard}>
                  <Text style={styles.amountLabel}>Amount:</Text>
                  <Text style={styles.amountValue}>KES {gallery?.price?.toLocaleString()}</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Your Phone Number (Used for payment)</Text>
                  <View style={styles.inputWrapper}>
                    <Smartphone size={20} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder="e.g. 0712345678"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Paste M-Pesa Confirmation Message</Text>
                  <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start' }]}>
                    <TextInput
                      style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                      value={mpesaMessage}
                      onChangeText={setMpesaMessage}
                      placeholder="Paste the entire confirmation message you received from M-Pesa..."
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                </View>

                <Pressable style={styles.payButton} onPress={handleSubmitManualMessage}>
                  <Text style={styles.payButtonText}>Submit for Verification</Text>
                </Pressable>

                <Text style={styles.manualPaymentNote}>
                  The admin will verify your payment and unlock your gallery. This may take a few minutes.
                </Text>
              </View>
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
                  <CheckCircle size={80} color="#2ECC71" style={styles.stateIcon} />
                </Animated.View>
                <Text style={[styles.stateTitle, { color: '#2ECC71' }]}>Payment Successful!</Text>
                <Text style={styles.stateDescription}>
                  Your gallery is being unlocked right now. Get ready to enjoy your photos!
                </Text>
                <View style={styles.celebrationContainer}>
                   <ActivityIndicator size="small" color="#2ECC71" />
                   <Text style={{color: '#2ECC71', marginLeft: 8, fontWeight: '600'}}>Applying access...</Text>
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
    backgroundColor: '#2ECC71',
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
    backgroundColor: '#2ECC71',
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
  manualPaymentContainer: {
    gap: 16,
  },
  manualPaymentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  manualPaymentDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  payeeCard: {
    backgroundColor: Colors.gold + '15',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    alignItems: 'center',
  },
  payeeLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  payeeName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 4,
  },
  payeeNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amountCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gold,
  },
  manualPaymentNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
});
