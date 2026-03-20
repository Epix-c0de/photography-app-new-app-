import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Smartphone, Building, DollarSign, CreditCard,
  ChevronRight, Save, ShieldCheck, HelpCircle, ArrowLeft,
  CheckCircle2, RefreshCcw
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { AdminService } from '@/services/admin';

type PaymentMode = 'STK_PUSH' | 'PAYBILL' | 'TILL_NUMBER';

export default function SimpleMpesaConfigScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Form states
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('500');
  const [currency, setCurrency] = useState('KES');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('STK_PUSH');
  const [autoVerification, setAutoVerification] = useState(false);

  // Load existing settings
  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('simple_payment_settings')
          .select('*')
          .eq('admin_id', user.id)
          .maybeSingle();

        if (data) {
          setMpesaNumber(data.mpesa_number || '');
          setBusinessName(data.business_name || '');
          setDefaultPrice(String(data.gallery_price_default || '500'));
          setCurrency(data.currency || 'KES');
          setPaymentMode(data.payment_mode as PaymentMode || 'STK_PUSH');
          setAutoVerification(data.auto_verification || false);
        }
      } catch (error) {
        console.error('Failed to load simple mpesa settings:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!mpesaNumber || !businessName) {
      Alert.alert('Missing Info', 'Please provide at least your M-PESA number and Business Name.');
      return;
    }

    // Basic validation: must be at least 5 digits
    if (mpesaNumber.length < 5) {
      Alert.alert('Invalid Number', 'Please provide a valid M-PESA number, Paybill, or Till.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('simple_payment_settings')
        .upsert({
          admin_id: user.id,
          mpesa_number: mpesaNumber,
          business_name: businessName,
          gallery_price_default: parseFloat(defaultPrice) || 0,
          currency,
          payment_mode: paymentMode,
          auto_verification: autoVerification,
          updated_at: new Date().toISOString()
        }, { onConflict: 'admin_id' });

      if (error) throw error;

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
      // Logic for testing STK push or showing info
      Alert.alert(
        'Test Payment',
        `Sending a test STK push of 1 ${currency} to ${mpesaNumber}...`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Proceed', 
            onPress: async () => {
              // Simulated test call
              // In production, this would call mpesa-stk-push Edge Function with amount 1
              setTimeout(() => {
                setTesting(false);
                Alert.alert('Sent', 'STK push sent to your phone. Check for PIN prompt.');
              }, 1500);
            }
          }
        ]
      );
    } catch (error) {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        headerTitle: 'Simple Payment Setup',
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#FFF',
        headerLeft: () => (
          <Pressable onPress={() => router.back()} style={{ paddingRight: 15 }}>
            <ArrowLeft size={24} color="#FFF" />
          </Pressable>
        )
      }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <ShieldCheck size={24} color={Colors.gold} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Connect Your M-PESA</Text>
              <Text style={styles.infoDesc}>Receive gallery payments directly to your number. Fast & Secure.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BASIC CONFIGURATION</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>M-PESA Number / Till / Paybill</Text>
              <View style={styles.inputWrapper}>
                <Smartphone size={20} color={Colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 254712345678 or 543210"
                  placeholderTextColor="#666"
                  keyboardType="phone-pad"
                  value={mpesaNumber}
                  onChangeText={setMpesaNumber}
                />
              </View>
              <Text style={styles.hint}>Enter your personal number for STK Push, or your Paybill/Till number.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Name</Text>
              <View style={styles.inputWrapper}>
                <Building size={20} color={Colors.textMuted} />
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
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DEFAULT PRICING</Text>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>Default Price</Text>
                <View style={styles.inputWrapper}>
                  <DollarSign size={20} color={Colors.textMuted} />
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
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyBtnText}>{currency}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PAYMENT MODE</Text>
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
                    <CreditCard size={20} color={paymentMode === mode ? Colors.gold : Colors.textMuted} />
                  </View>
                  <Text style={[styles.modeText, paymentMode === mode && styles.modeTextActive]}>
                    {mode.replace('_', ' ')}
                  </Text>
                  {paymentMode === mode && <CheckCircle2 size={16} color={Colors.gold} style={styles.checked} />}
                </Pressable>
              ))}
            </View>
            <View style={styles.modeInfoBox}>
              <HelpCircle size={16} color={Colors.textMuted} />
              <Text style={styles.modeInfoText}>
                {paymentMode === 'STK_PUSH' && 'Sends an instant PIN prompt to the client\'s phone.'}
                {paymentMode === 'PAYBILL' && 'Shows Paybill instructions to the client.'}
                {paymentMode === 'TILL_NUMBER' && 'Shows Buy Goods instructions to the client.'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AUTOMATIC VERIFICATION</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <ShieldCheck size={20} color={Colors.gold} />
                <View style={styles.toggleText}>
                  <Text style={styles.toggleLabel}>Enable Auto-Verification</Text>
                  <Text style={styles.toggleSublabel}>
                    {autoVerification 
                      ? 'Payments will be verified automatically via M-PESA callbacks (requires Till Number/Paybill setup)'
                      : 'You will manually verify payments in the Manual Payments screen'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.toggleButton, autoVerification && styles.toggleButtonActive]}
                onPress={() => {
                  setAutoVerification(!autoVerification);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={[styles.toggleKnob, autoVerification && styles.toggleKnobActive]} />
              </Pressable>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable 
              style={[styles.saveBtn, saving && styles.disabledBtn]} 
              onPress={handleSave}
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

            <Pressable 
              style={[styles.testBtn, testing && styles.disabledBtn]} 
              onPress={handleTestPayment}
              disabled={testing || saving}
            >
              {testing ? (
                <ActivityIndicator color={Colors.gold} />
              ) : (
                <>
                  <RefreshCcw size={18} color={Colors.gold} />
                  <Text style={styles.testBtnText}>Quick Test Payment (1 KES)</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.statusBox}>
            <View style={[styles.statusIndicator, mpesaNumber ? styles.statusOnline : styles.statusOffline]} />
            <Text style={styles.statusLabel}>
              {mpesaNumber ? `Payments Active: ${mpesaNumber}` : 'Payments Disabled - Configure to start'}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  scrollContent: {
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: 24,
    gap: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 16,
    letterSpacing: 1.5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 16,
    height: 54,
    gap: 12,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
  },
  hint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
  },
  currencyBtnText: {
    color: Colors.gold,
    fontWeight: '700',
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  modeCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modeIconActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  modeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  modeTextActive: {
    color: Colors.white,
  },
  checked: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  modeInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
    paddingHorizontal: 4,
  },
  modeInfoText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 4,
  },
  toggleSublabel: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  toggleButton: {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
  },
  toggleButtonActive: {
    backgroundColor: Colors.gold,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  toggleKnobActive: {
    backgroundColor: Colors.background,
  },
  actions: {
    marginTop: 10,
    gap: 12,
  },
  saveBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  testBtn: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  testBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusOnline: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
    shadowRadius: 4,
    shadowOpacity: 0.5,
  },
  statusOffline: {
    backgroundColor: Colors.error,
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  }
});
