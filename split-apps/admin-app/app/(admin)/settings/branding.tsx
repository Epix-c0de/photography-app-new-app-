import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Switch, Alert, ActivityIndicator, Image } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Type, Mail, Zap, Droplets, Save, Eye, Palette, Building2, Phone, CreditCard, FileText, ImagePlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding, WATERMARK_PRESETS } from '@/contexts/BrandingContext';

const RECEIPT_TEMPLATES = [
  { id: 'standard', label: 'Standard', desc: 'Clean & professional', accentBar: true, logoCircle: true, footerBorder: true },
  { id: 'minimal', label: 'Minimal', desc: 'Simple, no frills', accentBar: false, logoCircle: false, footerBorder: false },
  { id: 'detailed', label: 'Detailed', desc: 'Full breakdown', accentBar: true, logoCircle: true, footerBorder: true },
  { id: 'branded', label: 'Branded', desc: 'Full brand experience', accentBar: true, logoCircle: true, footerBorder: true },
] as const;

const WATERMARK_SIZE_OPTIONS = [
  { key: 'small', label: 'S' },
  { key: 'medium', label: 'M' },
  { key: 'large', label: 'L' },
];

interface ReceiptSettings {
  business_name: string;
  phone: string;
  email: string;
  address: string;
  till_number: string;
  paybill_number: string;
  account_number: string;
  primary_color: string;
  accent_color: string;
  footer_text: string;
  terms_and_conditions: string;
  show_logo: boolean;
  show_qr_code: boolean;
  show_tax: boolean;
  template: 'standard' | 'minimal' | 'detailed' | 'branded';
}

