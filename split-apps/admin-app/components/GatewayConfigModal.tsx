import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Pressable,
  Alert,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  X,
  CheckCircle,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Shield,
  Smartphone,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { encrypt, maskSecret, generateCallbackUrl, generateConfirmationUrl, generateValidationUrl } from '@/lib/encryption';

type GatewayType = 'till' | 'paybill';
type Environment = 'sandbox' | 'production';

interface GatewayConfig {
  id?: string;
  client_id: string;
  gateway_type: GatewayType;
  shortcode: string;
  account_reference?: string;
  consumer_key: string;
  consumer_secret: string;
  passkey: string;
  environment: Environment;
  is_active: boolean;
}

interface GatewayConfigModalProps {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  existingConfig?: GatewayConfig | null;
  onSave: (config: GatewayConfig) => void;
}

interface FormErrors {
  shortcode?: string;
  account_reference?: string;
  consumer_key?: string;
  consumer_secret?: string;
  passkey?: string;
}

export default function GatewayConfigModal({
  visible,
  onClose,
  clientId,
  existingConfig,
  onSave,
}: GatewayConfigModalProps) {
  // ── STATE ──────────────────────────────────────────────────────────
  const [gatewayType, setGatewayType] = useState<GatewayType>('till');
  const [shortcode, setShortcode] = useState('');
  const [accountReference, setAccountReference] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [passkey, setPasskey] = useState('');
  const [environment, setEnvironment] = useState<Environment>('sandbox');
  const [isActive, setIsActive] = useState(false);

  const [showCredentials, setShowCredentials] = useState(false);
  const [showConsumerSecret, setShowConsumerSecret] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState('');
  const [testLatency, setTestLatency] = useState(0);

  const [errors, setErrors] = useState<FormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Animation
  const scaleAnim = useState(new Animated.Value(0.9))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];

  // ── EFFECTS ────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      // Reset form or populate with existing config
      if (existingConfig) {
        setGatewayType(existingConfig.gateway_type);
        setShortcode(existingConfig.shortcode);
        setAccountReference(existingConfig.account_reference || '');
        setConsumerKey(existingConfig.consumer_key);
        setConsumerSecret(existingConfig.consumer_secret);
        setPasskey(existingConfig.passkey);
        setEnvironment(existingConfig.environment);
        setIsActive(existingConfig.is_active);
      } else {
        resetForm();
      }

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
        }),
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
        }),
      ]).start();
    }
  }, [visible, existingConfig]);

  // ── FORM VALIDATION ────────────────────────────────────────────────
  const validateForm = useCallback((): FormErrors => {
    const newErrors: FormErrors = {};

    // Shortcode: exactly 5-7 digits
    if (!shortcode.trim()) {
      newErrors.shortcode = 'Shortcode is required';
    } else if (!/^\d{5,7}$/.test(shortcode.trim())) {
      newErrors.shortcode = 'Must be exactly 5-7 digits';
    }

    // Account reference (Paybill only): 1-12 alphanumeric, no spaces
    if (gatewayType === 'paybill') {
      if (accountReference && !/^[a-zA-Z0-9]{1,12}$/.test(accountReference.trim())) {
        newErrors.account_reference = '1-12 alphanumeric characters, no spaces';
      }
    }

    // Consumer key: non-empty, trimmed
    if (!consumerKey.trim()) {
      newErrors.consumer_key = 'Consumer key is required';
    }

    // Consumer secret: non-empty, trimmed
    if (!consumerSecret.trim()) {
      newErrors.consumer_secret = 'Consumer secret is required';
    }

    // Passkey: non-empty, min 20 chars
    if (!passkey.trim()) {
      newErrors.passkey = 'Passkey is required';
    } else if (passkey.trim().length < 20) {
      newErrors.passkey = 'Must be at least 20 characters';
    }

    return newErrors;
  }, [shortcode, accountReference, gatewayType, consumerKey, consumerSecret, passkey]);

  const hasErrors = Object.keys(errors).length > 0;
  const isFormValid = Object.keys(validateForm()).length === 0;

  // ── HANDLERS ───────────────────────────────────────────────────────
  const resetForm = () => {
    setGatewayType('till');
    setShortcode('');
    setAccountReference('');
    setConsumerKey('');
    setConsumerSecret('');
    setPasskey('');
    setEnvironment('sandbox');
    setIsActive(false);
    setTestStatus('idle');
    setTestError('');
    setErrors({});
    setIsDirty(false);
  };

  const handleGatewayTypeChange = (type: GatewayType) => {
    setGatewayType(type);
    // Clear fields that don't apply to the new type
    if (type === 'till') {
      setAccountReference('');
    }
    setIsDirty(true);
  };

  const handleTestConnection = async () => {
    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    setTestStatus('testing');
    setTestError('');

    try {
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('mpesa-test-connection', {
        body: {
          consumer_key: consumerKey.trim(),
          consumer_secret: consumerSecret.trim(),
          environment,
        },
      });

      if (error) throw error;

      const latency = Date.now() - startTime;
      setTestLatency(latency);
      setTestStatus('success');
    } catch (e: any) {
      setTestStatus('failed');
      setTestError(e.message || 'Connection test failed');
    }
  };

  const handleSave = async () => {
    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    // Warn if saving without testing in production
    if (environment === 'production' && testStatus !== 'success') {
      Alert.alert(
        'Save Without Testing?',
        'You are saving production credentials without testing the connection. This could cause payment failures. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', onPress: () => performSave() },
        ]
      );
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    setIsSaving(true);

    try {
      const config: GatewayConfig = {
        id: existingConfig?.id,
        client_id: clientId,
        gateway_type: gatewayType,
        shortcode: shortcode.trim(),
        account_reference: gatewayType === 'paybill' ? accountReference.trim() : undefined,
        consumer_key: consumerKey.trim(),
        consumer_secret: consumerSecret.trim(),
        passkey: passkey.trim(),
        environment,
        is_active: isActive,
      };

      onSave(config);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'URL copied to clipboard');
  };

  // ── RENDER ─────────────────────────────────────────────────────────
  const callbackUrl = generateCallbackUrl(clientId);
  const confirmationUrl = generateConfirmationUrl(clientId);
  const validationUrl = generateValidationUrl(clientId);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {existingConfig ? 'Edit Gateway' : 'Configure M-Pesa Gateway'}
            </Text>
            <Pressable onPress={handleCancel} style={styles.closeButton}>
              <X size={24} color={Colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* STEP 1: GATEWAY TYPE */}
            <Text style={styles.sectionTitle}>Gateway Type</Text>
            <View style={styles.segmentedControl}>
              <Pressable
                style={[
                  styles.segment,
                  gatewayType === 'till' && styles.segmentActive,
                ]}
                onPress={() => handleGatewayTypeChange('till')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    gatewayType === 'till' && styles.segmentTextActive,
                  ]}
                >
                  Till Number
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.segment,
                  gatewayType === 'paybill' && styles.segmentActive,
                ]}
                onPress={() => handleGatewayTypeChange('paybill')}
              >
                <Text
                  style={[
                    styles.segmentText,
                    gatewayType === 'paybill' && styles.segmentTextActive,
                  ]}
                >
                  Paybill
                </Text>
              </Pressable>
            </View>

            {/* SHORTCODE FIELD */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                {gatewayType === 'till' ? 'Till Number' : 'Business Number'}
              </Text>
              <TextInput
                style={[styles.input, errors.shortcode && styles.inputError]}
                value={shortcode}
                onChangeText={(text) => {
                  setShortcode(text.replace(/\D/g, ''));
                  setIsDirty(true);
                  if (errors.shortcode) setErrors({ ...errors, shortcode: undefined });
                }}
                placeholder="e.g. 123456"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                maxLength={7}
              />
              {errors.shortcode && <Text style={styles.errorText}>{errors.shortcode}</Text>}
            </View>

            {/* ACCOUNT REFERENCE (Paybill only) */}
            {gatewayType === 'paybill' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Account Reference (Optional)</Text>
                <TextInput
                  style={[styles.input, errors.account_reference && styles.inputError]}
                  value={accountReference}
                  onChangeText={(text) => {
                    setAccountReference(text.replace(/\s/g, ''));
                    setIsDirty(true);
                    if (errors.account_reference)
                      setErrors({ ...errors, account_reference: undefined });
                  }}
                  placeholder="e.g. INV001"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={12}
                />
                {errors.account_reference && (
                  <Text style={styles.errorText}>{errors.account_reference}</Text>
                )}
              </View>
            )}

            {/* STEP 2: CREDENTIALS (Collapsible) */}
            <Pressable
              style={styles.sectionHeader}
              onPress={() => setShowCredentials(!showCredentials)}
            >
              <View style={styles.sectionHeaderLeft}>
                <Shield size={18} color={Colors.gold} />
                <Text style={styles.sectionTitle}>Daraja API Credentials</Text>
              </View>
              {showCredentials ? (
                <ChevronUp size={20} color={Colors.textMuted} />
              ) : (
                <ChevronDown size={20} color={Colors.textMuted} />
              )}
            </Pressable>

            {showCredentials && (
              <View style={styles.credentialsContainer}>
                {/* Consumer Key */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Consumer Key</Text>
                  <TextInput
                    style={[styles.input, styles.inputMonospace, errors.consumer_key && styles.inputError]}
                    value={consumerKey}
                    onChangeText={(text) => {
                      setConsumerKey(text);
                      setIsDirty(true);
                      if (errors.consumer_key) setErrors({ ...errors, consumer_key: undefined });
                    }}
                    placeholder="Enter consumer key"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {errors.consumer_key && (
                    <Text style={styles.errorText}>{errors.consumer_key}</Text>
                  )}
                </View>

                {/* Consumer Secret */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Consumer Secret</Text>
                  <View style={styles.passwordWrapper}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.inputMonospace,
                        styles.passwordInput,
                        errors.consumer_secret && styles.inputError,
                      ]}
                      value={consumerSecret}
                      onChangeText={(text) => {
                        setConsumerSecret(text);
                        setIsDirty(true);
                        if (errors.consumer_secret)
                          setErrors({ ...errors, consumer_secret: undefined });
                      }}
                      placeholder="Enter consumer secret"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showConsumerSecret}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      style={styles.showHideButton}
                      onPress={() => setShowConsumerSecret(!showConsumerSecret)}
                    >
                      <Text style={styles.showHideText}>
                        {showConsumerSecret ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                  </View>
                  {errors.consumer_secret && (
                    <Text style={styles.errorText}>{errors.consumer_secret}</Text>
                  )}
                </View>

                {/* Passkey */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Passkey (Lipa Na M-Pesa)</Text>
                  <View style={styles.passwordWrapper}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.inputMonospace,
                        styles.passwordInput,
                        errors.passkey && styles.inputError,
                      ]}
                      value={passkey}
                      onChangeText={(text) => {
                        setPasskey(text);
                        setIsDirty(true);
                        if (errors.passkey) setErrors({ ...errors, passkey: undefined });
                      }}
                      placeholder="Enter passkey (min 20 characters)"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showPasskey}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      style={styles.showHideButton}
                      onPress={() => setShowPasskey(!showPasskey)}
                    >
                      <Text style={styles.showHideText}>
                        {showPasskey ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                  </View>
                  {errors.passkey && <Text style={styles.errorText}>{errors.passkey}</Text>}
                </View>

                {/* Environment Selector */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Environment</Text>
                  <View style={styles.radioGroup}>
                    <Pressable
                      style={styles.radioOption}
                      onPress={() => {
                        setEnvironment('sandbox');
                        setIsDirty(true);
                        setTestStatus('idle');
                      }}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          environment === 'sandbox' && styles.radioCircleActive,
                        ]}
                      >
                        {environment === 'sandbox' && <View style={styles.radioDot} />}
                      </View>
                      <Text style={styles.radioLabel}>Sandbox</Text>
                    </Pressable>
                    <Pressable
                      style={styles.radioOption}
                      onPress={() => {
                        setEnvironment('production');
                        setIsDirty(true);
                        setTestStatus('idle');
                      }}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          environment === 'production' && styles.radioCircleActive,
                        ]}
                      >
                        {environment === 'production' && <View style={styles.radioDot} />}
                      </View>
                      <Text style={styles.radioLabel}>Production</Text>
                    </Pressable>
                  </View>

                  {environment === 'sandbox' && (
                    <View style={styles.sandboxBanner}>
                      <AlertCircle size={16} color="#F39C12" />
                      <Text style={styles.sandboxBannerText}>
                        Sandbox mode — test transactions only
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* STEP 3: AUTO-GENERATED URLs */}
            <Text style={styles.sectionTitle}>Auto-Generated URLs</Text>
            <Text style={styles.sectionDescription}>
              Register these URLs on the Daraja portal for C2B (Paybill) configuration.
            </Text>

            {/* Callback URL */}
            <View style={styles.urlContainer}>
              <Text style={styles.urlLabel}>Callback URL</Text>
              <View style={styles.urlRow}>
                <TextInput
                  style={styles.urlInput}
                  value={callbackUrl}
                  editable={false}
                  selectTextOnFocus
                />
                <Pressable style={styles.copyButton} onPress={() => copyToClipboard(callbackUrl)}>
                  <Copy size={18} color={Colors.gold} />
                </Pressable>
              </View>
            </View>

            {/* Validation URL */}
            <View style={styles.urlContainer}>
              <Text style={styles.urlLabel}>Validation URL</Text>
              <View style={styles.urlRow}>
                <TextInput
                  style={styles.urlInput}
                  value={validationUrl}
                  editable={false}
                  selectTextOnFocus
                />
                <Pressable
                  style={styles.copyButton}
                  onPress={() => copyToClipboard(validationUrl)}
                >
                  <Copy size={18} color={Colors.gold} />
                </Pressable>
              </View>
            </View>

            {/* Confirmation URL */}
            <View style={styles.urlContainer}>
              <Text style={styles.urlLabel}>Confirmation URL</Text>
              <View style={styles.urlRow}>
                <TextInput
                  style={styles.urlInput}
                  value={confirmationUrl}
                  editable={false}
                  selectTextOnFocus
                />
                <Pressable
                  style={styles.copyButton}
                  onPress={() => copyToClipboard(confirmationUrl)}
                >
                  <Copy size={18} color={Colors.gold} />
                </Pressable>
              </View>
            </View>
          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            {/* Test Connection Status */}
            {testStatus === 'success' && (
              <View style={styles.testResult}>
                <CheckCircle size={16} color="#2ECC71" />
                <Text style={styles.testSuccessText}>
                  Connected ({testLatency}ms)
                </Text>
              </View>
            )}
            {testStatus === 'failed' && (
              <View style={styles.testResult}>
                <AlertCircle size={16} color="#F44336" />
                <Text style={styles.testFailedText}>{testError}</Text>
              </View>
            )}

            <View style={styles.footerButtons}>
              <Pressable
                style={styles.testButton}
                onPress={handleTestConnection}
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing' ? (
                  <ActivityIndicator size="small" color={Colors.gold} />
                ) : (
                  <Text style={styles.testButtonText}>Test Connection</Text>
                )}
              </Pressable>

              <Pressable
                style={[
                  styles.saveButton,
                  (testStatus !== 'success' && environment === 'production') &&
                    styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Configuration</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── STYLES ──────────────────────────────────────────────────────────
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
    maxWidth: 450,
    maxHeight: '90%',
    backgroundColor: Colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
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
    padding: 20,
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 16,
    lineHeight: 18,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: Colors.gold,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: '#000',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  inputMonospace: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    fontSize: 11,
    color: '#F44336',
    marginTop: 4,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  showHideButton: {
    position: 'absolute',
    right: 12,
  },
  showHideText: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  credentialsContainer: {
    marginBottom: 16,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 24,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: Colors.gold,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gold,
  },
  radioLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  sandboxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F39C1215',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  sandboxBannerText: {
    fontSize: 12,
    color: '#F39C12',
    fontWeight: '500',
  },
  urlContainer: {
    marginBottom: 12,
  },
  urlLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    padding: 8,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  testResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  testSuccessText: {
    fontSize: 12,
    color: '#2ECC71',
    fontWeight: '500',
  },
  testFailedText: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '500',
    flex: 1,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  testButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
});
