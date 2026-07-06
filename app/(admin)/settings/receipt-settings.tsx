import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Save, Eye, Palette, Receipt, Building2, Phone, Mail, Globe, CreditCard } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

interface ReceiptSettings {
  business_name: string;
  business_tagline: string;
  logo_url: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  till_number: string;
  paybill_number: string;
  business_short_code: string;
  primary_color: string;
  secondary_color: string;
  footer_text: string;
  terms_and_conditions: string;
  show_qr_code: boolean;
  show_logo: boolean;
  show_tax: boolean;
  tax_percent: string;
  template: 'standard' | 'minimal' | 'detailed' | 'branded';
}

const TEMPLATES = [
  { id: 'standard', label: 'Standard', description: 'Clean and professional' },
  { id: 'minimal', label: 'Minimal', description: 'Simple and concise' },
  { id: 'detailed', label: 'Detailed', description: 'Includes all information' },
  { id: 'branded', label: 'Branded', description: 'Full brand experience' },
] as const;

const PRESET_COLORS = [
  '#d4af37', '#b8860b', '#daa520', '#ffd700',
  '#1a1a1a', '#2d2d2d', '#4a4a4a', '#666666',
  '#22c55e', '#3b82f6', '#ef4444', '#a855f7',
];

export default function ReceiptSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReceiptSettings>({
    business_name: 'Epix Visuals',
    business_tagline: 'Professional Photography',
    logo_url: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    till_number: '',
    paybill_number: '',
    business_short_code: '',
    primary_color: '#d4af37',
    secondary_color: '#1a1a1a',
    footer_text: 'Thank you for your payment!',
    terms_and_conditions: '',
    show_qr_code: true,
    show_logo: true,
    show_tax: false,
    tax_percent: '16',
    template: 'standard',
  });

  const loadSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('receipt_settings')
        .select('*')
        .eq('photographer_id', user.id)
        .single();

      if (data) {
        setSettings({
          business_name: data.business_name || 'Epix Visuals',
          business_tagline: data.business_tagline || 'Professional Photography',
          logo_url: data.logo_url || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          website: data.website || '',
          till_number: data.till_number || '',
          paybill_number: data.paybill_number || '',
          business_short_code: data.business_short_code || '',
          primary_color: data.primary_color || '#d4af37',
          secondary_color: data.secondary_color || '#1a1a1a',
          footer_text: data.footer_text || 'Thank you for your payment!',
          terms_and_conditions: data.terms_and_conditions || '',
          show_qr_code: data.show_qr_code ?? true,
          show_logo: data.show_logo ?? true,
          show_tax: data.show_tax ?? false,
          tax_percent: String(data.tax_percent || '16'),
          template: data.template || 'standard',
        });
      }
    } catch (error) {
      console.error('Failed to load receipt settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('receipt_settings')
        .upsert({
          photographer_id: user.id,
          business_name: settings.business_name,
          business_tagline: settings.business_tagline,
          logo_url: settings.logo_url,
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
          website: settings.website,
          till_number: settings.till_number,
          paybill_number: settings.paybill_number,
          business_short_code: settings.business_short_code,
          primary_color: settings.primary_color,
          secondary_color: settings.secondary_color,
          footer_text: settings.footer_text,
          terms_and_conditions: settings.terms_and_conditions,
          show_qr_code: settings.show_qr_code,
          show_logo: settings.show_logo,
          show_tax: settings.show_tax,
          tax_percent: parseFloat(settings.tax_percent) || 0,
          template: settings.template,
        }, { onConflict: 'photographer_id' });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Receipt settings updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
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
        <Text style={styles.headerTitle}>Receipt Settings</Text>
        <Pressable 
          onPress={saveSettings} 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
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
        {/* Business Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Building2 size={18} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Business Information</Text>
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>Business Name</Text>
            <TextInput
              style={styles.input}
              value={settings.business_name}
              onChangeText={(v) => updateSetting('business_name', v)}
              placeholder="Your business name"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tagline</Text>
            <TextInput
              style={styles.input}
              value={settings.business_tagline}
              onChangeText={(v) => updateSetting('business_tagline', v)}
              placeholder="Professional Photography"
            />
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Phone size={18} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Contact Information</Text>
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={settings.phone}
              onChangeText={(v) => updateSetting('phone', v)}
              placeholder="+254 XXX XXX XXX"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={settings.email}
              onChangeText={(v) => updateSetting('email', v)}
              placeholder="email@example.com"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={settings.address}
              onChangeText={(v) => updateSetting('address', v)}
              placeholder="Physical address"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              value={settings.website}
              onChangeText={(v) => updateSetting('website', v)}
              placeholder="https://yourwebsite.com"
              keyboardType="url"
            />
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CreditCard size={18} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Payment Details</Text>
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>Till Number</Text>
            <TextInput
              style={styles.input}
              value={settings.till_number}
              onChangeText={(v) => updateSetting('till_number', v)}
              placeholder="M-Pesa Till Number"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Paybill Number</Text>
            <TextInput
              style={styles.input}
              value={settings.paybill_number}
              onChangeText={(v) => updateSetting('paybill_number', v)}
              placeholder="Paybill Number"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Template Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Receipt size={18} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Receipt Template</Text>
          </View>
          
          <View style={styles.templateGrid}>
            {TEMPLATES.map((t) => (
              <Pressable
                key={t.id}
                style={[
                  styles.templateOption,
                  settings.template === t.id && styles.templateOptionActive
                ]}
                onPress={() => updateSetting('template', t.id)}
              >
                <Text style={[
                  styles.templateLabel,
                  settings.template === t.id && styles.templateLabelActive
                ]}>
                  {t.label}
                </Text>
                <Text style={styles.templateDesc}>{t.description}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Styling */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Palette size={18} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Styling</Text>
          </View>
          
          <View style={styles.field}>
            <Text style={styles.label}>Primary Color</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.slice(0, 4).map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    settings.primary_color === color && styles.colorSwatchActive
                  ]}
                  onPress={() => updateSetting('primary_color', color)}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Footer Text</Text>
            <TextInput
              style={styles.input}
              value={settings.footer_text}
              onChangeText={(v) => updateSetting('footer_text', v)}
              placeholder="Thank you for your payment!"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Terms & Conditions</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={settings.terms_and_conditions}
              onChangeText={(v) => updateSetting('terms_and_conditions', v)}
              placeholder="Optional terms and conditions"
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Options */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Eye size={18} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Display Options</Text>
          </View>
          
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show Logo</Text>
            <Switch
              value={settings.show_logo}
              onValueChange={(v) => updateSetting('show_logo', v)}
              trackColor={{ false: Colors.border, true: Colors.gold }}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show QR Code</Text>
            <Switch
              value={settings.show_qr_code}
              onValueChange={(v) => updateSetting('show_qr_code', v)}
              trackColor={{ false: Colors.border, true: Colors.gold }}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Include Tax</Text>
            <Switch
              value={settings.show_tax}
              onValueChange={(v) => updateSetting('show_tax', v)}
              trackColor={{ false: Colors.border, true: Colors.gold }}
            />
          </View>

          {settings.show_tax && (
            <View style={styles.field}>
              <Text style={styles.label}>Tax Percent (%)</Text>
              <TextInput
                style={styles.input}
                value={settings.tax_percent}
                onChangeText={(v) => updateSetting('tax_percent', v)}
                placeholder="16"
                keyboardType="numeric"
              />
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateOption: {
    width: '47%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  templateOptionActive: {
    borderColor: Colors.gold,
  },
  templateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  templateLabelActive: {
    color: Colors.gold,
  },
  templateDesc: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  colorGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: Colors.white,
    transform: [{ scale: 1.1 }],
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toggleLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
});