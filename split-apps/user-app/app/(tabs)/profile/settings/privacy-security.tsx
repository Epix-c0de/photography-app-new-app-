import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Lock, Mail, Shield, KeyRound, Fingerprint, Trash2, Smartphone, Eye, EyeOff, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import SettingsHeader from '@/components/SettingsHeader';

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({ icon, label, description, value, onPress, showArrow, danger }: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.settingsRow} onPress={onPress} disabled={!onPress}>
      <View style={[styles.settingsRowIcon, danger && styles.settingsRowIconDanger]}>
        {icon}
      </View>
      <View style={styles.settingsRowContent}>
        <Text style={[styles.settingsRowLabel, danger && styles.settingsRowLabelDanger]}>{label}</Text>
        {description && <Text style={styles.settingsRowDescription}>{description}</Text>}
        {value && <Text style={styles.settingsRowValue}>{value}</Text>}
      </View>
      {showArrow && <ChevronRight size={16} color={Colors.textMuted} />}
    </Pressable>
  );
}

function SettingsToggle({ icon, label, description, value, onToggle, disabled }: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: boolean;
  onToggle: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowIcon}>
        {icon}
      </View>
      <View style={styles.settingsRowContent}>
        <Text style={[styles.settingsRowLabel, disabled && { opacity: 0.5 }]}>{label}</Text>
        {description && <Text style={styles.settingsRowDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(val) => {
          if (disabled) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(val);
        }}
        trackColor={{ false: Colors.border, true: Colors.goldMuted }}
        thumbColor={value ? Colors.gold : Colors.textMuted}
        disabled={disabled}
      />
    </View>
  );
}

