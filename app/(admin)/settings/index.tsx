import { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Clock,
  CreditCard,
  KeyRound,
  Laptop,
  Mail,
  Shield,
  ShieldCheck,
  Smartphone,
  Droplets,
  Type,
  RotateCw,
  Database,
  Bell,
  Lock,
  LogOut,
  ChevronRight,
  Zap,
  Eye,
  Server,
  FileText,
  Fingerprint,
  Moon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';

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

function SettingsToggle({ icon, label, description, value, onToggle }: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowIcon}>
        {icon}
      </View>
      <View style={styles.settingsRowContent}>
        <Text style={styles.settingsRowLabel}>{label}</Text>
        {description && <Text style={styles.settingsRowDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(val) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(val);
        }}
        trackColor={{ false: Colors.border, true: Colors.goldMuted }}
        thumbColor={value ? Colors.gold : Colors.textMuted}
      />
    </View>
  );
}

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout, user, adminSecurity, updateAdminSecurity, verifyAdminGuard } = useAuth();
  const { settings: brandSettings, isLoading: brandingLoading, error: brandingError, update: updateBranding } = useBranding();

  const [brandNameDraft, setBrandNameDraft] = useState<string>('LenzArt Studio');
  const [taglineDraft, setTaglineDraft] = useState<string>('');
  const [appDisplayNameDraft, setAppDisplayNameDraft] = useState<string>('LenzArt');
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true);
  const [watermarkOpacity, setWatermarkOpacity] = useState<string>('30');
  const [watermarkRotation, setWatermarkRotation] = useState<string>('45');
  const [watermarkText, setWatermarkText] = useState<string>('LenzArt');
  const [watermarkSize, setWatermarkSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [watermarkPosition, setWatermarkPosition] = useState<'center' | 'grid' | 'randomized'>('center');
  const [autoSmsOnUpload, setAutoSmsOnUpload] = useState<boolean>(true);
  const [smsOnPayment, setSmsOnPayment] = useState<boolean>(true);
  const [autoLockGalleries, setAutoLockGalleries] = useState<boolean>(true);
  const [darkModeOnly, setDarkModeOnly] = useState<boolean>(true);
  const [screenshotProtection, setScreenshotProtection] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');
  const [changeEmailOpen, setChangeEmailOpen] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [emailPassword, setEmailPassword] = useState<string>('');
  const [emailOtp, setEmailOtp] = useState<string>('');
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const [changePasswordOpen, setChangePasswordOpen] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [nextPassword, setNextPassword] = useState<string>('');
  const [confirmNextPassword, setConfirmNextPassword] = useState<string>('');
  const [invalidateSessions, setInvalidateSessions] = useState<boolean>(false);

  const adminEmail = user?.role === 'admin' ? user.email : 'admin@lenzart.com';
  const adminPhone = user?.role === 'admin' ? user.phone : '+254711111111';

  useEffect(() => {
    if (!brandSettings) return;

    setBrandNameDraft(brandSettings.brand_name ?? 'LenzArt Studio');
    setTaglineDraft(brandSettings.tagline ?? '');
    setAppDisplayNameDraft(brandSettings.app_display_name ?? 'LenzArt');

    const opacity = brandSettings.watermark_opacity ?? 30;
    setWatermarkEnabled(opacity > 0);
    setWatermarkOpacity(String(opacity));
    setWatermarkRotation(String(brandSettings.watermark_rotation ?? 45));
    setWatermarkText(brandSettings.watermark_text ?? 'LenzArt');
    setWatermarkSize((brandSettings.watermark_size ?? 'medium') as any);
    setWatermarkPosition((brandSettings.watermark_position ?? 'center') as any);
    setScreenshotProtection(!!brandSettings.block_screenshots);
  }, [brandSettings?.id, brandSettings?.updated_at]);

  const activityLog = useMemo(
    () => ([
      { id: 'a1', label: 'Admin login', meta: 'Today • Web' },
      { id: 'a2', label: 'Viewed SMS logs', meta: 'Today • Admin panel' },
      { id: 'a3', label: 'Opened settings', meta: 'Today • Security' },
    ]),
    []
  );

  const validatePassword = useCallback((password: string): string | null => {
    if (password.length < 10) return 'Password must be at least 10 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must include 1 uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must include 1 number.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include 1 symbol.';
    return null;
  }, []);

  const handleGuardOrFallback = useCallback(async (action: Parameters<typeof verifyAdminGuard>[0]) => {
    const ok = await verifyAdminGuard(action);
    if (ok) return true;
    Alert.alert(
      'Verification Required',
      'Please verify admin access to continue.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Verify', onPress: () => router.push('/admin-login') },
      ]
    );
    return false;
  }, [router, verifyAdminGuard]);

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of the admin panel?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace('/login');
        },
      },
    ]);
  }, [logout, router]);

  const handleRefillSms = useCallback(() => {
    (async () => {
      const ok = await handleGuardOrFallback('buy_sms_bundles');
      if (!ok) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Alert.alert(
        'Refill SMS Bundle',
        'Purchase 500 SMS credits via M-Pesa for KES 2,500?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy Now', onPress: () => Alert.alert('Success', 'M-Pesa STK push sent to your phone.') },
        ]
      );
    })();
  }, [handleGuardOrFallback]);

  const handleTestSms = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Test SMS', 'A test SMS has been sent to your admin number.');
  }, []);

  const handleSaveBranding = useCallback(() => {
    (async () => {
      const ok = await handleGuardOrFallback('open_dashboard');
      if (!ok) return;

      const nextBrandName = brandNameDraft.trim();
      if (!nextBrandName) {
        Alert.alert('Missing Brand Name', 'Please enter a brand name.');
        return;
      }

      const parsedOpacity = Number.parseInt(watermarkOpacity || '0', 10);
      if (Number.isNaN(parsedOpacity) || parsedOpacity < 0 || parsedOpacity > 100) {
        Alert.alert('Invalid Opacity', 'Opacity must be a number between 0 and 100.');
        return;
      }

      const parsedRotation = Number.parseInt(watermarkRotation || '0', 10);
      if (Number.isNaN(parsedRotation) || parsedRotation < -180 || parsedRotation > 180) {
        Alert.alert('Invalid Rotation', 'Rotation must be a number between -180 and 180.');
        return;
      }

      try {
        await updateBranding({
          brand_name: nextBrandName,
          tagline: taglineDraft.trim() || null,
          app_display_name: appDisplayNameDraft.trim() || null,
          watermark_text: watermarkEnabled ? (watermarkText.trim() || null) : null,
          watermark_opacity: watermarkEnabled ? parsedOpacity : 0,
          watermark_rotation: parsedRotation,
          watermark_size: watermarkSize as any,
          watermark_position: watermarkPosition as any,
          block_screenshots: screenshotProtection,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Saved', 'Brand settings updated.');
      } catch (e: any) {
        Alert.alert('Save Failed', e?.message || 'Could not update brand settings.');
      }
    })();
  }, [
    appDisplayNameDraft,
    brandNameDraft,
    handleGuardOrFallback,
    screenshotProtection,
    taglineDraft,
    updateBranding,
    watermarkEnabled,
    watermarkOpacity,
    watermarkPosition,
    watermarkRotation,
    watermarkSize,
    watermarkText,
  ]);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
      >
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSub}>Admin configuration & controls</Text>

        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'general' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('general');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'general' && styles.tabTextActive]}>General</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'security' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('security');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'security' && styles.tabTextActive]}>Security & Login</Text>
          </Pressable>
        </View>

        {activeTab === 'general' ? (
          <>
            <SettingsSection title="BUSINESS MANAGEMENT">
              <SettingsRow
                icon={<FileText size={18} color={Colors.gold} />}
                label="Package Editor"
                description="Manage pricing, services & packages"
                onPress={() => router.push('/(admin)/settings/package-editor')}
                showArrow
              />
              <SettingsRow
                icon={<Smartphone size={18} color="#6C9AED" />}
                label="SMS Management"
                description="Bundles, balance & automated logs"
                onPress={() => router.push('/(admin)/settings/sms-management')}
                showArrow
              />
              <SettingsRow
                icon={<CreditCard size={18} color={Colors.gold} />}
                label="Payments Configuration"
                description="M-Pesa paybill, references & recipients"
                onPress={() => router.push('/(admin)/settings/payments')}
                showArrow
              />
            </SettingsSection>

            <SettingsSection title="BRANDING">
              {brandingError ? (
                <Text style={styles.sectionHint}>{brandingError}</Text>
              ) : brandingLoading ? (
                <Text style={styles.sectionHint}>Loading brand settings…</Text>
              ) : null}

              <View style={styles.inputRow}>
                <Type size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.settingsInput}
                  value={brandNameDraft}
                  onChangeText={setBrandNameDraft}
                  placeholder="Brand name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.inputRow}>
                <Mail size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.settingsInput}
                  value={taglineDraft}
                  onChangeText={setTaglineDraft}
                  placeholder="Tagline (optional)"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.inputRow}>
                <Zap size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.settingsInput}
                  value={appDisplayNameDraft}
                  onChangeText={setAppDisplayNameDraft}
                  placeholder="App display name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </SettingsSection>

            <SettingsSection title="WATERMARK">
              <SettingsToggle
                icon={<Droplets size={18} color={Colors.gold} />}
                label="Enable watermark"
                description="Apply watermark to unpaid photos"
                value={watermarkEnabled}
                onToggle={setWatermarkEnabled}
              />
              {watermarkEnabled && (
                <>
                  <View style={styles.inputRow}>
                    <Type size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.settingsInput}
                      value={watermarkText}
                      onChangeText={setWatermarkText}
                      placeholderTextColor={Colors.textMuted}
                      placeholder="Watermark text"
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <Eye size={16} color={Colors.textMuted} />
                    <Text style={styles.inputLabel}>Opacity:</Text>
                    <TextInput
                      style={[styles.settingsInput, styles.shortInput]}
                      value={watermarkOpacity}
                      onChangeText={setWatermarkOpacity}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <Text style={styles.inputSuffix}>%</Text>
                  </View>
                  <View style={styles.inputRow}>
                    <RotateCw size={16} color={Colors.textMuted} />
                    <Text style={styles.inputLabel}>Rotation:</Text>
                    <TextInput
                      style={[styles.settingsInput, styles.shortInput]}
                      value={watermarkRotation}
                      onChangeText={setWatermarkRotation}
                      keyboardType="numbers-and-punctuation"
                      maxLength={4}
                    />
                    <Text style={styles.inputSuffix}>°</Text>
                  </View>

                  <View style={styles.chipRow}>
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <Pressable
                        key={size}
                        style={[styles.chip, watermarkSize === size && styles.chipActive]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setWatermarkSize(size);
                        }}
                      >
                        <Text style={[styles.chipText, watermarkSize === size && styles.chipTextActive]}>{size.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.chipRow}>
                    {(['center', 'grid', 'randomized'] as const).map((pos) => (
                      <Pressable
                        key={pos}
                        style={[styles.chip, watermarkPosition === pos && styles.chipActive]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setWatermarkPosition(pos);
                        }}
                      >
                        <Text style={[styles.chipText, watermarkPosition === pos && styles.chipTextActive]}>{pos.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.watermarkPreview}>
                    <Text style={styles.watermarkPreviewLabel}>Preview</Text>
                    <View style={styles.watermarkPreviewBox}>
                      <Text style={[styles.watermarkPreviewText, { opacity: parseInt(watermarkOpacity || '0', 10) / 100 }]}>
                        {watermarkText}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </SettingsSection>

            <SettingsSection title="SECURITY">
              <SettingsToggle
                icon={<Lock size={18} color={Colors.warning} />}
                label="Auto-lock galleries"
                description="Lock new galleries by default"
                value={autoLockGalleries}
                onToggle={setAutoLockGalleries}
              />
              <SettingsToggle
                icon={<Shield size={18} color={Colors.error} />}
                label="Screenshot protection"
                description="Disable screenshots on gallery screens"
                value={screenshotProtection}
                onToggle={setScreenshotProtection}
              />
              <Pressable style={styles.primaryBtn} onPress={handleSaveBranding}>
                <Text style={styles.primaryBtnText}>Save Branding</Text>
              </Pressable>
            </SettingsSection>

            <SettingsSection title="APPEARANCE">
              <SettingsToggle
                icon={<Moon size={18} color="#9B8FD8" />}
                label="Dark mode only"
                description="Force luxury dark theme"
                value={darkModeOnly}
                onToggle={setDarkModeOnly}
              />
            </SettingsSection>

            <SettingsSection title="BACKEND">
              <SettingsRow
                icon={<Server size={18} color="#6C9AED" />}
                label="Backend provider"
                value="Supabase (mock)"
                onPress={() => Alert.alert('Backend', 'Backend configuration will be available in production.')}
                showArrow
              />
              <SettingsRow
                icon={<Database size={18} color={Colors.textSecondary} />}
                label="Storage"
                value="2.4 GB used"
                onPress={() => Alert.alert('Storage', 'Storage management coming soon.')}
                showArrow
              />
              <SettingsRow
                icon={<RotateCw size={18} color={Colors.textSecondary} />}
                label="Sync status"
                value="Up to date"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Alert.alert('Sync', 'All data is synced.');
                }}
                showArrow
              />
            </SettingsSection>
          </>
        ) : (
          <>
            <SettingsSection title="ACCOUNT IDENTITY">
              <SettingsRow
                icon={<Mail size={18} color={Colors.gold} />}
                label="Admin Email"
                value={pendingEmail ? `${adminEmail} (pending)` : adminEmail}
              />
              <SettingsRow
                icon={<Smartphone size={18} color="#6C9AED" />}
                label="Admin Phone"
                description="Locked • Verified"
                value={adminPhone}
              />
              <SettingsRow
                icon={<ShieldCheck size={18} color={Colors.success} />}
                label="Account Role"
                value="Admin"
              />
              <SettingsRow
                icon={<Clock size={18} color={Colors.textSecondary} />}
                label="Last Login"
                value={adminSecurity.lastLoginAtLabel}
              />
              <SettingsRow
                icon={<Laptop size={18} color={Colors.textSecondary} />}
                label="Registered Devices"
                value={`${adminSecurity.registeredDevices.filter(d => d.status === 'active').length} active`}
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
                  <Text style={styles.actionBtnText}>Change Email</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setChangePasswordOpen((v) => !v);
                    setChangeEmailOpen(false);
                  }}
                >
                  <Text style={styles.actionBtnText}>Change Password</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Re-verify Email', 'Verification link sent to your current admin email.');
                  }}
                >
                  <Text style={styles.actionBtnText}>Re-verify Email</Text>
                </Pressable>
              </View>

              {changeEmailOpen && (
                <View style={styles.formBlock}>
                  <View style={styles.inputRow}>
                    <Mail size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.settingsInput}
                      value={newEmail}
                      onChangeText={setNewEmail}
                      placeholder="New email"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <KeyRound size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.settingsInput}
                      value={emailPassword}
                      onChangeText={setEmailPassword}
                      placeholder="Current password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <Shield size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.settingsInput}
                      value={emailOtp}
                      onChangeText={(t) => setEmailOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="OTP (fallback)"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={async () => {
                      const ok = await handleGuardOrFallback('open_dashboard');
                      if (!ok) return;
                      if (!newEmail.trim() || !emailPassword.trim()) {
                        Alert.alert('Missing Fields', 'Enter new email and current password.');
                        return;
                      }
                      if (adminSecurity.biometricEnabled && emailOtp.trim().length !== 6) {
                        Alert.alert('OTP Required', 'Enter the 6-digit OTP to continue.');
                        return;
                      }
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setPendingEmail(newEmail.trim());
                      setNewEmail('');
                      setEmailPassword('');
                      setEmailOtp('');
                      setChangeEmailOpen(false);
                      Alert.alert('Email Update Requested', 'A verification link has been sent. Your old email remains active until verified.');
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Submit Email Change</Text>
                  </Pressable>
                </View>
              )}
            </SettingsSection>

            <SettingsSection title="PASSWORD MANAGEMENT">
              {changePasswordOpen && (
                <View style={styles.formBlock}>
                  <View style={styles.inputRow}>
                    <KeyRound size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.settingsInput}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Current password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <Lock size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.settingsInput}
                      value={nextPassword}
                      onChangeText={setNextPassword}
                      placeholder="New password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.inputRow}>
                    <Lock size={16} color={Colors.textMuted} />
                    <TextInput
                      style={styles.settingsInput}
                      value={confirmNextPassword}
                      onChangeText={setConfirmNextPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.inlineToggle}>
                    <View style={styles.inlineToggleLeft}>
                      <Text style={styles.inlineToggleLabel}>Invalidate old sessions</Text>
                      <Text style={styles.inlineToggleSub}>Logs out other devices after update</Text>
                    </View>
                    <Switch
                      value={invalidateSessions}
                      onValueChange={(val) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setInvalidateSessions(val);
                      }}
                      trackColor={{ false: Colors.border, true: Colors.goldMuted }}
                      thumbColor={invalidateSessions ? Colors.gold : Colors.textMuted}
                    />
                  </View>

                  <Pressable
                    style={styles.primaryBtn}
                    onPress={async () => {
                      const ok = await handleGuardOrFallback('open_dashboard');
                      if (!ok) return;
                      if (!currentPassword.trim() || !nextPassword.trim() || !confirmNextPassword.trim()) {
                        Alert.alert('Missing Fields', 'Fill in all password fields.');
                        return;
                      }
                      const ruleError = validatePassword(nextPassword);
                      if (ruleError) {
                        Alert.alert('Weak Password', ruleError);
                        return;
                      }
                      if (nextPassword !== confirmNextPassword) {
                        Alert.alert('Mismatch', 'New password fields do not match.');
                        return;
                      }
                      if (invalidateSessions) {
                        await updateAdminSecurity({
                          registeredDevices: adminSecurity.registeredDevices.map((d) => ({ ...d, status: d.id === 'd1' ? 'active' : 'revoked' })),
                        });
                      }
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setCurrentPassword('');
                      setNextPassword('');
                      setConfirmNextPassword('');
                      setInvalidateSessions(false);
                      setChangePasswordOpen(false);
                      Alert.alert('Password Updated', 'Your password has been updated successfully.');
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Update Password</Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.ruleCard}>
                <Text style={styles.ruleTitle}>Password Rules</Text>
                <Text style={styles.ruleText}>Minimum 10 characters</Text>
                <Text style={styles.ruleText}>1 uppercase letter</Text>
                <Text style={styles.ruleText}>1 number</Text>
                <Text style={styles.ruleText}>1 symbol</Text>
              </View>
            </SettingsSection>

            <SettingsSection title="BIOMETRIC SECURITY">
              <SettingsToggle
                icon={<Fingerprint size={18} color={Colors.gold} />}
                label="Enable Face ID / fingerprint"
                description="Use biometrics for admin verification"
                value={adminSecurity.biometricEnabled}
                onToggle={(val) => updateAdminSecurity({ biometricEnabled: val })}
              />
              <SettingsToggle
                icon={<Shield size={18} color={Colors.textSecondary} />}
                label="Require for Admin Dashboard"
                description="Prompt verification when opening dashboard"
                value={adminSecurity.requireBiometricForDashboard}
                onToggle={(val) => updateAdminSecurity({ requireBiometricForDashboard: val })}
              />
              <SettingsToggle
                icon={<FileText size={18} color={Colors.textSecondary} />}
                label="Require for Upload"
                description="Prompt verification before uploads"
                value={adminSecurity.requireBiometricForUpload}
                onToggle={(val) => updateAdminSecurity({ requireBiometricForUpload: val })}
              />
              <SettingsToggle
                icon={<Zap size={18} color={Colors.textSecondary} />}
                label="Require for M-Pesa"
                description="Prompt verification before STK push"
                value={adminSecurity.requireBiometricForMpesa}
                onToggle={(val) => updateAdminSecurity({ requireBiometricForMpesa: val })}
              />
              <SettingsToggle
                icon={<Smartphone size={18} color={Colors.textSecondary} />}
                label="Require for SMS bundles"
                description="Prompt verification before buying bundles"
                value={adminSecurity.requireBiometricForSmsBundles}
                onToggle={(val) => updateAdminSecurity({ requireBiometricForSmsBundles: val })}
              />
              <SettingsRow
                icon={<RotateCw size={18} color={Colors.gold} />}
                label="Re-enroll biometrics"
                description="Reset and re-verify biometrics"
                onPress={async () => {
                  const ok = await handleGuardOrFallback('open_dashboard');
                  if (!ok) return;
                  Alert.alert('Re-enroll', 'Biometric re-enrollment will be handled by the device security settings.');
                }}
                showArrow
              />
            </SettingsSection>

            <SettingsSection title="DEVICE & SESSION CONTROL">
              <SettingsToggle
                icon={<Shield size={18} color={Colors.error} />}
                label="Remote lock dashboard access"
                description="Block admin access from all devices"
                value={adminSecurity.remoteLockEnabled}
                onToggle={(val) => updateAdminSecurity({ remoteLockEnabled: val })}
              />
              {adminSecurity.registeredDevices.map((device) => (
                <SettingsRow
                  key={device.id}
                  icon={<Laptop size={18} color={device.status === 'active' ? Colors.textSecondary : Colors.error} />}
                  label={device.label}
                  description={device.lastUsedLabel}
                  value={device.status === 'active' ? 'Active' : 'Revoked'}
                  onPress={() => {
                    if (device.status !== 'active') return;
                    Alert.alert('Log out device', `Log out ${device.label}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Log out',
                        style: 'destructive',
                        onPress: () => {
                          updateAdminSecurity({
                            registeredDevices: adminSecurity.registeredDevices.map((d) => d.id === device.id ? { ...d, status: 'revoked' } : d),
                          });
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        },
                      },
                    ]);
                  }}
                  showArrow={device.status === 'active'}
                />
              ))}
            </SettingsSection>

            <SettingsSection title="EMERGENCY RECOVERY">
              <SettingsRow
                icon={<Mail size={18} color={Colors.gold} />}
                label="Reset admin access"
                description="Send recovery link to verified email"
                onPress={() => Alert.alert('Recovery', 'Recovery email sent to your verified admin email.')}
                showArrow
              />
              <SettingsRow
                icon={<Shield size={18} color={Colors.error} />}
                label="Revoke all sessions"
                description="Logs out every device immediately"
                onPress={() => {
                  Alert.alert('Revoke all sessions', 'This will log out all devices. Continue?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Revoke',
                      style: 'destructive',
                      onPress: () => {
                        updateAdminSecurity({
                          registeredDevices: adminSecurity.registeredDevices.map((d) => ({ ...d, status: 'revoked' })),
                        });
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      },
                    },
                  ]);
                }}
                showArrow
                danger
              />
              <SettingsRow
                icon={<Fingerprint size={18} color={Colors.error} />}
                label="Disable biometrics remotely"
                description="Force password + OTP fallback"
                onPress={() => {
                  updateAdminSecurity({ biometricEnabled: false });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }}
                showArrow
                danger
              />
              <View style={styles.logBlock}>
                <Text style={styles.logTitle}>Admin activity</Text>
                {activityLog.map((e) => (
                  <View key={e.id} style={styles.logRow}>
                    <Text style={styles.logLabel}>{e.label}</Text>
                    <Text style={styles.logMeta}>{e.meta}</Text>
                  </View>
                ))}
              </View>
            </SettingsSection>
          </>
        )}

        <SettingsSection title="ACCOUNT">
          <SettingsRow
            icon={<LogOut size={18} color={Colors.error} />}
            label="Sign out"
            onPress={handleLogout}
            danger
          />
        </SettingsSection>

        <View style={styles.footer}>
          <Text style={styles.footerText}>LenzArt Admin v1.0.0</Text>
          <Text style={styles.footerSub}>Luxury Photography Suite</Text>
        </View>
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  tabContainer: {
    flexDirection: 'row' as const,
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.gold,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionContent: {
    backgroundColor: '#141414',
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  settingsRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowIconDanger: {
    backgroundColor: 'rgba(231,76,60,0.1)',
  },
  settingsRowContent: {
    flex: 1,
  },
  settingsRowLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.white,
  },
  settingsRowDescription: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  settingsRowLabelDanger: {
    color: Colors.error,
  },
  settingsRowValue: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },

  smsBalanceCard: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    overflow: 'hidden' as const,
  },
  smsBalanceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  smsBalanceLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  smsBalanceValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.gold,
  },
  smsRefillBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  smsRefillBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  smsBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  smsBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  settingsInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.white,
    backgroundColor: Colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  shortInput: {
    flex: 0,
    width: 60,
    textAlign: 'center' as const,
  },
  inputSuffix: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: 'rgba(212,175,55,0.35)',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: Colors.gold,
  },
  actionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  formBlock: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: Colors.background,
  },
  inlineToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  inlineToggleLeft: {
    flex: 1,
    paddingRight: 12,
  },
  inlineToggleLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  inlineToggleSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  ruleCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  ruleTitle: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: Colors.white,
    marginBottom: 4,
  },
  ruleText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  logBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  logTitle: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: Colors.white,
    marginBottom: 10,
  },
  logRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  logLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  logMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  watermarkPreview: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  watermarkPreviewLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  watermarkPreviewBox: {
    height: 60,
    backgroundColor: '#0D0D0D',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  watermarkPreviewText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
    transform: [{ rotate: '-15deg' }],
  },
  footer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  footerSub: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
});
