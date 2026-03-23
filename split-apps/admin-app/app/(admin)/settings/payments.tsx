import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, CreditCard, Save, Smartphone, User, Hash, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function PaymentConfigurationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, verifyAdminGuard } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shortcode, setShortcode] = useState('');
  const [referenceFormat, setReferenceFormat] = useState<'gallery_code' | 'client_name' | 'custom_text'>('gallery_code');
  const [recipientName, setRecipientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [passkey, setPasskey] = useState('');
  const [environment, setEnvironment] = useState<'sandbox' | 'live'>('sandbox');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [confirmationUrl, setConfirmationUrl] = useState('');
  const [validationUrl, setValidationUrl] = useState('');
  const [initiatorName, setInitiatorName] = useState('');
  const [initiatorPassword, setInitiatorPassword] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('0');
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    loadPaymentConfig(user.id);
  }, [user?.id]);

  const loadPaymentConfig = async (adminId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('admin_id', adminId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error loading payment config:', error);
        // Don't alert on load error if it's just empty
      }

      if (data) {
        setConfigId(data.id);
        setShortcode(data.shortcode || '');
        setConsumerKey(data.consumer_key || '');
        setConsumerSecret(data.consumer_secret || '');
        setPasskey(data.passkey || '');
        setEnvironment((data.environment as any) || 'sandbox');
        setCallbackUrl(data.callback_url || '');
        setConfirmationUrl(data.confirmation_url || '');
        setValidationUrl(data.validation_url || '');
        setInitiatorName(data.initiator_name || '');
        setInitiatorPassword(data.initiator_password || '');
      }
    } catch (e) {
      console.error('Exception loading config:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!shortcode || !recipientName || !phoneNumber) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    try {
      setIsSaving(true);
      const ok = await verifyAdminGuard('mpesa_payment');
      if (!ok) {
        Alert.alert('Verification Required', 'Please verify admin access to continue.');
        return;
      }

      if (!user?.id) {
        Alert.alert('Not Signed In', 'Please sign in again to continue.');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const payload = {
        admin_id: user.id,
        shortcode: shortcode,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        passkey: passkey,
        environment: environment,
        callback_url: callbackUrl,
        confirmation_url: confirmationUrl,
        validation_url: validationUrl,
        initiator_name: initiatorName,
        initiator_password: initiatorPassword,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (configId) {
        const { error: updateError } = await supabase
          .from('payment_settings')
          .update(payload)
          .eq('id', configId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('payment_settings')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;

      Alert.alert('Success', 'Payment configuration saved successfully.');
      loadPaymentConfig(user.id); // Reload to get ID if it was an insert
    } catch (e: any) {
      console.error('Error saving config:', e);
      Alert.alert('Save Failed', e.message || 'Could not save configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Payments Configuration</Text>
        <Pressable 
          onPress={() => router.push('/(admin)/settings/mpesa-transactions')} 
          style={styles.historyButton}
        >
          <Clock size={20} color={Colors.gold} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <CreditCard size={20} color={Colors.gold} />
              <Text style={styles.sectionTitle}>M-Pesa Settings</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Configure your M-Pesa Paybill or Till Number details for receiving payments.
            </Text>

            {isLoading ? (
              <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 20 }} />
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Business Paybill / Till Number</Text>
                  <View style={styles.inputContainer}>
                    <Hash size={18} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={shortcode}
                      onChangeText={setShortcode}
                      placeholder="e.g. 174379"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Account Reference Format</Text>
                  <View style={styles.row}>
                    {(['gallery_code', 'client_name', 'custom_text'] as const).map((format) => (
                      <Pressable
                        key={format}
                        style={[
                          styles.chip,
                          referenceFormat === format && styles.chipActive
                        ]}
                        onPress={() => setReferenceFormat(format)}
                      >
                        <Text style={[
                          styles.chipText,
                          referenceFormat === format && styles.chipTextActive
                        ]}>
                          {format.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Recipient Display Name</Text>
                  <Text style={styles.helperText}>This name will appear inside the client payment modal.</Text>
                  <View style={styles.inputContainer}>
                    <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={recipientName}
                      onChangeText={setRecipientName}
                      placeholder="e.g. Epix Visuals Studios.co"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone Number Receiving Payments</Text>
                  <View style={styles.inputContainer}>
                    <Smartphone size={18} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder="2547XXXXXXXX"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>System Callbacks</Text>
                  <Text style={styles.helperText}>Used for automated gallery unlocking</Text>
                  
                  <View style={styles.subInputGroup}>
                    <Text style={styles.subLabel}>STK Push Callback URL (HTTPS Highly Recommended)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={callbackUrl}
                      onChangeText={setCallbackUrl}
                      placeholder="https://your-api.com/mpesa/callback"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  <View style={styles.subInputGroup}>
                    <Text style={styles.subLabel}>C2B Confirmation URL</Text>
                    <TextInput
                      style={styles.textInput}
                      value={confirmationUrl}
                      onChangeText={setConfirmationUrl}
                      placeholder="https://your-api.com/mpesa/confirmation"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  <View style={styles.subInputGroup}>
                    <Text style={styles.subLabel}>C2B Validation URL</Text>
                    <TextInput
                      style={styles.textInput}
                      value={validationUrl}
                      onChangeText={setValidationUrl}
                      placeholder="https://your-api.com/mpesa/validation"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.divider} />

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>M-Pesa API Credentials</Text>
                  <Text style={styles.helperText}>Get these from Safaricom Daraja Portal</Text>

                  <View style={styles.subInputGroup}>
                    <Text style={styles.subLabel}>Consumer Key</Text>
                    <TextInput
                      style={styles.textInput}
                      value={consumerKey}
                      onChangeText={setConsumerKey}
                      placeholder="Daraja Consumer Key"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.subInputGroup}>
                    <Text style={styles.subLabel}>Consumer Secret</Text>
                    <TextInput
                      style={styles.textInput}
                      value={consumerSecret}
                      onChangeText={setConsumerSecret}
                      placeholder="Daraja Consumer Secret"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.subInputGroup}>
                    <Text style={styles.subLabel}>Online Passkey</Text>
                    <TextInput
                      style={styles.textInput}
                      value={passkey}
                      onChangeText={setPasskey}
                      placeholder="Daraja Online Passkey"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>B2C / Initiator Credentials</Text>
                  <View style={styles.subInputGroup}>
                    <Text style={styles.subLabel}>Initiator Name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={initiatorName}
                      onChangeText={setInitiatorName}
                      placeholder="e.g. photog_api"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <View style={styles.subInputGroup}>
                    <Text style={styles.subLabel}>Initiator Password</Text>
                    <TextInput
                      style={styles.textInput}
                      value={initiatorPassword}
                      onChangeText={setInitiatorPassword}
                      placeholder="Encrypted password from portal"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Environment</Text>
                  <View style={styles.row}>
                    {(['sandbox', 'live'] as const).map((env) => (
                      <Pressable
                        key={env}
                        style={[
                          styles.chip,
                          environment === env && styles.chipActive
                        ]}
                        onPress={() => setEnvironment(env)}
                      >
                        <Text style={[
                          styles.chipText,
                          environment === env && styles.chipTextActive
                        ]}>
                          {env.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Default Unlock Price (KES)</Text>
                  <View style={styles.inputContainer}>
                    <Hash size={18} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={defaultPrice}
                      onChangeText={setDefaultPrice}
                      placeholder="50"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <Pressable
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Save size={20} color="#000" />
                      <Text style={styles.saveButtonText}>Save Configuration</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  historyButton: {
    padding: 8,
    marginRight: -8,
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 24,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  chipText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: '#000',
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
    borderRadius: 12,
    height: 50,
    gap: 10,
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
  },
  subInputGroup: {
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 40,
    color: Colors.textPrimary,
  },
});
