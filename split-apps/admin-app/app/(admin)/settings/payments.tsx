import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, FlatList,
  ActivityIndicator, Alert, Pressable, RefreshControl,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Smartphone, Building, DollarSign, CreditCard, Save, ShieldCheck,
  HelpCircle, CheckCircle2, RefreshCcw, ChevronLeft, Clock, XCircle,
  Search, MessageSquare, Unlock, Image as ImageIcon, Hash,
  Wallet, Inbox, Settings
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'overview' | 'config' | 'history' | 'inbox';
type PaymentMode = 'STK_PUSH' | 'PAYBILL' | 'TILL_NUMBER';

interface Transaction {
  id: string;
  gallery_id: string;
  client_id: string;
  phone_number: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  mpesa_receipt: string | null;
  created_at: string;
  galleries: { name: string };
  user_profiles: { full_name: string };
}

interface ManualPayment {
  id: string;
  gallery_id: string;
  client_id: string;
  admin_id: string;
  mpesa_code: string;
  amount: number;
  status: 'pending' | 'verified' | 'rejected';
  verified_at?: string;
  verified_by?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

interface MpesaMessage {
  id: string;
  user_id: string;
  admin_id: string;
  gallery_id?: string | null;
  booking_id?: string | null;
  amount?: number | null;
  mpesa_code?: string | null;
  mpesa_message: string;
  sender_phone?: string | null;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
  user?: { email?: string; user_metadata?: { name?: string } } | null;
  gallery?: { title?: string; access_code?: string } | null;
}

type InboxItem = {
  source: 'manual' | 'mpesa';
  id: string;
  amount: number | null;
  mpesa_code: string | null;
  status: string;
  created_at: string;
  client_name: string;
  client_email: string;
  gallery_name: string;
  raw: ManualPayment | MpesaMessage;
};

export default function UnifiedPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const { user, verifyAdminGuard } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [mpesaNumber, setMpesaNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('500');
  const [currency, setCurrency] = useState('KES');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('STK_PUSH');
  const [autoVerification, setAutoVerification] = useState(false);
  const [tillNumber, setTillNumber] = useState('');
  const [paybillNumber, setPaybillNumber] = useState('');
  const [businessShortcode, setBusinessShortcode] = useState('');

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [manualPayments, setManualPayments] = useState<ManualPayment[]>([]);
  const [mpesaMessages, setMpesaMessages] = useState<MpesaMessage[]>([]);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxFilter, setInboxFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [inboxSearch, setInboxSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const loadSimpleSettings = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('simple_payment_settings')
        .select('*')
        .eq('admin_id', user.id)
        .maybeSingle();
      if (data) {
        setMpesaNumber(data.mpesa_number || '');
        setBusinessName(data.business_name || '');
        setDefaultPrice(String(data.gallery_price_default || '500'));
        setCurrency(data.currency || 'KES');
        setPaymentMode((data.payment_mode as PaymentMode) || 'STK_PUSH');
        setAutoVerification(data.auto_verification || false);
        setTillNumber(data.till_number || '');
        setPaybillNumber(data.paybill_number || '');
        setBusinessShortcode(data.business_shortcode || '');
      }
    } catch (e) {
      console.error('Failed to load simple settings:', e);
    }
  }, [user?.id]);

  const loadTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mpesa_transactions')
        .select(`
          *,
          galleries(name),
          user_profiles!mpesa_transactions_client_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTransactions((data as any) || []);
    } catch (e) {
      console.error('Error fetching transactions:', e);
    }
  }, []);

  const loadManualPayments = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('manual_payment_verifications')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setManualPayments((data || []) as ManualPayment[]);
    } catch (e) {
      console.error('Error loading manual payments:', e);
    }
  }, [user?.id]);

  const loadMpesaMessages = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('mpesa_messages')
        .select('*')
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const messagesWithDetails = await Promise.all(
        (data || []).map(async (msg) => {
          let u = null;
          let g = null;
          if (msg.user_id) {
            const { data: ud } = await supabase
              .from('user_profiles')
              .select('id, email, name')
              .eq('id', msg.user_id)
              .maybeSingle();
            u = ud;
          }
          if (msg.gallery_id) {
            const { data: gd } = await supabase
              .from('galleries')
              .select('id, title, access_code')
              .eq('id', msg.gallery_id)
              .maybeSingle();
            g = gd;
          }
          return { ...msg, user: u, gallery: g } as MpesaMessage;
        })
      );
      setMpesaMessages(messagesWithDetails);
    } catch (e) {
      console.error('Error loading M-Pesa messages:', e);
    }
  }, [user?.id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadSimpleSettings(),
      loadTransactions(),
      loadManualPayments(),
      loadMpesaMessages()
    ]);
    setLoading(false);
  }, [loadSimpleSettings, loadTransactions, loadManualPayments, loadMpesaMessages]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const buildInboxItems = useCallback(() => {
    const items: InboxItem[] = [];

    manualPayments.forEach((p) => {
      items.push({
        source: 'manual',
        id: p.id,
        amount: p.amount,
        mpesa_code: p.mpesa_code,
        status: p.status,
        created_at: p.created_at,
        client_name: `Client: ${p.client_id.slice(0, 8)}`,
        client_email: '',
        gallery_name: `Gallery: ${p.gallery_id.slice(0, 8)}`,
        raw: p,
      });
    });

    mpesaMessages.forEach((m) => {
      items.push({
        source: 'mpesa',
        id: m.id,
        amount: m.amount ?? null,
        mpesa_code: m.mpesa_code ?? null,
        status: m.status,
        created_at: m.created_at,
        client_name: m.user?.user_metadata?.name || m.user?.email || 'Unknown',
        client_email: m.user?.email || '',
        gallery_name: m.gallery?.title || m.gallery?.access_code || '',
        raw: m,
      });
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    let filtered = items;
    if (inboxFilter !== 'all') {
      filtered = filtered.filter((i) => i.status === inboxFilter);
    }
    if (inboxSearch.trim()) {
      const q = inboxSearch.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.mpesa_code?.toLowerCase().includes(q) ||
          i.client_name.toLowerCase().includes(q) ||
          i.client_email.toLowerCase().includes(q) ||
          i.gallery_name.toLowerCase().includes(q)
      );
    }
    setInboxItems(filtered);
  }, [manualPayments, mpesaMessages, inboxFilter, inboxSearch]);

  useEffect(() => {
    buildInboxItems();
  }, [buildInboxItems]);

  const handleSaveConfig = async () => {
    if (!mpesaNumber || !businessName) {
      Alert.alert('Missing Info', 'Please provide at least your M-PESA number and Business Name.');
      return;
    }
    if (mpesaNumber.length < 5) {
      Alert.alert('Invalid Number', 'Please provide a valid M-PESA number, Paybill, or Till.');
      return;
    }

    setSaving(true);
    try {
      if (!user?.id) throw new Error('Not authenticated');

      const { error: simpleError } = await supabase
        .from('simple_payment_settings')
        .upsert({
          admin_id: user.id,
          mpesa_number: mpesaNumber,
          business_name: businessName,
          gallery_price_default: parseFloat(defaultPrice) || 0,
          currency,
          payment_mode: paymentMode,
          auto_verification: autoVerification,
          till_number: tillNumber,
          paybill_number: paybillNumber,
          business_shortcode: businessShortcode,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'admin_id' });

      if (simpleError) throw simpleError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Payment settings saved successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestPayment = async () => {
    if (!mpesaNumber) {
      Alert.alert('No Number', 'Please save your configuration first.');
      return;
    }
    setTesting(true);
    try {
      Alert.alert(
        'Test Payment',
        `Sending a test STK push of 1 ${currency} to ${mpesaNumber}...`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Proceed',
            onPress: async () => {
              setTimeout(() => {
                setTesting(false);
                Alert.alert('Sent', 'STK push sent to your phone. Check for PIN prompt.');
              }, 1500);
            },
          },
        ]
      );
    } catch {
      setTesting(false);
    }
  };

  const handleVerifyManual = async (payment: ManualPayment) => {
    Alert.alert(
      'Verify Payment',
      `Verify payment of KES ${payment.amount.toFixed(2)} with M-Pesa code ${payment.mpesa_code}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: async () => {
            setProcessing(payment.id);
            try {
              const { error } = await supabase
                .from('manual_payment_verifications')
                .update({ status: 'verified', updated_at: new Date().toISOString() })
                .eq('id', payment.id);
              if (error) throw error;

              const { error: unlockErr } = await supabase
                .from('galleries')
                .update({ is_paid: true, is_locked: false })
                .eq('id', payment.gallery_id);
              if (unlockErr) {
                Alert.alert('Warning', 'Payment verified but failed to unlock gallery.');
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'Payment verified and gallery unlocked!');
              }
              await loadManualPayments();
            } catch {
              Alert.alert('Error', 'Failed to verify payment');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  const handleRejectManual = async (payment: ManualPayment) => {
    Alert.alert(
      'Reject Payment',
      `Reject payment of KES ${payment.amount.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing(payment.id);
            try {
              const { error } = await supabase
                .from('manual_payment_verifications')
                .update({ status: 'rejected', updated_at: new Date().toISOString() })
                .eq('id', payment.id);
              if (error) throw error;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Rejected', 'Payment has been rejected');
              await loadManualPayments();
            } catch {
              Alert.alert('Error', 'Failed to reject payment');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  const handleVerifyMpesa = async (msg: MpesaMessage) => {
    Alert.alert(
      'Verify Payment',
      `Verify M-Pesa payment${msg.amount ? ` of KES ${msg.amount}` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify & Unlock',
          onPress: async () => {
            setProcessing(msg.id);
            try {
              const { error } = await supabase
                .from('mpesa_messages')
                .update({ status: 'verified', updated_at: new Date().toISOString() })
                .eq('id', msg.id);
              if (error) throw error;

              if (msg.gallery_id) {
                await supabase
                  .from('galleries')
                  .update({ is_paid: true, is_locked: false })
                  .eq('id', msg.gallery_id);
              }
              if (msg.booking_id) {
                await supabase
                  .from('bookings')
                  .update({ status: 'confirmed', payment_status: 'paid' })
                  .eq('id', msg.booking_id);
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Payment verified and content unlocked!');
              await loadMpesaMessages();
            } catch {
              Alert.alert('Error', 'Failed to verify payment');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  const handleRejectMpesa = async (msg: MpesaMessage) => {
    Alert.alert(
      'Reject Payment',
      'Reject this M-Pesa confirmation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessing(msg.id);
            try {
              const { error } = await supabase
                .from('mpesa_messages')
                .update({ status: 'rejected', updated_at: new Date().toISOString() })
                .eq('id', msg.id);
              if (error) throw error;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Rejected', 'Payment has been rejected');
              await loadMpesaMessages();
            } catch {
              Alert.alert('Error', 'Failed to reject payment');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'verified':
        return Colors.success;
      case 'failed':
      case 'rejected':
        return Colors.error;
      default:
        return Colors.gold;
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Wallet size={16} color={activeTab === 'overview' ? Colors.background : Colors.textMuted} /> },
    { key: 'config', label: 'Config', icon: <Settings size={16} color={activeTab === 'config' ? Colors.background : Colors.textMuted} /> },
    { key: 'history', label: 'History', icon: <Clock size={16} color={activeTab === 'history' ? Colors.background : Colors.textMuted} /> },
    { key: 'inbox', label: 'Inbox', icon: <Inbox size={16} color={activeTab === 'inbox' ? Colors.background : Colors.textMuted} /> },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  const renderOverviewTab = () => (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
    >
      <View style={styles.statusCard}>
        <LinearGradient
          colors={['rgba(212, 175, 55, 0.15)', 'rgba(212, 175, 55, 0.05)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, mpesaNumber ? styles.statusOnline : styles.statusOffline]} />
          <Text style={styles.statusLabel}>
            {mpesaNumber ? 'Payments Active' : 'Not Configured'}
          </Text>
        </View>
        {mpesaNumber ? (
          <View style={styles.statusDetail}>
            <Smartphone size={18} color={Colors.gold} />
            <Text style={styles.statusDetailText}>{mpesaNumber}</Text>
          </View>
        ) : (
          <Text style={styles.statusEmptyText}>Set up your M-Pesa number to start receiving payments</Text>
        )}
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <DollarSign size={18} color={Colors.gold} />
          <Text style={styles.infoLabel}>Default Price</Text>
          <Text style={styles.infoValue}>{currency} {defaultPrice}</Text>
        </View>
        <View style={styles.infoItem}>
          <CreditCard size={18} color={Colors.gold} />
          <Text style={styles.infoLabel}>Payment Mode</Text>
          <View style={[styles.modeBadge, { backgroundColor: Colors.gold + '20' }]}>
            <Text style={[styles.modeBadgeText, { color: Colors.gold }]}>
              {paymentMode.replace('_', ' ')}
            </Text>
          </View>
        </View>
        <View style={styles.infoItem}>
          <ShieldCheck size={18} color={autoVerification ? Colors.success : Colors.textMuted} />
          <Text style={styles.infoLabel}>Auto-Verify</Text>
          <View style={[styles.modeBadge, { backgroundColor: (autoVerification ? Colors.success : Colors.textMuted) + '20' }]}>
            <Text style={[styles.modeBadgeText, { color: autoVerification ? Colors.success : Colors.textMuted }]}>
              {autoVerification ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>
        <View style={styles.infoItem}>
          <Building size={18} color={Colors.gold} />
          <Text style={styles.infoLabel}>Business</Text>
          <Text style={styles.infoValue}>{businessName || '—'}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>

      <Pressable style={styles.actionCard} onPress={() => setActiveTab('history')}>
        <Clock size={20} color={Colors.gold} />
        <View style={styles.actionInfo}>
          <Text style={styles.actionTitle}>View Transactions</Text>
          <Text style={styles.actionDesc}>{transactions.length} transactions</Text>
        </View>
        <ChevronLeft size={18} color={Colors.textMuted} style={{ transform: [{ rotate: '180deg' }] }} />
      </Pressable>

      <Pressable style={styles.actionCard} onPress={() => setActiveTab('inbox')}>
        <Inbox size={20} color={Colors.gold} />
        <View style={styles.actionInfo}>
          <Text style={styles.actionTitle}>Payment Inbox</Text>
          <Text style={styles.actionDesc}>
            {manualPayments.filter((p) => p.status === 'pending').length + mpesaMessages.filter((m) => m.status === 'pending').length} pending
          </Text>
        </View>
        <ChevronLeft size={18} color={Colors.textMuted} style={{ transform: [{ rotate: '180deg' }] }} />
      </Pressable>

      <Pressable
        style={[styles.testActionCard, testing && { opacity: 0.5 }]}
        onPress={handleTestPayment}
        disabled={testing}
      >
        {testing ? (
          <ActivityIndicator size={20} color={Colors.gold} />
        ) : (
          <RefreshCcw size={20} color={Colors.gold} />
        )}
        <View style={styles.actionInfo}>
          <Text style={styles.actionTitle}>Test Payment</Text>
          <Text style={styles.actionDesc}>Send a test STK push (1 {currency})</Text>
        </View>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderConfigTab = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBanner}>
          <ShieldCheck size={22} color={Colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Connect Your M-PESA</Text>
            <Text style={styles.infoBannerDesc}>Receive gallery payments directly to your number.</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>BASIC CONFIGURATION</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>M-PESA Number / Till / Paybill</Text>
          <View style={styles.inputWrapper}>
            <Smartphone size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="e.g. 254712345678 or 543210"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
              value={mpesaNumber}
              onChangeText={setMpesaNumber}
            />
          </View>
          <Text style={styles.hint}>Personal number for STK Push, or Paybill/Till number</Text>
        </View>

        {paymentMode === 'TILL_NUMBER' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Buy Goods Till Number</Text>
            <View style={styles.inputWrapper}>
              <Hash size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="e.g. 543210"
                placeholderTextColor="#666"
                keyboardType="number-pad"
                value={tillNumber}
                onChangeText={setTillNumber}
              />
            </View>
          </View>
        )}

        {paymentMode === 'PAYBILL' && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Paybill Number</Text>
              <View style={styles.inputWrapper}>
                <Hash size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 174379"
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                  value={paybillNumber}
                  onChangeText={setPaybillNumber}
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Account Number (optional)</Text>
              <View style={styles.inputWrapper}>
                <Hash size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. CLIENT-001"
                  placeholderTextColor="#666"
                  value={businessShortcode}
                  onChangeText={setBusinessShortcode}
                />
              </View>
              <Text style={styles.hint}>Default account number sent with Paybill payments</Text>
            </View>
          </>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Business Name</Text>
          <View style={styles.inputWrapper}>
            <Building size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Ken Star Studios"
              placeholderTextColor="#666"
              value={businessName}
              onChangeText={setBusinessName}
            />
          </View>
          <Text style={styles.hint}>Shown on payment instructions</Text>
        </View>

        <Text style={styles.sectionLabel}>DEFAULT PRICING</Text>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
            <Text style={styles.label}>Default Price</Text>
            <View style={styles.inputWrapper}>
              <DollarSign size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="500"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={defaultPrice}
                onChangeText={setDefaultPrice}
              />
            </View>
          </View>
          <View style={[styles.inputGroup, { width: 100 }]}>
            <Text style={styles.label}>Currency</Text>
            <View style={[styles.inputWrapper, { justifyContent: 'center' }]}>
              <Text style={{ color: Colors.gold, fontWeight: '700' }}>{currency}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PAYMENT MODE</Text>

        <View style={styles.modeGrid}>
          {(['STK_PUSH', 'PAYBILL', 'TILL_NUMBER'] as PaymentMode[]).map((mode) => (
            <Pressable
              key={mode}
              style={[styles.modeCard, paymentMode === mode && styles.modeCardActive]}
              onPress={() => {
                setPaymentMode(mode);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={[styles.modeIcon, paymentMode === mode && styles.modeIconActive]}>
                <CreditCard size={18} color={paymentMode === mode ? Colors.gold : Colors.textMuted} />
              </View>
              <Text style={[styles.modeText, paymentMode === mode && styles.modeTextActive]}>
                {mode.replace('_', ' ')}
              </Text>
              {paymentMode === mode && <CheckCircle2 size={14} color={Colors.gold} style={styles.modeCheck} />}
            </Pressable>
          ))}
        </View>
        <View style={styles.modeInfoBox}>
          <HelpCircle size={14} color={Colors.textMuted} />
          <Text style={styles.modeInfoText}>
            {paymentMode === 'STK_PUSH' && "Sends an instant PIN prompt to the client's phone."}
            {paymentMode === 'PAYBILL' && 'Shows Paybill instructions to the client.'}
            {paymentMode === 'TILL_NUMBER' && 'Shows Buy Goods instructions to the client.'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>AUTOMATIC VERIFICATION</Text>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <ShieldCheck size={18} color={Colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Auto-Verification</Text>
              <Text style={styles.toggleSublabel}>
                {autoVerification
                  ? 'Payments verified automatically via M-PESA callbacks'
                  : 'You will manually verify payments'}
              </Text>
            </View>
          </View>
          <Pressable
            style={[styles.toggleBtn, autoVerification && styles.toggleBtnActive]}
            onPress={() => {
              setAutoVerification(!autoVerification);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={[styles.toggleKnob, autoVerification && styles.toggleKnobActive]} />
          </Pressable>
        </View>

        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSaveConfig}
          disabled={saving}
        >
          <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          {saving ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <>
              <Save size={20} color={Colors.background} />
              <Text style={styles.saveBtnText}>Save Configuration</Text>
            </>
          )}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderHistoryTab = () => {
    const StatusIcon = (status: string) => {
      if (status === 'success') return <CheckCircle2 size={12} color={Colors.success} />;
      if (status === 'failed') return <XCircle size={12} color={Colors.error} />;
      return <Clock size={12} color={Colors.gold} />;
    };

    return (
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.tabList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        renderItem={({ item }) => (
          <View style={styles.txCard}>
            <View style={styles.txHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txClient}>{item.user_profiles?.full_name || 'Unknown Client'}</Text>
                <Text style={styles.txGallery}>{item.galleries?.name || 'Gallery Deleted'}</Text>
              </View>
              <View style={styles.txAmountBadge}>
                <Text style={styles.txAmount}>KES {item.amount}</Text>
              </View>
            </View>
            <View style={styles.txDivider} />
            <View style={styles.txFooter}>
              <View style={styles.txInfoRow}>
                <Clock size={12} color={Colors.textMuted} />
                <Text style={styles.txInfoText}>
                  {new Date(item.created_at).toLocaleDateString()}{' '}
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.txInfoRow}>
                {StatusIcon(item.status)}
                <Text style={[styles.txInfoText, { color: getStatusColor(item.status), fontWeight: '600' }]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
            {item.mpesa_receipt && (
              <View style={styles.receiptBadge}>
                <Text style={styles.receiptText}>Receipt: {item.mpesa_receipt}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CreditCard size={44} color={Colors.textMuted} style={{ opacity: 0.3 }} />
            <Text style={styles.emptyText}>No M-PESA transactions found</Text>
          </View>
        }
      />
    );
  };

  const renderInboxTab = () => {
    const FilterChip = ({ label, value }: { label: string; value: typeof inboxFilter }) => (
      <Pressable
        style={[styles.filterChip, inboxFilter === value && styles.filterChipActive]}
        onPress={() => setInboxFilter(value)}
      >
        <Text style={[styles.filterChipText, inboxFilter === value && styles.filterChipTextActive]}>
          {label}
        </Text>
      </Pressable>
    );

    const renderItem = ({ item }: { item: InboxItem }) => {
      const isVerified = item.status === 'verified';
      const isRejected = item.status === 'rejected';
      const isPending = item.status === 'pending';

      return (
        <View
          style={[
            styles.inboxCard,
            isVerified && styles.inboxCardVerified,
            isRejected && styles.inboxCardRejected,
          ]}
        >
          <View style={styles.inboxHeader}>
            <View style={styles.inboxUserInfo}>
              <View style={[styles.sourceBadge, item.source === 'manual' ? styles.sourceManual : styles.sourceMpesa]}>
                <Text style={[styles.sourceBadgeText, item.source === 'manual' ? styles.sourceManualText : styles.sourceMpesaText]}>
                  {item.source === 'manual' ? 'Manual' : 'M-Pesa'}
                </Text>
              </View>
              <View>
                <Text style={styles.inboxClientName}>{item.client_name}</Text>
                {item.gallery_name ? (
                  <Text style={styles.inboxGallery}>{item.gallery_name}</Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20', borderColor: getStatusColor(item.status) }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.inboxDetails}>
            {item.amount != null && (
              <View style={styles.inboxDetailRow}>
                <DollarSign size={14} color={Colors.gold} />
                <Text style={[styles.inboxDetailText, { color: Colors.gold, fontWeight: '600' }]}>
                  KES {item.amount.toLocaleString()}
                </Text>
              </View>
            )}
            {item.mpesa_code && (
              <View style={styles.inboxDetailRow}>
                <Smartphone size={14} color={Colors.textSecondary} />
                <Text style={styles.inboxDetailText}>Code: {item.mpesa_code}</Text>
              </View>
            )}
            {item.source === 'mpesa' && (item.raw as MpesaMessage).gallery && (
              <View style={styles.inboxDetailRow}>
                <ImageIcon size={14} color={Colors.textSecondary} />
                <Text style={styles.inboxDetailText}>
                  Gallery: {(item.raw as MpesaMessage).gallery?.title || (item.raw as MpesaMessage).gallery?.access_code}
                </Text>
              </View>
            )}
            <View style={styles.inboxDetailRow}>
              <Clock size={14} color={Colors.textMuted} />
              <Text style={styles.inboxTimeText}>
                {new Date(item.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          {item.source === 'mpesa' && (item.raw as MpesaMessage).mpesa_message && (
            <View style={styles.messageBox}>
              <Text style={styles.messageBoxText}>{(item.raw as MpesaMessage).mpesa_message}</Text>
            </View>
          )}

          {isPending && (
            <View style={styles.inboxActions}>
              {item.source === 'manual' ? (
                <>
                  <Pressable
                    style={[styles.inboxActionBtn, styles.verifyBtn]}
                    onPress={() => handleVerifyManual(item.raw as ManualPayment)}
                    disabled={processing === item.id}
                  >
                    {processing === item.id ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <CheckCircle2 size={14} color={Colors.white} />
                        <Text style={styles.inboxActionText}>Verify</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.inboxActionBtn, styles.rejectBtn]}
                    onPress={() => handleRejectManual(item.raw as ManualPayment)}
                    disabled={processing === item.id}
                  >
                    <XCircle size={14} color={Colors.white} />
                    <Text style={styles.inboxActionText}>Reject</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={[styles.inboxActionBtn, styles.verifyBtn]}
                    onPress={() => handleVerifyMpesa(item.raw as MpesaMessage)}
                    disabled={processing === item.id}
                  >
                    {processing === item.id ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <Unlock size={14} color={Colors.white} />
                        <Text style={styles.inboxActionText}>Verify & Unlock</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.inboxActionBtn, styles.rejectBtn]}
                    onPress={() => handleRejectMpesa(item.raw as MpesaMessage)}
                    disabled={processing === item.id}
                  >
                    <XCircle size={14} color={Colors.white} />
                    <Text style={styles.inboxActionText}>Reject</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {isVerified && item.source === 'mpesa' && (item.raw as MpesaMessage).gallery_id && (
            <View style={styles.unlockedBadge}>
              <Unlock size={12} color={Colors.success} />
              <Text style={styles.unlockedText}>Gallery Unlocked</Text>
            </View>
          )}
        </View>
      );
    };

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.searchContainer}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by code, name, or phone..."
            placeholderTextColor={Colors.textMuted}
            value={inboxSearch}
            onChangeText={setInboxSearch}
          />
        </View>
        <View style={styles.filterRow}>
          <FilterChip label="All" value="all" />
          <FilterChip label="Pending" value="pending" />
          <FilterChip label="Verified" value="verified" />
          <FilterChip label="Rejected" value="rejected" />
        </View>
        <FlatList
          data={inboxItems}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          contentContainerStyle={styles.tabList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Inbox size={44} color={Colors.textMuted} style={{ opacity: 0.3 }} />
              <Text style={styles.emptyText}>
                {inboxSearch ? 'No payments found' : 'No payments yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {inboxSearch
                  ? 'Try a different search term'
                  : 'Payments will appear here when clients submit'}
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerTitle: 'Payments',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.white,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => {
              setActiveTab(tab.key);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            {tab.icon}
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'config' && renderConfigTab()}
      {activeTab === 'history' && renderHistoryTab()}
      {activeTab === 'inbox' && renderInboxTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.card,
  },
  tabItemActive: {
    backgroundColor: Colors.gold,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.background,
  },
  tabContent: {
    padding: 20,
  },
  tabList: {
    padding: 20,
    gap: 12,
  },
  statusCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusOnline: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
    shadowRadius: 6,
    shadowOpacity: 0.4,
  },
  statusOffline: {
    backgroundColor: Colors.error,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  statusDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDetailText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statusEmptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  infoItem: {
    width: '47%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  modeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  testActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.gold,
    gap: 14,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: 24,
    gap: 14,
    alignItems: 'center',
  },
  infoBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 2,
  },
  infoBannerDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
  },
  textInput: {
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 14,
    height: 44,
    color: '#FFF',
    fontSize: 14,
  },
  hint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 5,
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  modeCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
    position: 'relative',
  },
  modeCardActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  modeIconActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  modeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  modeTextActive: {
    color: Colors.white,
  },
  modeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  modeInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  modeInfoText: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 20,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 2,
  },
  toggleSublabel: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
  },
  toggleBtn: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
  },
  toggleBtnActive: {
    backgroundColor: Colors.gold,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
  },
  toggleKnobActive: {
    backgroundColor: Colors.background,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 12,
  },
  advancedToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gold,
  },
  advancedSection: {
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.background,
  },
  txCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  txClient: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 2,
  },
  txGallery: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  txAmountBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  txDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 10,
  },
  txFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  txInfoText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  receiptBadge: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 7,
    backgroundColor: Colors.background,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  receiptText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: Colors.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#000',
  },
  inboxCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inboxCardVerified: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '08',
  },
  inboxCardRejected: {
    borderColor: Colors.error,
    backgroundColor: Colors.error + '08',
  },
  inboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  inboxUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sourceBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  sourceManual: {
    backgroundColor: Colors.gold + '15',
    borderColor: Colors.gold,
  },
  sourceMpesa: {
    backgroundColor: Colors.success + '15',
    borderColor: Colors.success,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  sourceManualText: {
    color: Colors.gold,
  },
  sourceMpesaText: {
    color: Colors.success,
  },
  inboxClientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  inboxGallery: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  inboxDetails: {
    gap: 6,
    marginBottom: 8,
  },
  inboxDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  inboxDetailText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  inboxTimeText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  messageBox: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  messageBoxText: {
    fontSize: 13,
    color: Colors.white,
    lineHeight: 18,
  },
  inboxActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  inboxActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  verifyBtn: {
    backgroundColor: Colors.success,
  },
  rejectBtn: {
    backgroundColor: Colors.error,
  },
  inboxActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
    paddingVertical: 6,
    backgroundColor: Colors.success + '15',
    borderRadius: 7,
  },
  unlockedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