export default function BrandingScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { settings, update } = useBranding();

  const [brandName, setBrandName] = useState('');
  const [tagline, setTagline] = useState('');
  const [appDisplayName, setAppDisplayName] = useState('');

  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(30);
  const [watermarkRotation, setWatermarkRotation] = useState(45);
  const [watermarkSize, setWatermarkSize] = useState('medium');
  const [watermarkPosition, setWatermarkPosition] = useState('center');
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState<string | null>(null);
  const [watermarkSaving, setWatermarkSaving] = useState(false);

  const [receipt, setReceipt] = useState<ReceiptSettings>({
    business_name: '', phone: '', email: '', address: '',
    till_number: '', paybill_number: '', account_number: '',
    primary_color: '#d4af37', accent_color: '#1a1a1a',
    footer_text: 'Thank you for your payment!', terms_and_conditions: '',
    show_logo: true, show_qr_code: true, show_tax: false, template: 'standard',
  });
  const [receiptSaving, setReceiptSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setBrandName(settings.brand_name ?? '');
      setTagline(settings.tagline ?? '');
      setAppDisplayName(settings.app_display_name ?? '');
      setWatermarkEnabled(settings.watermark_text !== null && settings.watermark_text !== '');
      setWatermarkText(settings.watermark_text ?? '');
      setWatermarkOpacity(settings.watermark_opacity ?? 30);
      setWatermarkRotation(settings.watermark_rotation ?? 45);
      setWatermarkSize(settings.watermark_size ?? 'medium');
      setWatermarkPosition(settings.watermark_position ?? 'center');
      setWatermarkLogoUrl(settings.watermark_logo_url ?? null);
    }
  }, [settings]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('receipt_settings')
        .select('*')
        .eq('photographer_id', user.id)
        .single();
      if (data) {
        setReceipt({
          business_name: data.business_name ?? '',
          phone: data.phone ?? '', email: data.email ?? '',
          address: data.address ?? '', till_number: data.till_number ?? '',
          paybill_number: data.paybill_number ?? '',
          account_number: data.business_short_code ?? '',
          primary_color: data.primary_color ?? '#d4af37',
          accent_color: data.secondary_color ?? '#1a1a1a',
          footer_text: data.footer_text ?? 'Thank you for your payment!',
          terms_and_conditions: data.terms_and_conditions ?? '',
          show_logo: data.show_logo ?? true, show_qr_code: data.show_qr_code ?? true,
          show_tax: data.show_tax ?? false, template: data.template ?? 'standard',
        });
      }
    })();
  }, [user]);

  const saveBrand = async () => {
    try {
      await update({ brand_name: brandName, tagline, app_display_name: appDisplayName });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Brand identity updated');
    } catch {
      Alert.alert('Error', 'Failed to save brand identity');
    }
  };

  const saveWatermark = async () => {
    setWatermarkSaving(true);
    try {
      await update({
        watermark_text: watermarkEnabled ? watermarkText : null,
        watermark_opacity: watermarkOpacity,
        watermark_rotation: watermarkRotation,
        watermark_size: watermarkSize as any,
        watermark_position: watermarkPosition as any,
        watermark_logo_url: watermarkLogoUrl,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Watermark settings updated');
    } catch {
      Alert.alert('Error', 'Failed to save watermark settings');
    } finally {
      setWatermarkSaving(false);
    }
  };

  const pickWatermarkLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      setWatermarkLogoUrl(result.assets[0].uri);
    }
  };

  const applyWatermarkPreset = (presetKey: keyof typeof WATERMARK_PRESETS) => {
    const p = WATERMARK_PRESETS[presetKey];
    setWatermarkOpacity(p.opacity);
    setWatermarkRotation(p.rotation);
    setWatermarkSize(p.size);
    setWatermarkPosition(p.position);
  };

  const saveReceipt = async () => {
    setReceiptSaving(true);
    try {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('receipt_settings')
        .upsert({
          photographer_id: user.id,
          business_name: receipt.business_name, phone: receipt.phone,
          email: receipt.email, address: receipt.address,
          till_number: receipt.till_number, paybill_number: receipt.paybill_number,
          business_short_code: receipt.account_number,
          primary_color: receipt.primary_color, secondary_color: receipt.accent_color,
          footer_text: receipt.footer_text,
          terms_and_conditions: receipt.terms_and_conditions,
          show_logo: receipt.show_logo, show_qr_code: receipt.show_qr_code,
          show_tax: receipt.show_tax, template: receipt.template,
        }, { onConflict: 'photographer_id' });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Receipt settings updated');
    } catch {
      Alert.alert('Error', 'Failed to save receipt settings');
    } finally {
      setReceiptSaving(false);
    }
  };

  const updateReceipt = <K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) => {
    setReceipt(prev => ({ ...prev, [key]: value }));
  };

  const tmpl = RECEIPT_TEMPLATES.find(t => t.id === receipt.template) || RECEIPT_TEMPLATES[0];
  const pc = receipt.primary_color || Colors.gold;
  const ac = receipt.accent_color || '#1a1a1a';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Branding' }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>

        {/* ── Brand Identity ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Type size={18} color={Colors.gold} /><Text style={styles.sectionTitle}>Brand Identity</Text></View>
          <View style={styles.field}>
            <Text style={styles.label}>Brand Name</Text>
            <TextInput style={styles.inputFull} value={brandName} onChangeText={setBrandName} placeholder="Your studio name" placeholderTextColor={Colors.textMuted} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Tagline</Text>
            <TextInput style={styles.inputFull} value={tagline} onChangeText={setTagline} placeholder="Professional Photography" placeholderTextColor={Colors.textMuted} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>App Display Name</Text>
            <TextInput style={styles.inputFull} value={appDisplayName} onChangeText={setAppDisplayName} placeholder="Name shown in app" placeholderTextColor={Colors.textMuted} />
          </View>
          <Pressable style={styles.saveBtn} onPress={saveBrand}>
            <Save size={16} color={Colors.background} /><Text style={styles.saveBtnText}>Save Brand</Text>
          </Pressable>
        </View>

        {/* ── Watermark ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Droplets size={18} color={Colors.gold} /><Text style={styles.sectionTitle}>Watermark</Text></View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Droplets size={20} color={watermarkEnabled ? Colors.gold : Colors.textMuted} />
              <View><Text style={styles.toggleLabel}>Enable Watermark</Text><Text style={styles.toggleDesc}>Protect your photos</Text></View>
            </View>
            <Switch value={watermarkEnabled} onValueChange={setWatermarkEnabled} trackColor={{ false: Colors.border, true: Colors.goldMuted }} thumbColor={watermarkEnabled ? Colors.gold : Colors.textMuted} />
          </View>

          {watermarkEnabled && (
            <>
              {/* Presets */}
              <View style={styles.field}>
                <Text style={styles.label}>Quick Presets</Text>
                <View style={styles.chipRow}>
                  {Object.entries(WATERMARK_PRESETS).map(([key, preset]) => (
                    <Pressable key={key} style={styles.presetChip} onPress={() => applyWatermarkPreset(key as keyof typeof WATERMARK_PRESETS)}>
                      <Text style={styles.presetChipLabel}>{preset.label}</Text>
                      <Text style={styles.presetChipMeta}>{preset.opacity}% · {preset.rotation}°</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Text or Logo */}
              <View style={styles.field}>
                <Text style={styles.label}>Watermark Type</Text>
                <View style={styles.chipRow}>
                  <Pressable style={[styles.chip, !watermarkLogoUrl && styles.chipActive]} onPress={() => setWatermarkLogoUrl(null)}>
                    <Text style={[styles.chipText, !watermarkLogoUrl && styles.chipTextActive]}>Text</Text>
                  </Pressable>
                  <Pressable style={[styles.chip, !!watermarkLogoUrl && styles.chipActive]} onPress={pickWatermarkLogo}>
                    <Text style={[styles.chipText, !!watermarkLogoUrl && styles.chipTextActive]}>Logo</Text>
                  </Pressable>
                </View>
              </View>

              {!watermarkLogoUrl ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Watermark Text</Text>
                  <TextInput style={styles.inputFull} value={watermarkText} onChangeText={setWatermarkText} placeholder="Your Studio Name" placeholderTextColor={Colors.textMuted} />
                </View>
              ) : (
                <View style={styles.field}>
                  <Text style={styles.label}>Logo Preview</Text>
                  <View style={styles.logoPreviewRow}>
                    <Image source={{ uri: watermarkLogoUrl }} style={styles.logoPreviewImg} />
                    <Pressable onPress={pickWatermarkLogo} style={styles.logoChangeBtn}>
                      <ImagePlus size={14} color={Colors.gold} /><Text style={styles.logoChangeBtnText}>Change</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Opacity */}
              <View style={styles.field}>
                <View style={styles.sliderHeader}><Text style={styles.label}>Opacity</Text><Text style={styles.sliderValue}>{watermarkOpacity}%</Text></View>
                <View style={styles.sliderTrack}><View style={[styles.sliderFill, { width: `${watermarkOpacity}%` }]} /></View>
                <TextInput style={styles.numberInput} value={String(watermarkOpacity)} onChangeText={(v) => setWatermarkOpacity(Math.max(0, Math.min(100, parseInt(v) || 0)))} keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
              </View>

              {/* Rotation */}
              <View style={styles.field}>
                <View style={styles.sliderHeader}><Text style={styles.label}>Rotation</Text><Text style={styles.sliderValue}>{watermarkRotation}°</Text></View>
                <View style={styles.sliderTrack}><View style={[styles.sliderFill, { width: `${((watermarkRotation + 180) / 360) * 100}%` }]} /></View>
                <TextInput style={styles.numberInput} value={String(watermarkRotation)} onChangeText={(v) => setWatermarkRotation(Math.max(-180, Math.min(180, parseInt(v) || 0)))} keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
              </View>

              {/* Size */}
              <View style={styles.field}>
                <Text style={styles.label}>Size</Text>
                <View style={styles.chipRow}>
                  {WATERMARK_SIZE_OPTIONS.map((s) => (
                    <Pressable key={s.key} style={[styles.chip, watermarkSize === s.key && styles.chipActive]} onPress={() => setWatermarkSize(s.key)}>
                      <Text style={[styles.chipText, watermarkSize === s.key && styles.chipTextActive]}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Position */}
              <View style={styles.field}>
                <Text style={styles.label}>Position</Text>
                <View style={styles.positionGrid}>
                  {[
                    ['top-left', 'top-center', 'top-right'],
                    ['center-left', 'center', 'center-right'],
                    ['bottom-left', 'bottom-center', 'bottom-right'],
                  ].map((row, ri) => (
                    <View key={ri} style={styles.positionRow}>
                      {row.map((pos) => (
                        <Pressable
                          key={pos}
                          style={[styles.positionCell, watermarkPosition === pos && styles.positionCellActive]}
                          onPress={() => setWatermarkPosition(pos)}
                        >
                          {pos === 'center' && <View style={styles.positionDot} />}
                          {pos.includes('top') && pos.includes('left') && <View style={[styles.positionDot, { alignSelf: 'flex-start', marginLeft: 2, marginTop: 2 }]} />}
                          {pos.includes('top') && pos.includes('right') && <View style={[styles.positionDot, { alignSelf: 'flex-end', marginRight: 2, marginTop: 2 }]} />}
                          {pos.includes('bottom') && pos.includes('left') && <View style={[styles.positionDot, { alignSelf: 'flex-start', marginLeft: 2, marginBottom: 2 }]} />}
                          {pos.includes('bottom') && pos.includes('right') && <View style={[styles.positionDot, { alignSelf: 'flex-end', marginRight: 2, marginBottom: 2 }]} />}
                          {pos.includes('center') && !pos.includes('left') && !pos.includes('right') && pos !== 'center' && <View style={styles.positionDot} />}
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
              </View>

              {/* Enhanced Preview */}
              <View style={styles.field}>
                <Text style={styles.label}>Live Preview</Text>
                <View style={styles.watermarkPreview}>
                  <View style={styles.watermarkPreviewPhoto}>
                    <View style={styles.photoOverlay}>
                      <View style={styles.photoMountain1} />
                      <View style={styles.photoMountain2} />
                      <View style={styles.photoSun} />
                    </View>
                    {/* Watermark overlay */}
                    <View style={[
                      styles.watermarkOverlay,
                      watermarkPosition.includes('top') && { top: 12 },
                      watermarkPosition.includes('bottom') && { bottom: 12 },
                      watermarkPosition.includes('left') && !watermarkPosition.includes('right') && { left: 12 },
                      watermarkPosition.includes('right') && !watermarkPosition.includes('left') && { right: 12 },
                      !watermarkPosition.includes('left') && !watermarkPosition.includes('right') && { alignSelf: 'center' },
                      !watermarkPosition.includes('top') && !watermarkPosition.includes('bottom') && { top: '40%' },
                    ]}>
                      {watermarkLogoUrl ? (
                        <Image source={{ uri: watermarkLogoUrl }} style={[styles.watermarkLogoPreview, {
                          opacity: watermarkOpacity / 100,
                          transform: [{ rotate: `${watermarkRotation}deg` }],
                        }]} />
                      ) : (
                        <Text style={[styles.watermarkPreviewText, {
                          opacity: watermarkOpacity / 100,
                          transform: [{ rotate: `${watermarkRotation}deg` }],
                          fontSize: watermarkSize === 'small' ? 10 : watermarkSize === 'large' ? 18 : 14,
                        }]}>
                          {watermarkText || 'Studio'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}

          <Pressable style={[styles.saveBtn, watermarkSaving && { opacity: 0.6 }]} onPress={saveWatermark} disabled={watermarkSaving}>
            {watermarkSaving ? <ActivityIndicator size="small" color={Colors.background} /> : <Save size={16} color={Colors.background} />}
            <Text style={styles.saveBtnText}>{watermarkSaving ? 'Saving...' : 'Save Watermark'}</Text>
          </Pressable>
        </View>

        {/* ── Receipt ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}><FileText size={18} color={Colors.gold} /><Text style={styles.sectionTitle}>Receipt</Text></View>

          {/* Template Presets */}
          <View style={styles.field}>
            <Text style={styles.label}>Template</Text>
            <View style={styles.templateGrid}>
              {RECEIPT_TEMPLATES.map((t) => (
                <Pressable key={t.id} style={[styles.templateCard, receipt.template === t.id && styles.templateCardActive]} onPress={() => updateReceipt('template', t.id)}>
                  <View style={[styles.templateMiniPreview, { borderColor: receipt.template === t.id ? pc : Colors.border }]}>
                    {t.accentBar && <View style={[styles.miniAccentBar, { backgroundColor: pc }]} />}
                    <View style={styles.miniBody}>
                      {t.logoCircle && <View style={[styles.miniLogo, { borderColor: pc }]} />}
                      <View style={styles.miniLine1} />
                      <View style={styles.miniLine2} />
                      {t.id === 'detailed' && <View style={styles.miniLine3} />}
                      {t.footerBorder && <View style={[styles.miniFooter, { borderTopColor: pc }]} />}
                    </View>
                  </View>
                  <Text style={[styles.templateLabel, receipt.template === t.id && { color: pc }]}>{t.label}</Text>
                  <Text style={styles.templateDesc}>{t.desc}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Business Info */}
          <View style={styles.field}><Text style={styles.label}>Business Name</Text><TextInput style={styles.inputFull} value={receipt.business_name} onChangeText={(v) => updateReceipt('business_name', v)} placeholder="Studio name" placeholderTextColor={Colors.textMuted} /></View>
          <View style={styles.field}><Text style={styles.label}>Phone</Text><TextInput style={styles.inputFull} value={receipt.phone} onChangeText={(v) => updateReceipt('phone', v)} placeholder="+254..." placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" /></View>
          <View style={styles.field}><Text style={styles.label}>Email</Text><TextInput style={styles.inputFull} value={receipt.email} onChangeText={(v) => updateReceipt('email', v)} placeholder="email@example.com" placeholderTextColor={Colors.textMuted} keyboardType="email-address" /></View>
          <View style={styles.field}><Text style={styles.label}>Address</Text><TextInput style={styles.inputFull} value={receipt.address} onChangeText={(v) => updateReceipt('address', v)} placeholder="Physical address" placeholderTextColor={Colors.textMuted} /></View>

          <View style={styles.divider} />

          {/* Payment */}
          <View style={styles.field}><Text style={styles.label}>Till Number</Text><TextInput style={styles.inputFull} value={receipt.till_number} onChangeText={(v) => updateReceipt('till_number', v)} placeholder="M-Pesa Till" placeholderTextColor={Colors.textMuted} keyboardType="numeric" /></View>
          <View style={styles.field}><Text style={styles.label}>Paybill Number</Text><TextInput style={styles.inputFull} value={receipt.paybill_number} onChangeText={(v) => updateReceipt('paybill_number', v)} placeholder="Paybill" placeholderTextColor={Colors.textMuted} keyboardType="numeric" /></View>

          <View style={styles.divider} />

          {/* Styling */}
          <View style={styles.field}>
            <Text style={styles.label}>Colors</Text>
            <View style={styles.chipRow}>
              {['#d4af37', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c'].map((c) => (
                <Pressable key={c} style={[styles.colorSwatch, { backgroundColor: c }, receipt.primary_color === c && styles.colorSwatchActive]} onPress={() => updateReceipt('primary_color', c)} />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Accent Color</Text>
            <View style={styles.chipRow}>
              {['#1a1a1a', '#0f172a', '#1e293b', '#ffffff'].map((c) => (
                <Pressable key={c} style={[styles.colorSwatch, { backgroundColor: c, borderWidth: c === '#ffffff' ? 2 : 0 }, receipt.accent_color === c && styles.colorSwatchActive]} onPress={() => updateReceipt('accent_color', c)} />
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Toggles */}
          <View style={styles.toggleRow}><Text style={styles.toggleLabel}>Show Logo</Text><Switch value={receipt.show_logo} onValueChange={(v) => updateReceipt('show_logo', v)} trackColor={{ false: Colors.border, true: Colors.gold }} /></View>
          <View style={styles.toggleRow}><Text style={styles.toggleLabel}>Show QR Code</Text><Switch value={receipt.show_qr_code} onValueChange={(v) => updateReceipt('show_qr_code', v)} trackColor={{ false: Colors.border, true: Colors.gold }} /></View>
          <View style={styles.toggleRow}><Text style={styles.toggleLabel}>Include Tax</Text><Switch value={receipt.show_tax} onValueChange={(v) => updateReceipt('show_tax', v)} trackColor={{ false: Colors.border, true: Colors.gold }} /></View>

          <View style={styles.field}><Text style={styles.label}>Footer Text</Text><TextInput style={styles.inputFull} value={receipt.footer_text} onChangeText={(v) => updateReceipt('footer_text', v)} placeholder="Thank you!" placeholderTextColor={Colors.textMuted} /></View>
          <View style={styles.field}><Text style={styles.label}>Terms</Text><TextInput style={[styles.inputFull, { height: 60, textAlignVertical: 'top' }]} value={receipt.terms_and_conditions} onChangeText={(v) => updateReceipt('terms_and_conditions', v)} placeholder="Optional" placeholderTextColor={Colors.textMuted} multiline /></View>

          <Pressable style={[styles.saveBtn, receiptSaving && { opacity: 0.6 }]} onPress={saveReceipt} disabled={receiptSaving}>
            {receiptSaving ? <ActivityIndicator size="small" color={Colors.background} /> : <Save size={16} color={Colors.background} />}
            <Text style={styles.saveBtnText}>{receiptSaving ? 'Saving...' : 'Save Receipt'}</Text>
          </Pressable>

          {/* Live Receipt Preview */}
          <View style={styles.divider} />
          <View style={styles.sectionHeader}><Eye size={18} color={Colors.gold} /><Text style={styles.sectionTitle}>Receipt Preview</Text></View>

          {/* ── STANDARD ── */}
          {receipt.template === 'standard' && (
            <View style={[styles.receiptPreview, { borderColor: pc }]}>
              <View style={[styles.rpHeader, { backgroundColor: ac }]}>
                {receipt.show_logo && (
                  <View style={[styles.rpLogo, { borderColor: pc }]}>
                    <Text style={[styles.rpLogoText, { color: pc }]}>{(receipt.business_name || 'B')[0].toUpperCase()}</Text>
                  </View>
                )}
                <Text style={[styles.rpBizName, { color: '#fff' }]}>{receipt.business_name || 'Your Business'}</Text>
                {receipt.phone ? <Text style={[styles.rpContact, { color: '#ccc' }]}>{receipt.phone}</Text> : null}
                {receipt.email ? <Text style={[styles.rpContact, { color: '#ccc' }]}>{receipt.email}</Text> : null}
              </View>
              <View style={styles.rpBody}>
                <Text style={[styles.rpTitle, { color: pc }]}>PAYMENT RECEIPT</Text>
                <View style={[styles.rpDivider, { backgroundColor: pc + '30' }]} />
                <View style={styles.rpRow}><Text style={styles.rpLabel}>Date</Text><Text style={styles.rpValue}>{new Date().toLocaleDateString()}</Text></View>
                <View style={styles.rpRow}><Text style={styles.rpLabel}>Receipt No</Text><Text style={styles.rpValue}>RCP-0001</Text></View>
                <View style={[styles.rpDivider, { backgroundColor: pc + '30' }]} />
                <View style={styles.rpRow}><Text style={styles.rpLabel}>Service</Text><Text style={styles.rpValue}>Gallery Access</Text></View>
                {receipt.show_tax && <><View style={styles.rpRow}><Text style={styles.rpLabel}>Subtotal</Text><Text style={styles.rpValue}>KES 4,310.00</Text></View><View style={styles.rpRow}><Text style={styles.rpLabel}>VAT (16%)</Text><Text style={styles.rpValue}>KES 689.60</Text></View></>}
                <View style={[styles.rpDivider, { backgroundColor: pc + '30' }]} />
                <View style={styles.rpRow}>
                  <Text style={[styles.rpLabel, { fontWeight: '800', fontSize: 14 }]}>Total</Text>
                  <Text style={[styles.rpValue, { color: pc, fontWeight: '800', fontSize: 18 }]}>KES 5,000.00</Text>
                </View>
                {(receipt.till_number || receipt.paybill_number) && (
                  <View style={[styles.rpPayBox, { borderColor: pc + '30' }]}>
                    <Text style={[styles.rpPayTitle, { color: pc }]}>PAY VIA M-PESA</Text>
                    {receipt.till_number ? <View style={styles.rpRow}><Text style={styles.rpLabel}>Buy Goods</Text><Text style={[styles.rpValue, { fontWeight: '700' }]}>{receipt.till_number}</Text></View> : null}
                    {receipt.paybill_number ? <View style={styles.rpRow}><Text style={styles.rpLabel}>Paybill</Text><Text style={[styles.rpValue, { fontWeight: '700' }]}>{receipt.paybill_number}</Text></View> : null}
                  </View>
                )}
                {receipt.show_qr_code && <View style={styles.rpQRBox}><View style={[styles.rpQR, { borderColor: pc }]}><Text style={[styles.rpQRText, { color: pc }]}>QR</Text></View><Text style={styles.rpQRLabel}>Scan to pay</Text></View>}
              </View>
              <View style={[styles.rpFooter, { borderTopWidth: 2, borderTopColor: pc }]}>
                {receipt.footer_text ? <Text style={[styles.rpFooterText, { color: pc }]}>{receipt.footer_text}</Text> : null}
                {receipt.terms_and_conditions ? <Text style={styles.rpTerms}>{receipt.terms_and_conditions}</Text> : null}
              </View>
            </View>
          )}

          {/* ── MINIMAL ── */}
          {receipt.template === 'minimal' && (
            <View style={[styles.receiptPreview, { borderColor: '#e5e5e5' }]}>
              <View style={{ padding: 20, backgroundColor: '#fff' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#111', textAlign: 'center', marginBottom: 4 }}>
                  {receipt.business_name || 'Your Business'}
                </Text>
                {receipt.phone ? <Text style={{ fontSize: 11, color: '#999', textAlign: 'center' }}>{receipt.phone}</Text> : null}
                {receipt.email ? <Text style={{ fontSize: 11, color: '#999', textAlign: 'center' }}>{receipt.email}</Text> : null}
              </View>
              <View style={{ height: 1, backgroundColor: '#eee', marginHorizontal: 20 }} />
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#999', textAlign: 'center', letterSpacing: 2, marginBottom: 12 }}>RECEIPT</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: '#999' }}>Date</Text>
                  <Text style={{ fontSize: 11, color: '#333' }}>{new Date().toLocaleDateString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: '#999' }}>Ref</Text>
                  <Text style={{ fontSize: 11, color: '#333' }}>RCP-0001</Text>
                </View>
                <View style={{ height: 1, backgroundColor: '#f0f0f0', marginVertical: 10 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: '#333' }}>Gallery Access</Text>
                  <Text style={{ fontSize: 12, color: '#333' }}>KES 4,310</Text>
                </View>
                {receipt.show_tax && <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: '#999' }}>VAT (16%)</Text>
                  <Text style={{ fontSize: 11, color: '#999' }}>KES 689.60</Text>
                </View>}
                <View style={{ height: 1, backgroundColor: '#f0f0f0', marginVertical: 10 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#111' }}>Total</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#111' }}>KES 5,000.00</Text>
                </View>
              </View>
              <View style={{ paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#fafafa' }}>
                {receipt.footer_text ? <Text style={{ fontSize: 10, color: '#bbb', textAlign: 'center' }}>{receipt.footer_text}</Text> : null}
              </View>
            </View>
          )}

          {/* ── DETAILED ── */}
          {receipt.template === 'detailed' && (
            <View style={[styles.receiptPreview, { borderColor: pc }]}>
              <View style={[styles.rpHeader, { backgroundColor: ac, paddingBottom: 12 }]}>
                {receipt.show_logo && (
                  <View style={[styles.rpLogo, { borderColor: pc, width: 48, height: 48, borderRadius: 24 }]}>
                    <Text style={[styles.rpLogoText, { color: pc, fontSize: 22 }]}>{(receipt.business_name || 'B')[0].toUpperCase()}</Text>
                  </View>
                )}
                <Text style={[styles.rpBizName, { color: '#fff', fontSize: 17 }]}>{receipt.business_name || 'Your Business'}</Text>
                {receipt.phone ? <Text style={[styles.rpContact, { color: '#aaa' }]}>{receipt.phone}</Text> : null}
                {receipt.email ? <Text style={[styles.rpContact, { color: '#aaa' }]}>{receipt.email}</Text> : null}
                {receipt.address ? <Text style={[styles.rpContact, { color: '#aaa' }]}>{receipt.address}</Text> : null}
              </View>
              <View style={styles.rpBody}>
                <Text style={[styles.rpTitle, { color: pc, fontSize: 13, letterSpacing: 2 }]}>ITEMIZED RECEIPT</Text>
                <View style={[styles.rpDivider, { backgroundColor: pc }]} />
                {/* Table Header */}
                <View style={{ flexDirection: 'row', paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                  <Text style={{ flex: 2, fontSize: 10, fontWeight: '700', color: '#999' }}>ITEM</Text>
                  <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#999', textAlign: 'center' }}>QTY</Text>
                  <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#999', textAlign: 'right' }}>PRICE</Text>
                  <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#999', textAlign: 'right' }}>TOTAL</Text>
                </View>
                {/* Line Items */}
                <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
                  <Text style={{ flex: 2, fontSize: 11, color: '#333' }}>Gallery Access</Text>
                  <Text style={{ flex: 1, fontSize: 11, color: '#333', textAlign: 'center' }}>1</Text>
                  <Text style={{ flex: 1, fontSize: 11, color: '#333', textAlign: 'right' }}>KES 4,310</Text>
                  <Text style={{ flex: 1, fontSize: 11, color: '#333', textAlign: 'right' }}>KES 4,310</Text>
                </View>
                <View style={{ flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
                  <Text style={{ flex: 2, fontSize: 11, color: '#333' }}>Hi-Res Download</Text>
                  <Text style={{ flex: 1, fontSize: 11, color: '#333', textAlign: 'center' }}>1</Text>
                  <Text style={{ flex: 1, fontSize: 11, color: '#333', textAlign: 'right' }}>KES 690</Text>
                  <Text style={{ flex: 1, fontSize: 11, color: '#333', textAlign: 'right' }}>KES 690</Text>
                </View>
                <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 8 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: '#666' }}>Subtotal</Text>
                  <Text style={{ fontSize: 11, color: '#333' }}>KES 5,000.00</Text>
                </View>
                {receipt.show_tax && <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: '#666' }}>VAT (16%)</Text>
                  <Text style={{ fontSize: 11, color: '#333' }}>KES 800.00</Text>
                </View>}
                <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 8 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#111' }}>AMOUNT DUE</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: pc }}>KES 5,800.00</Text>
                </View>
                {(receipt.till_number || receipt.paybill_number) && (
                  <View style={[styles.rpPayBox, { borderColor: pc + '40', backgroundColor: pc + '08' }]}>
                    <Text style={[styles.rpPayTitle, { color: pc }]}>PAYMENT METHOD</Text>
                    {receipt.till_number ? <View style={styles.rpRow}><Text style={styles.rpLabel}>Buy Goods (Till)</Text><Text style={[styles.rpValue, { fontWeight: '700', color: pc }]}>{receipt.till_number}</Text></View> : null}
                    {receipt.paybill_number ? <View style={styles.rpRow}><Text style={styles.rpLabel}>Paybill</Text><Text style={[styles.rpValue, { fontWeight: '700', color: pc }]}>{receipt.paybill_number}</Text></View> : null}
                    {receipt.account_number ? <View style={styles.rpRow}><Text style={styles.rpLabel}>Account</Text><Text style={styles.rpValue}>{receipt.account_number}</Text></View> : null}
                  </View>
                )}
                {receipt.show_qr_code && <View style={styles.rpQRBox}><View style={[styles.rpQR, { borderColor: pc }]}><Text style={[styles.rpQRText, { color: pc }]}>QR</Text></View><Text style={styles.rpQRLabel}>Scan to pay</Text></View>}
              </View>
              <View style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#fafafa', borderTopWidth: 1, borderTopColor: '#eee' }}>
                {receipt.footer_text ? <Text style={{ fontSize: 11, fontWeight: '600', color: pc, textAlign: 'center', marginBottom: 4 }}>{receipt.footer_text}</Text> : null}
                {receipt.terms_and_conditions ? <Text style={{ fontSize: 8, color: '#bbb', textAlign: 'center', lineHeight: 11 }}>{receipt.terms_and_conditions}</Text> : null}
              </View>
            </View>
          )}

          {/* ── BRANDED ── */}
          {receipt.template === 'branded' && (
            <View style={[styles.receiptPreview, { borderColor: pc }]}>
              <View style={[styles.rpHeader, { backgroundColor: ac, paddingVertical: 24, paddingHorizontal: 16 }]}>
                {receipt.show_logo && (
                  <View style={[styles.rpLogo, { borderColor: pc, width: 56, height: 56, borderRadius: 28, borderWidth: 3, marginBottom: 8 }]}>
                    <Text style={[styles.rpLogoText, { color: pc, fontSize: 26 }]}>{(receipt.business_name || 'B')[0].toUpperCase()}</Text>
                  </View>
                )}
                <Text style={[styles.rpBizName, { color: pc, fontSize: 20, letterSpacing: 1 }]}>{receipt.business_name || 'Your Business'}</Text>
                {receipt.phone ? <Text style={[styles.rpContact, { color: '#aaa', marginTop: 2 }]}>{receipt.phone}</Text> : null}
                {receipt.email ? <Text style={[styles.rpContact, { color: '#aaa' }]}>{receipt.email}</Text> : null}
                <View style={{ width: 40, height: 2, backgroundColor: pc, marginTop: 12, borderRadius: 1 }} />
              </View>
              <View style={styles.rpBody}>
                <Text style={[styles.rpTitle, { color: pc, fontSize: 14, letterSpacing: 3, fontWeight: '800' }]}>RECEIPT</Text>
                <View style={{ height: 8 }} />
                <View style={[styles.rpRow, { paddingVertical: 5 }]}>
                  <Text style={[styles.rpLabel, { fontWeight: '600' }]}>Date</Text>
                  <Text style={[styles.rpValue, { fontWeight: '600' }]}>{new Date().toLocaleDateString()}</Text>
                </View>
                <View style={[styles.rpRow, { paddingVertical: 5 }]}>
                  <Text style={[styles.rpLabel, { fontWeight: '600' }]}>Reference</Text>
                  <Text style={[styles.rpValue, { fontWeight: '600' }]}>RCP-0001</Text>
                </View>
                <View style={{ height: 1, backgroundColor: '#f0f0f0', marginVertical: 10 }} />
                <View style={[styles.rpRow, { paddingVertical: 5 }]}>
                  <Text style={[styles.rpLabel, { fontWeight: '600', color: '#333' }]}>Service</Text>
                  <Text style={[styles.rpValue, { fontWeight: '600', color: '#333' }]}>Gallery Access</Text>
                </View>
                {receipt.show_tax && <>
                  <View style={[styles.rpRow, { paddingVertical: 4 }]}><Text style={[styles.rpLabel, { fontSize: 10 }]}>Subtotal</Text><Text style={[styles.rpValue, { fontSize: 10 }]}>KES 4,310.00</Text></View>
                  <View style={[styles.rpRow, { paddingVertical: 4 }]}><Text style={[styles.rpLabel, { fontSize: 10 }]}>VAT (16%)</Text><Text style={[styles.rpValue, { fontSize: 10 }]}>KES 689.60</Text></View>
                </>}
                <View style={{ height: 1, backgroundColor: '#f0f0f0', marginVertical: 10 }} />
                {/* Total in accent box */}
                <View style={{ backgroundColor: pc, borderRadius: 8, padding: 12, alignItems: 'center', marginVertical: 8 }}>
                  <Text style={{ fontSize: 10, color: '#fff', fontWeight: '600', letterSpacing: 1, marginBottom: 2 }}>TOTAL AMOUNT</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>KES 5,000.00</Text>
                </View>
                {(receipt.till_number || receipt.paybill_number) && (
                  <View style={[styles.rpPayBox, { borderColor: pc + '30', backgroundColor: '#fafafa', borderRadius: 8 }]}>
                    <Text style={[styles.rpPayTitle, { color: pc }]}>M-PESA</Text>
                    {receipt.till_number ? <View style={styles.rpRow}><Text style={styles.rpLabel}>Till</Text><Text style={[styles.rpValue, { fontWeight: '700', color: pc }]}>{receipt.till_number}</Text></View> : null}
                    {receipt.paybill_number ? <View style={styles.rpRow}><Text style={styles.rpLabel}>Paybill</Text><Text style={[styles.rpValue, { fontWeight: '700', color: pc }]}>{receipt.paybill_number}</Text></View> : null}
                  </View>
                )}
                {receipt.show_qr_code && <View style={styles.rpQRBox}><View style={[styles.rpQR, { borderColor: pc, width: 52, height: 52, borderRadius: 8 }]}><Text style={[styles.rpQRText, { color: pc }]}>QR</Text></View><Text style={styles.rpQRLabel}>Scan to pay</Text></View>}
              </View>
              <View style={{ paddingVertical: 14, paddingHorizontal: 16, backgroundColor: ac, alignItems: 'center' }}>
                {receipt.footer_text ? <Text style={{ fontSize: 12, fontWeight: '700', color: pc, marginBottom: 4 }}>{receipt.footer_text}</Text> : null}
                {receipt.terms_and_conditions ? <Text style={{ fontSize: 8, color: '#888', textAlign: 'center', lineHeight: 11 }}>{receipt.terms_and_conditions}</Text> : null}
                <Text style={{ fontSize: 9, color: '#666', marginTop: 8 }}>Powered by Epix Visuals</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16 },
  section: { backgroundColor: Colors.card, borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  field: { marginBottom: 16 },
  label: { fontSize: 13, color: Colors.textMuted, marginBottom: 8 },
  inputFull: { backgroundColor: Colors.background, borderRadius: 8, padding: 12, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  numberInput: { backgroundColor: Colors.background, borderRadius: 8, padding: 10, fontSize: 14, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, marginTop: 8, width: 70 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleLabel: { fontSize: 14, color: Colors.textPrimary },
  toggleDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderValue: { fontSize: 14, fontWeight: '700', color: Colors.gold },
  sliderTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginVertical: 8 },
  sliderFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.background, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.goldMuted, borderColor: Colors.gold },
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  chipTextActive: { color: Colors.gold },
  presetChip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  presetChipLabel: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  presetChipMeta: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  positionGrid: { gap: 4 },
  positionRow: { flexDirection: 'row', gap: 4 },
  positionCell: { flex: 1, height: 36, backgroundColor: Colors.background, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  positionCellActive: { borderColor: Colors.gold, backgroundColor: Colors.goldMuted },
  positionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold },
  logoPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoPreviewImg: { width: 48, height: 48, borderRadius: 8 },
  logoChangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.gold },
  logoChangeBtnText: { fontSize: 12, color: Colors.gold, fontWeight: '600' },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  templateCard: { width: '47%', backgroundColor: Colors.background, borderRadius: 12, padding: 12, borderWidth: 2, borderColor: Colors.border, alignItems: 'center' },
  templateCardActive: { borderColor: Colors.gold },
  templateMiniPreview: { width: '100%', height: 70, borderRadius: 6, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  miniAccentBar: { height: 4 },
  miniBody: { padding: 6, gap: 3 },
  miniLogo: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, alignSelf: 'center', marginBottom: 3 },
  miniLine1: { height: 3, backgroundColor: '#ddd', borderRadius: 1, width: '80%' },
  miniLine2: { height: 3, backgroundColor: '#eee', borderRadius: 1, width: '60%' },
  miniLine3: { height: 3, backgroundColor: '#f0f0f0', borderRadius: 1, width: '70%' },
  miniFooter: { height: 1, marginTop: 3, borderTopWidth: 1 },
  templateLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  templateDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { borderWidth: 3, borderColor: Colors.gold },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.gold, borderRadius: 12, padding: 14, marginTop: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: Colors.background },
  watermarkPreview: { height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#2d2d2d' },
  watermarkPreviewPhoto: { flex: 1, position: 'relative' },
  photoOverlay: { flex: 1, backgroundColor: '#4a7c59', justifyContent: 'flex-end' },
  photoMountain1: { position: 'absolute', bottom: 40, left: 20, width: 0, height: 0, borderLeftWidth: 50, borderRightWidth: 50, borderBottomWidth: 60, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#5a8c69' },
  photoMountain2: { position: 'absolute', bottom: 40, right: 10, width: 0, height: 0, borderLeftWidth: 40, borderRightWidth: 40, borderBottomWidth: 50, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#3d6b4a' },
  photoSun: { position: 'absolute', top: 20, right: 30, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fbbf24' },
  watermarkOverlay: { position: 'absolute' },
  watermarkPreviewText: { color: '#fff', fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  watermarkLogoPreview: { width: 40, height: 40, resizeMode: 'contain' },
  receiptPreview: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 2, overflow: 'hidden' },
  rpHeader: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12 },
  rpLogo: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 6, backgroundColor: '#fff' },
  rpLogoText: { fontSize: 18, fontWeight: '800' },
  rpBizName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  rpContact: { fontSize: 10, color: '#999' },
  rpBody: { padding: 14 },
  rpTitle: { fontSize: 12, fontWeight: '700', textAlign: 'center', letterSpacing: 1, marginBottom: 6 },
  rpDivider: { height: 1, marginVertical: 6 },
  rpRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rpLabel: { fontSize: 11, color: '#666' },
  rpValue: { fontSize: 11, color: '#222' },
  rpPayBox: { marginTop: 8, padding: 8, borderRadius: 6, borderWidth: 1, backgroundColor: '#fafafa' },
  rpPayTitle: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginBottom: 4, letterSpacing: 0.5 },
  rpQRBox: { alignItems: 'center', marginVertical: 8 },
  rpQR: { width: 48, height: 48, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  rpQRText: { fontSize: 14, fontWeight: '700' },
  rpQRLabel: { fontSize: 9, color: '#999' },
  rpFooter: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#fafafa' },
  rpFooterText: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  rpTerms: { fontSize: 8, color: '#999', textAlign: 'center', lineHeight: 11 },
});