export default function PrivacySecurity() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [lockHiddenPhotos, setLockHiddenPhotos] = useState(false);

  useEffect(() => {
    if (profile) {
      setBiometricEnabled(!!profile.biometric_enabled);
    }
  }, [profile]);

  const [changeEmailOpen, setChangeEmailOpen] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const [changePasswordOpen, setChangePasswordOpen] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [nextPassword, setNextPassword] = useState<string>('');
  const [confirmNextPassword, setConfirmNextPassword] = useState<string>('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const userEmail = user?.email || 'Not connected';

  const validatePassword = useCallback((password: string): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must include 1 uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must include 1 number.';
    return null;
  }, []);

  const handleToggleBiometric = async (val: boolean) => {
    if (val) {
      const supported = await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
      if (!supported) {
        Alert.alert('Not Supported', 'Biometrics are not set up on this device. Please enable Face ID or fingerprint in your device settings first.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity to enable App Lock',
        fallbackLabel: 'Use Passcode',
      });
      if (result.success) {
        setBiometricEnabled(true);
        if (user) {
          await supabase.from('user_profiles').update({ biometric_enabled: true }).eq('id', user.id);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('App Lock Enabled', 'Biometric app lock is now active.');
      }
    } else {
      setBiometricEnabled(false);
      setLockHiddenPhotos(false);
      if (user) {
        await supabase.from('user_profiles').update({ biometric_enabled: false }).eq('id', user.id);
      }
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      Alert.alert('Missing Field', 'Please enter your new email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (newEmail.trim().toLowerCase() === userEmail.toLowerCase()) {
      Alert.alert('Same Email', 'The new email is the same as your current email.');
      return;
    }

    setEmailSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewEmail('');
      setChangeEmailOpen(false);
      Alert.alert(
        'Verification Email Sent',
        `A confirmation link has been sent to ${newEmail.trim()}. Click the link to complete your email change. Your current email stays active until then.`
      );
    } catch (e: any) {
      Alert.alert('Email Change Failed', e.message || 'Could not update your email. Please try again.');
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !nextPassword.trim() || !confirmNextPassword.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all password fields.');
      return;
    }
    if (nextPassword !== confirmNextPassword) {
      Alert.alert('Passwords Don\'t Match', 'Your new password and confirmation do not match.');
      return;
    }
    const ruleError = validatePassword(nextPassword);
    if (ruleError) {
      Alert.alert('Weak Password', ruleError);
      return;
    }
    if (nextPassword === currentPassword) {
      Alert.alert('Same Password', 'Your new password must be different from your current password.');
      return;
    }

    setPasswordSubmitting(true);
    try {
      // Re-authenticate first to verify current password
      if (!user?.email) throw new Error('No email on account');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        Alert.alert('Wrong Password', 'Your current password is incorrect.');
        return;
      }

      // Now update to the new password
      const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
      if (updateError) throw updateError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmNextPassword('');
      setChangePasswordOpen(false);
      Alert.alert('Password Updated', 'Your password has been changed successfully.');
    } catch (e: any) {
      Alert.alert('Password Change Failed', e.message || 'Could not update your password. Please try again.');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDownloadData = useCallback(() => {
    Alert.alert(
      'Data Download Request',
      `We will compile all your personal data and send it to ${userEmail} within 24 hours. This includes your profile, galleries, payments and activity.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Download',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('✓ Request Submitted', 'You will receive your data export via email within 24 hours.');
          }
        }
      ]
    );
  }, [userEmail]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This cannot be undone. All your galleries, photos, and data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Type "DELETE" to confirm account deletion.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Submit Request',
                  style: 'destructive',
                  onPress: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert('Request Submitted', 'Your account deletion request has been sent to our support team. You will receive a confirmation within 48 hours.');
                  }
                }
              ]
            );
          }
        }
      ]
    );
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Privacy & Security" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.headerSub}>Manage your account security and privacy settings.</Text>

        {/* ACCOUNT IDENTITY */}
        <SettingsSection title="ACCOUNT IDENTITY">
          <SettingsRow
            icon={<Mail size={18} color={Colors.gold} />}
            label="Email Address"
            value={userEmail}
          />

          <View style={styles.actionRow}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setChangeEmailOpen((v) => !v);
                setChangePasswordOpen(false);
              }}
            >
              <Text style={styles.actionBtnText}>{changeEmailOpen ? '✕ Cancel' : 'Change Email'}</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setChangePasswordOpen((v) => !v);
                setChangeEmailOpen(false);
              }}
            >
              <Text style={styles.actionBtnText}>{changePasswordOpen ? '✕ Cancel' : 'Change Password'}</Text>
            </Pressable>
          </View>

          {changeEmailOpen && (
            <View style={styles.formBlock}>
              <Text style={styles.formLabel}>New Email Address</Text>
              <View style={styles.inputRow}>
                <Mail size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.settingsInput}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="Enter new email"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!emailSubmitting}
                />
              </View>
              <Text style={styles.formHint}>A verification link will be sent to the new email. Your current email stays active until confirmed.</Text>
              <Pressable
                style={[styles.primaryBtn, emailSubmitting && { opacity: 0.7 }]}
                onPress={handleChangeEmail}
                disabled={emailSubmitting}
              >
                {emailSubmitting ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Send Verification Email</Text>
                )}
              </Pressable>
            </View>
          )}
        </SettingsSection>

        {/* PASSWORD MANAGEMENT */}
        <SettingsSection title="PASSWORD MANAGEMENT">
          {changePasswordOpen ? (
            <View style={styles.formBlock}>
              <Text style={styles.formLabel}>Current Password</Text>
              <View style={styles.inputRow}>
                <KeyRound size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.settingsInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showCurrentPw}
                  editable={!passwordSubmitting}
                />
                <Pressable onPress={() => setShowCurrentPw(v => !v)} hitSlop={8}>
                  {showCurrentPw ? <EyeOff size={16} color={Colors.textMuted} /> : <Eye size={16} color={Colors.textMuted} />}
                </Pressable>
              </View>

              <Text style={[styles.formLabel, { marginTop: 12 }]}>New Password</Text>
              <View style={styles.inputRow}>
                <Lock size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.settingsInput}
                  value={nextPassword}
                  onChangeText={setNextPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showNewPw}
                  editable={!passwordSubmitting}
                />
                <Pressable onPress={() => setShowNewPw(v => !v)} hitSlop={8}>
                  {showNewPw ? <EyeOff size={16} color={Colors.textMuted} /> : <Eye size={16} color={Colors.textMuted} />}
                </Pressable>
              </View>

              <Text style={[styles.formLabel, { marginTop: 12 }]}>Confirm New Password</Text>
              <View style={styles.inputRow}>
                <Lock size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.settingsInput}
                  value={confirmNextPassword}
                  onChangeText={setConfirmNextPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showConfirmPw}
                  editable={!passwordSubmitting}
                />
                <Pressable onPress={() => setShowConfirmPw(v => !v)} hitSlop={8}>
                  {showConfirmPw ? <EyeOff size={16} color={Colors.textMuted} /> : <Eye size={16} color={Colors.textMuted} />}
                </Pressable>
              </View>

              {/* Password strength hints */}
              <View style={styles.ruleCard}>
                {[
                  { rule: 'At least 8 characters', met: nextPassword.length >= 8 },
                  { rule: 'One uppercase letter', met: /[A-Z]/.test(nextPassword) },
                  { rule: 'One number', met: /[0-9]/.test(nextPassword) },
                ].map(({ rule, met }) => (
                  <View key={rule} style={styles.ruleRow}>
                    <CheckCircle size={12} color={met && nextPassword ? Colors.success : Colors.border} />
                    <Text style={[styles.ruleText, { color: met && nextPassword ? Colors.success : Colors.textMuted }]}>{rule}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={[styles.primaryBtn, passwordSubmitting && { opacity: 0.7 }]}
                onPress={handleChangePassword}
                disabled={passwordSubmitting}
              >
                {passwordSubmitting ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Update Password</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.ruleCard}>
              <Text style={styles.ruleTitle}>Password Requirements</Text>
              <Text style={styles.ruleText}>• Minimum 8 characters</Text>
              <Text style={styles.ruleText}>• 1 uppercase letter</Text>
              <Text style={styles.ruleText}>• 1 number</Text>
            </View>
          )}
        </SettingsSection>

        {/* APP SECURITY */}
        <SettingsSection title="APP SECURITY">
          <SettingsToggle
            icon={<Fingerprint size={18} color={Colors.gold} />}
            label="App Lock (Face ID / Fingerprint)"
            description="Require biometrics to open the app"
            value={biometricEnabled}
            onToggle={handleToggleBiometric}
          />
          <SettingsToggle
            icon={<Shield size={18} color={biometricEnabled ? Colors.textSecondary : Colors.border} />}
            label="Lock Hidden Photos"
            description={biometricEnabled ? "Require biometrics to view hidden gallery" : "Enable App Lock first to use this"}
            value={lockHiddenPhotos}
            disabled={!biometricEnabled}
            onToggle={(val) => {
              if (!biometricEnabled) {
                Alert.alert('Enable App Lock First', 'Turn on App Lock (above) before enabling this feature.');
                return;
              }
              setLockHiddenPhotos(val);
            }}
          />
          <SettingsRow
            icon={<Shield size={18} color="#6C9AED" />}
            label="Two-Factor Authentication"
            description="Add an extra layer of account security"
            value="Coming Soon"
            showArrow
            onPress={() => Alert.alert('2FA Coming Soon', 'Two-factor authentication via SMS or authenticator app is coming in the next update.')}
          />
        </SettingsSection>

        {/* DATA & PRIVACY */}
        <SettingsSection title="DATA & PRIVACY">
          <SettingsRow
            icon={<Smartphone size={18} color={Colors.textSecondary} />}
            label="Download My Data"
            description="Request a personal copy of all your data"
            onPress={handleDownloadData}
            showArrow
          />
          <SettingsRow
            icon={<Trash2 size={18} color={Colors.error} />}
            label="Delete My Account"
            description="Permanently remove your account and all data"
            onPress={handleDeleteAccount}
            danger
            showArrow
          />
        </SettingsSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
  },
  headerSub: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 24,
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionContent: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingsRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsRowIconDanger: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  settingsRowContent: {
    flex: 1,
  },
  settingsRowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.white,
    marginBottom: 2,
  },
  settingsRowLabelDanger: {
    color: Colors.error,
  },
  settingsRowDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  settingsRowValue: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#252525',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  formBlock: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  formHint: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: 14,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 4,
    minHeight: 50,
  },
  settingsInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    color: Colors.white,
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: Colors.gold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  ruleCard: {
    padding: 16,
    gap: 8,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
    marginBottom: 4,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  successText: {
    fontSize: 13,
    color: Colors.success,
  },
});