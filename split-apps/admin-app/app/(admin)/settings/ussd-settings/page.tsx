import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Save, Phone, Shield, Palette, Eye, MessageSquare, HelpCircle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function USSDSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    async function checkRole() {
      if (!user?.id) return;
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsSuperAdmin(data?.role === 'super_admin');
    }
    checkRole();
  }, [user?.id]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Super admin: provider config
  const [provider, setProvider] = useState('hostpinnacle');
  const [shortCode, setShortCode] = useState('*384');
  const [apiKey, setApiKey] = useState('');
  const [apiUsername, setApiUsername] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Regular admin: branding
  const [businessName, setBusinessName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [menuOptions, setMenuOptions] = useState([
    { label: 'View My Gallery', enabled: true },
    { label: 'Download Photos', enabled: true },
    { label: 'Contact Photographer', enabled: true },
  ]);
  const [supportPhone, setSupportPhone] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [galleryAccessEnabled, setGalleryAccessEnabled] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      if (isSuperAdmin) {
        const { data } = await supabase
          .from('platform_settings')
          .select('key, value')
          .in('key', [
            'ussd_provider', 'ussd_short_code', 'hostpinnacle_api_key',
            'hostpinnacle_username', 'africastalking_api_key',
            'africastalking_username', 'ussd_callback_url', 'ussd_is_active'
          ]);
        if (data) {
          const map = Object.fromEntries(data.map((d: any) => [d.key, d.value]));
          setProvider(map.ussd_provider || 'hostpinnacle');
          setShortCode(map.ussd_short_code || '*384');
          setApiKey(map.hostpinnacle_api_key || map.africastalking_api_key || '');
          setApiUsername(map.hostpinnacle_username || map.africastalking_username || '');
          setCallbackUrl(map.ussd_callback_url || '');
          setIsActive(map.ussd_is_active === 'true');
        }
      } else {
        const { data } = await supabase
          .from('platform_settings')
          .select('key, value')
          .in('key', [
            'ussd_business_name', 'ussd_welcome_message', 'ussd_menu_options',
            'ussd_support_phone', 'ussd_custom_code', 'ussd_gallery_access'
          ]);
        if (data) {
          const map = Object.fromEntries(data.map((d: any) => [d.key, d.value]));
          setBusinessName(map.ussd_business_name || '');
          setWelcomeMessage(map.ussd_welcome_message || '');
          setSupportPhone(map.ussd_support_phone || '');
          setCustomCode(map.ussd_custom_code || '');
          setGalleryAccessEnabled(map.ussd_gallery_access !== 'false');
          if (map.ussd_menu_options) {
            try { setMenuOptions(JSON.parse(map.ussd_menu_options)); } catch {}
          }
        }

        // Load photographer code
        if (user?.id) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('photographer_code')
            .eq('id', user.id)
            .single();
          if (profile?.photographer_code && !customCode) {
            setCustomCode(profile.photographer_code);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load USSD settings:', error);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, user?.id]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = isSuperAdmin
        ? [
            { key: 'ussd_provider', value: provider },
            { key: 'ussd_short_code', value: shortCode },
            { key: provider === 'hostpinnacle' ? 'hostpinnacle_api_key' : 'africastalking_api_key', value: apiKey },
            { key: provider === 'hostpinnacle' ? 'hostpinnacle_username' : 'africastalking_username', value: apiUsername },
            { key: 'ussd_callback_url', value: callbackUrl },
            { key: 'ussd_is_active', value: String(isActive) },
          ]
        : [
            { key: 'ussd_business_name', value: businessName },
            { key: 'ussd_welcome_message', value: welcomeMessage },
            { key: 'ussd_menu_options', value: JSON.stringify(menuOptions) },
            { key: 'ussd_support_phone', value: supportPhone },
            { key: 'ussd_custom_code', value: customCode },
            { key: 'ussd_gallery_access', value: String(galleryAccessEnabled) },
          ];

      for (const update of updates) {
        const { error } = await supabase
          .from('platform_settings')
          .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });
        if (error) throw error;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'USSD settings updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    const fullCode = `*384*123*${customCode || 'CODE'}#`;
    await Clipboard.setStringAsync(fullCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied', `${fullCode} copied to clipboard`);
  };

  const toggleMenuOption = (index: number) => {
    setMenuOptions(prev => prev.map((opt, i) => i === index ? { ...opt, enabled: !opt.enabled } : opt));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isSuperAdmin ? 'USSD Provider' : 'USSD Branding'}
        </Text>
        <Pressable
          onPress={saveSettings}
          style={[styles.saveButton, saving && { opacity: 0.5 }]}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <Save size={18} color={Colors.background} />
          )}
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isSuperAdmin ? (
          /* ── SUPER ADMIN: Provider Config ── */
          <>
            <View style={styles.infoCard}>
              <Shield size={20} color={Colors.gold} />
              <Text style={styles.infoText}>
                Configure the USSD provider. Regular admins can only customize their client-facing branding.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PROVIDER</Text>
              {(['hostpinnacle', 'africastalking'] as const).map((p) => (
                <Pressable key={p} style={[styles.providerOption, provider === p && styles.providerActive]} onPress={() => setProvider(p)}>
                  <View style={[styles.radio, provider === p && styles.radioActive]} />
                  <View>
                    <Text style={styles.providerName}>{p === 'hostpinnacle' ? 'HostPinnacle' : "Africa's Talking"}</Text>
                    <Text style={styles.providerDesc}>{p === 'hostpinnacle' ? 'Shared short code *384#' : 'Sandbox/Production API'}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>API CONFIG</Text>
              <View style={styles.field}><Text style={styles.label}>Short Code</Text><TextInput style={styles.input} value={shortCode} onChangeText={setShortCode} placeholder="*384" placeholderTextColor={Colors.textMuted} /></View>
              <View style={styles.field}>
                <Text style={styles.label}>API Key</Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={apiKey} onChangeText={setApiKey} placeholder="API key" placeholderTextColor={Colors.textMuted} secureTextEntry={!showApiKey} />
                  <Pressable onPress={() => setShowApiKey(!showApiKey)} style={styles.eyeBtn}>
                    <Eye size={18} color={Colors.textMuted} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.field}><Text style={styles.label}>Username</Text><TextInput style={styles.input} value={apiUsername} onChangeText={setApiUsername} placeholder="Username" placeholderTextColor={Colors.textMuted} /></View>
              <View style={styles.field}><Text style={styles.label}>Callback URL</Text><TextInput style={styles.input} value={callbackUrl} onChangeText={setCallbackUrl} placeholder="https://..." placeholderTextColor={Colors.textMuted} autoCapitalize="none" /></View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Enable USSD</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: Colors.border, true: Colors.gold }} />
              </View>
            </View>
          </>
        ) : (
          /* ── REGULAR ADMIN: Client-Facing Branding ── */
          <>
            {/* Your USSD Code */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>YOUR USSD CODE</Text>
              <Pressable style={styles.codeCard} onPress={copyCode}>
                <View style={styles.codeRow}>
                  <Text style={styles.codeText}>*384*123*{customCode || 'CODE'}#</Text>
                  <Text style={styles.codeCopy}>TAP TO COPY</Text>
                </View>
              </Pressable>
              <Text style={styles.codeHint}>
                Clients dial this code to access your gallery directly from their phone.
              </Text>
            </View>

            {/* Gallery Access */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Phone size={18} color={Colors.gold} />
                <Text style={styles.sectionTitle}>GALLERY ACCESS</Text>
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Phone size={18} color={galleryAccessEnabled ? Colors.gold : Colors.textMuted} />
                  <View>
                    <Text style={styles.toggleLabel}>Enable USSD Access</Text>
                    <Text style={styles.toggleDesc}>Let clients access galleries via USSD</Text>
                  </View>
                </View>
                <Switch value={galleryAccessEnabled} onValueChange={setGalleryAccessEnabled} trackColor={{ false: Colors.border, true: Colors.gold }} />
              </View>
            </View>

            {/* Branding */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Palette size={18} color={Colors.gold} />
                <Text style={styles.sectionTitle}>BRANDING</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Business / Studio Name</Text>
                <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="Your Studio Name" placeholderTextColor={Colors.textMuted} />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Welcome Message</Text>
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                  value={welcomeMessage}
                  onChangeText={setWelcomeMessage}
                  placeholder="Welcome to {business_name}! Select an option:"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                />
                <Text style={styles.hint}>Use {'{business_name}'} to insert your studio name</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Support Phone</Text>
                <TextInput style={styles.input} value={supportPhone} onChangeText={setSupportPhone} placeholder="+254712345678" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
              </View>
            </View>

            {/* Menu Options */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MessageSquare size={18} color={Colors.gold} />
                <Text style={styles.sectionTitle}>MENU OPTIONS</Text>
              </View>
              <Text style={styles.hint}>Toggle which options clients see when they dial your USSD code</Text>
              {menuOptions.map((opt, i) => (
                <View key={i} style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{opt.label}</Text>
                  <Switch value={opt.enabled} onValueChange={() => toggleMenuOption(i)} trackColor={{ false: Colors.border, true: Colors.gold }} />
                </View>
              ))}
            </View>

            {/* Live Preview */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Eye size={18} color={Colors.gold} />
                <Text style={styles.sectionTitle}>LIVE PREVIEW</Text>
              </View>

              <View style={styles.phoneFrame}>
                <View style={styles.phoneNotch} />
                <View style={styles.phoneScreen}>
                  <View style={styles.phoneStatusBar}>
                    <Text style={styles.phoneTime}>12:00</Text>
                    <Text style={styles.phoneCarrier}>Safaricom</Text>
                  </View>

                  <View style={styles.ussdBar}>
                    <Text style={styles.ussdBarCode}>*384*123*{customCode || 'CODE'}#</Text>
                  </View>

                  <View style={styles.ussdMenu}>
                    <Text style={styles.ussdWelcome}>
                      {welcomeMessage
                        ? welcomeMessage.replace('{business_name}', businessName || 'Your Studio')
                        : `Welcome to ${businessName || 'Your Studio'}!`}
                    </Text>

                    <View style={styles.ussdDivider} />

                    {menuOptions.filter(o => o.enabled).map((opt, i) => (
                      <Text key={i} style={styles.ussdOption}>{i + 1}. {opt.label}</Text>
                    ))}

                    {supportPhone ? (
                      <Text style={styles.ussdSupport}>Support: {supportPhone}</Text>
                    ) : null}

                    <View style={styles.ussdInput}>
                      <Text style={styles.ussdInputText}>_</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Help */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <HelpCircle size={18} color={Colors.gold} />
                <Text style={styles.sectionTitle}>HOW IT WORKS</Text>
              </View>
              <Text style={styles.helpText}>1. Client dials *384*123*{customCode || 'CODE'}#</Text>
              <Text style={styles.helpText}>2. They see your branded welcome message</Text>
              <Text style={styles.helpText}>3. They select an option (View Gallery, etc.)</Text>
              <Text style={styles.helpText}>4. They receive a link to view/download photos</Text>
              <Text style={styles.helpText}>5. No internet or app required — works on any phone</Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  saveButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1 },
  infoCard: {
    flexDirection: 'row', margin: 16, padding: 14, borderRadius: 12, gap: 12,
    backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 4 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 10 },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleLabel: { fontSize: 14, color: Colors.textPrimary },
  toggleDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  providerOption: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, gap: 12,
  },
  providerActive: { borderColor: Colors.gold, backgroundColor: 'rgba(212,175,55,0.05)' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border },
  radioActive: { borderColor: Colors.gold, backgroundColor: Colors.gold },
  providerName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  providerDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  codeCard: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: Colors.gold, borderStyle: 'dashed',
  },
  codeRow: { alignItems: 'center' },
  codeText: { fontSize: 22, fontWeight: '800', color: Colors.gold, letterSpacing: 2 },
  codeCopy: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, marginTop: 6, letterSpacing: 1 },
  codeHint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },

  phoneFrame: {
    backgroundColor: '#1a1a1a', borderRadius: 20, borderWidth: 2, borderColor: '#333', overflow: 'hidden',
  },
  phoneNotch: { height: 20, backgroundColor: '#111', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  phoneScreen: { backgroundColor: '#111', padding: 0 },
  phoneStatusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 4 },
  phoneTime: { fontSize: 10, color: '#999' },
  phoneCarrier: { fontSize: 10, color: '#999' },
  ussdBar: { backgroundColor: '#222', paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  ussdBarCode: { fontSize: 12, color: Colors.gold, fontWeight: '600' },
  ussdMenu: { padding: 16 },
  ussdWelcome: { fontSize: 14, color: '#fff', lineHeight: 20, marginBottom: 8 },
  ussdDivider: { height: 1, backgroundColor: '#333', marginVertical: 8 },
  ussdOption: { fontSize: 14, color: '#fff', paddingVertical: 6 },
  ussdSupport: { fontSize: 12, color: Colors.gold, marginTop: 12 },
  ussdInput: { marginTop: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#333' },
  ussdInputText: { fontSize: 16, color: Colors.gold },

  helpText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
});
