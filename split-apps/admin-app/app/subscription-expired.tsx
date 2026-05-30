import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Smartphone, CheckCircle, AlertCircle, Crown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type PayState = 'idle' | 'initiating' | 'waiting' | 'verifying' | 'success' | 'failed';

export default function SubscriptionExpiredScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [payState, setPayState] = useState<PayState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const payStateRef = useRef<PayState>('idle');

  const updatePayState = (s: PayState) => {
    payStateRef.current = s;
    setPayState(s);
  };

  useEffect(() => {
    if (user?.subscription_expires_at) {
      setExpiryDate(new Date(user.subscription_expires_at).toLocaleDateString('en-KE', {
        day: 'numeric', month: 'long', year: 'numeric'
      }));
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handlePay = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter your M-Pesa phone number.');
      return;
    }
    if (!user?.id) return;

    updatePayState('initiating');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { data, error } = await supabase.functions.invoke('admin_subscribe', {
        body: { phone_number: phone, admin_id: user.id },
      });

      if (error) throw error;

      const checkoutRequestId = data?.checkout_request_id;
      if (!checkoutRequestId) throw new Error('No checkout request ID returned.');

      updatePayState('waiting');
      startPolling(checkoutRequestId);

    } catch (e: any) {
      updatePayState('failed');
      setErrorMsg(e.message || 'Could not initiate payment.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const startPolling = (checkoutRequestId: string) => {
    const maxAttempts = 45;
    let attempts = 0;

    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      attempts++;

      if (attempts > 10 && payStateRef.current === 'waiting') {
        updatePayState('verifying');
      }

      try {
        const { data } = await supabase
          .from('admin_subscriptions')
          .select('status')
          .eq('checkout_request_id', checkoutRequestId)
          .eq('admin_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.status === 'success') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          updatePayState('success');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Refresh user profile to get updated subscription_status
          await refreshUser?.();
          setTimeout(() => router.replace('/(admin)/dashboard'), 2000);

        } else if (data?.status === 'failed') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          updatePayState('failed');
          setErrorMsg('Payment was unsuccessful. Please try again.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        } else if (attempts >= maxAttempts) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          updatePayState('failed');
          setErrorMsg('Payment timed out. If you were charged, contact support.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch {}
    }, 2000);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <LinearGradient
        colors={['rgba(212,175,55,0.08)', 'transparent']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.iconWrap}>
        <Crown size={48} color={Colors.gold} />
      </View>

      <Text style={styles.title}>Subscription Required</Text>
      <Text style={styles.subtitle}>
        {expiryDate
          ? `Your subscription expired on ${expiryDate}.`
          : 'Your subscription is inactive.'}
        {'\n'}Renew for KES 500/month to continue.
      </Text>

      {payState === 'idle' && (
        <>
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Monthly Plan</Text>
            <Text style={styles.priceAmount}>KES 500</Text>
            <Text style={styles.priceDesc}>Full access to all features for 30 days</Text>
          </View>

          <View style={styles.inputWrap}>
            <Smartphone size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="M-Pesa phone number"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <Pressable style={styles.payBtn} onPress={handlePay}>
            <Text style={styles.payBtnText}>Pay KES 500 via M-Pesa</Text>
          </Pressable>
        </>
      )}

      {(payState === 'initiating' || payState === 'waiting' || payState === 'verifying') && (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.stateTitle}>
            {payState === 'initiating' ? 'Initiating payment...' :
             payState === 'waiting' ? 'Check your phone!' : 'Verifying payment...'}
          </Text>
          <Text style={styles.stateDesc}>
            {payState === 'waiting'
              ? `An M-Pesa prompt has been sent to ${phone}. Enter your PIN to confirm.`
              : 'Please wait while we confirm your payment.'}
          </Text>
        </View>
      )}

      {payState === 'success' && (
        <View style={styles.stateWrap}>
          <CheckCircle size={64} color={Colors.success} />
          <Text style={[styles.stateTitle, { color: Colors.success }]}>Payment Successful!</Text>
          <Text style={styles.stateDesc}>Your subscription is now active. Redirecting...</Text>
        </View>
      )}

      {payState === 'failed' && (
        <View style={styles.stateWrap}>
          <AlertCircle size={64} color={Colors.error} />
          <Text style={[styles.stateTitle, { color: Colors.error }]}>Payment Failed</Text>
          <Text style={styles.stateDesc}>{errorMsg}</Text>
          <Pressable style={styles.retryBtn} onPress={() => updatePayState('idle')}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={styles.logoutBtn}
        onPress={async () => {
          await supabase.auth.signOut();
          router.replace('/admin-login');
        }}
      >
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  priceCard: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  priceAmount: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.gold,
    marginBottom: 8,
  },
  priceDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
    width: '100%',
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: Colors.white,
    fontSize: 16,
  },
  payBtn: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.gold,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  stateWrap: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 20,
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
  stateDesc: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: Colors.gold,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.background,
  },
  logoutBtn: {
    position: 'absolute',
    bottom: 40,
  },
  logoutText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
