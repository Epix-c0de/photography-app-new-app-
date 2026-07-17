import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Type,
  Droplets,
  Save,
  Eye,
  ImagePlus,
  Palette,
  Share2,
  Phone,
  Globe,
  ChevronRight,
  Check,
  Clock,
  Link2,
  Mail,
  MapPin,
  ExternalLink,
  X,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useBranding, WATERMARK_PRESETS } from '@/contexts/BrandingContext';

type TabKey = 'identity' | 'visual' | 'social' | 'contact';

const TABS: { key: TabKey; label: string; icon: typeof Type }[] = [
  { key: 'identity', label: 'Brand', icon: Type },
  { key: 'visual', label: 'Design', icon: Palette },
  { key: 'social', label: 'Social', icon: Share2 },
  { key: 'contact', label: 'Contact', icon: Phone },
];

const WATERMARK_SIZE_OPTIONS = [
  { key: 'small', label: 'S' },
  { key: 'medium', label: 'M' },
  { key: 'large', label: 'L' },
];

const COLOR_PRESETS = [
  { name: 'Gold Luxury', primary: '#D4AF37', secondary: '#1A1A1A', accent: '#E8CC6E' },
  { name: 'Royal Blue', primary: '#2563EB', secondary: '#0F172A', accent: '#60A5FA' },
  { name: 'Emerald', primary: '#059669', secondary: '#064E3B', accent: '#34D399' },
  { name: 'Rose Gold', primary: '#E8A0BF', secondary: '#2D1B2E', accent: '#F4C2D7' },
  { name: 'Midnight', primary: '#6366F1', secondary: '#1E1B4B', accent: '#A5B4FC' },
  { name: 'Sunset', primary: '#F97316', secondary: '#431407', accent: '#FDBA74' },
  { name: 'Monochrome', primary: '#F8FAFC', secondary: '#0A0A0A', accent: '#94A3B8' },
  { name: 'Crimson', primary: '#DC2626', secondary: '#450A0A', accent: '#FCA5A5' },
];

interface SocialLinks {
  instagram: string;
  facebook: string;
  twitter: string;
  tiktok: string;
  youtube: string;
  website: string;
}

interface ContactInfo {
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  country: string;
}

export default function BrandingScreen() {
  const insets = useSafeAreaInsets();
  const { settings, update, refresh } = useBranding();

  const [activeTab, setActiveTab] = useState<TabKey>('identity');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const saveIndicatorAnim = useRef(new Animated.Value(0)).current;

  // Brand Identity
  const [brandName, setBrandName] = useState('');
  const [tagline, setTagline] = useState('');
  const [appDisplayName, setAppDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Visual Design
  const [primaryColor, setPrimaryColor] = useState('#D4AF37');
  const [secondaryColor, setSecondaryColor] = useState('#1A1A1A');
  const [accentColor, setAccentColor] = useState('#E8CC6E');
  const [customPrimary, setCustomPrimary] = useState('');
  const [customSecondary, setCustomSecondary] = useState('');
  const [customAccent, setCustomAccent] = useState('');
  const [showCustomColors, setShowCustomColors] = useState(false);

  // Watermark
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState(30);
  const [watermarkRotation, setWatermarkRotation] = useState(45);
  const [watermarkSize, setWatermarkSize] = useState('medium');
  const [watermarkPosition, setWatermarkPosition] = useState('center');
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState<string | null>(null);

  // Social Links
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    instagram: '',
    facebook: '',
    twitter: '',
    tiktok: '',
    youtube: '',
    website: '',
  });

  // Contact Info
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    city: '',
    country: '',
  });

  // Deep Links
  const [shareAppLink, setShareAppLink] = useState('');
  const [accessCodeLink, setAccessCodeLink] = useState('');
  const [btsShareLink, setBtsShareLink] = useState('');
  const [announcementShareLink, setAnnouncementShareLink] = useState('');
  const [galleryShareLink, setGalleryShareLink] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [whatsappShareLink, setWhatsappShareLink] = useState('');

  const markDirty = useCallback(() => setHasUnsavedChanges(true), []);

  useEffect(() => {
    if (settings) {
      setBrandName(settings.brand_name ?? '');
      setTagline(settings.tagline ?? '');
      setAppDisplayName(settings.app_display_name ?? '');
      setLogoUrl(settings.logo_url ?? null);
      setWatermarkEnabled(settings.watermark_text !== null && settings.watermark_text !== '');
      setWatermarkText(settings.watermark_text ?? '');
      setWatermarkOpacity(settings.watermark_opacity ?? 30);
      setWatermarkRotation(settings.watermark_rotation ?? 45);
      setWatermarkSize(settings.watermark_size ?? 'medium');
      setWatermarkPosition(settings.watermark_position ?? 'center');
      setWatermarkLogoUrl(settings.watermark_logo_url ?? null);
      setShareAppLink(settings.share_app_link ?? '');
      setAccessCodeLink(settings.access_code_link ?? '');
      setBtsShareLink(settings.bts_share_link ?? '');
      setAnnouncementShareLink(settings.announcement_share_link ?? '');
      setGalleryShareLink(settings.gallery_share_link ?? '');
      setReferralLink(settings.referral_link ?? '');
      setWhatsappShareLink(settings.whatsapp_share_link ?? '');
      setLastSyncedAt(new Date());
      setHasUnsavedChanges(false);
    }
  }, [settings]);

  const showSaveSuccess = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(saveIndicatorAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(saveIndicatorAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    setLastSyncedAt(new Date());
    setHasUnsavedChanges(false);
  };

  const saveBrandIdentity = async () => {
    setIsSaving(true);
    try {
      await update({
        brand_name: brandName,
        tagline,
        app_display_name: appDisplayName,
        logo_url: logoUrl,
      });
      showSaveSuccess();
    } catch {
      Alert.alert('Error', 'Failed to save brand identity');
    } finally {
      setIsSaving(false);
    }
  };

  const saveVisualDesign = async () => {
    setIsSaving(true);
    try {
      await update({
        watermark_text: watermarkEnabled ? watermarkText : null,
        watermark_opacity: watermarkOpacity,
        watermark_rotation: watermarkRotation,
        watermark_size: watermarkSize as any,
        watermark_position: watermarkPosition as any,
        watermark_logo_url: watermarkLogoUrl,
      });
      showSaveSuccess();
    } catch {
      Alert.alert('Error', 'Failed to save visual design');
    } finally {
      setIsSaving(false);
    }
  };

  const saveSocialLinks = async () => {
    setIsSaving(true);
    try {
      await update({
        share_app_link: shareAppLink,
        access_code_link: accessCodeLink,
        bts_share_link: btsShareLink,
        announcement_share_link: announcementShareLink,
        gallery_share_link: galleryShareLink,
        referral_link: referralLink,
        whatsapp_share_link: whatsappShareLink,
      });
      showSaveSuccess();
    } catch {
      Alert.alert('Error', 'Failed to save social links');
    } finally {
      setIsSaving(false);
    }
  };

  const saveContactInfo = async () => {
    setIsSaving(true);
    try {
      // Contact info fields will be persisted when DB columns are added.
      // For now, persist what we can via brand_settings.
      await update({
        tagline: tagline || `${contactInfo.email} ${contactInfo.phone}`.trim(),
      });
      showSaveSuccess();
    } catch {
      Alert.alert('Error', 'Failed to save contact info');
    } finally {
      setIsSaving(false);
    }
  };

  const pickLogo = async (type: 'brand' | 'watermark') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'brand' ? [1, 1] : [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      if (type === 'brand') {
        setLogoUrl(result.assets[0].uri);
        markDirty();
      } else {
        setWatermarkLogoUrl(result.assets[0].uri);
        markDirty();
      }
    }
  };

  const removeLogo = (type: 'brand' | 'watermark') => {
    if (type === 'brand') {
      setLogoUrl(null);
    } else {
      setWatermarkLogoUrl(null);
    }
    markDirty();
  };

  const applyWatermarkPreset = (presetKey: keyof typeof WATERMARK_PRESETS) => {
    const p = WATERMARK_PRESETS[presetKey];
    setWatermarkOpacity(p.opacity);
    setWatermarkRotation(p.rotation);
    setWatermarkSize(p.size);
    setWatermarkPosition(p.position);
    markDirty();
  };

  const applyColorPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    setAccentColor(preset.accent);
    setCustomPrimary(preset.primary);
    setCustomSecondary(preset.secondary);
    setCustomAccent(preset.accent);
    markDirty();
  };

  const formatSyncTime = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  const updateSocial = (key: keyof SocialLinks, value: string) => {
    setSocialLinks((prev) => ({ ...prev, [key]: value }));
    markDirty();
  };

  const updateContact = (key: keyof ContactInfo, value: string) => {
    setContactInfo((prev) => ({ ...prev, [key]: value }));
    markDirty();
  };

  const renderSaveBar = () => (
    <View style={styles.saveBar}>
      <View style={styles.saveBarLeft}>
        <View style={[styles.syncDot, hasUnsavedChanges ? styles.syncDotDirty : styles.syncDotSynced]} />
        <Text style={styles.saveBarText}>
          {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
        </Text>
      </View>
      <View style={styles.saveBarRight}>
        <Clock size={12} color={Colors.textMuted} />
        <Text style={styles.syncTime}>Synced {formatSyncTime(lastSyncedAt)}</Text>
      </View>
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Icon size={16} color={isActive ? Colors.gold : Colors.textMuted} />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderLivePreview = () => (
    <View style={styles.previewSection}>
      <View style={styles.previewHeader}>
        <Eye size={14} color={Colors.gold} />
        <Text style={styles.previewTitle}>Live Preview</Text>
      </View>
      <View style={[styles.previewCard, { backgroundColor: secondaryColor }]}>
        <View style={styles.previewStatusBar}>
          <Text style={[styles.previewTime, { color: '#fff' }]}>9:41</Text>
          <View style={styles.previewStatusIcons}>
            <View style={[styles.previewSignal, { backgroundColor: '#fff' }]} />
            <View style={[styles.previewWifi, { backgroundColor: '#fff' }]} />
            <View style={[styles.previewBattery, { borderColor: '#fff' }]} />
          </View>
        </View>
        <View style={styles.previewHeader2}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.previewLogo} />
          ) : (
            <View style={[styles.previewLogoPlaceholder, { backgroundColor: primaryColor }]}>
              <Text style={[styles.previewLogoText, { color: secondaryColor }]}>
                {(brandName || 'B').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.previewBrandInfo}>
            <Text style={[styles.previewBrandName, { color: '#fff' }]} numberOfLines={1}>
              {brandName || 'Brand Name'}
            </Text>
            <Text style={[styles.previewTagline, { color: accentColor }]} numberOfLines={1}>
              {tagline || 'Your tagline here'}
            </Text>
          </View>
        </View>
        <View style={[styles.previewContent, { backgroundColor: secondaryColor }]}>
          <View style={[styles.previewPhotoFrame, { borderColor: primaryColor + '40' }]}>
            <View style={styles.previewPhotoInner}>
              <View style={[styles.previewMountain, { borderBottomColor: primaryColor + '60' }]} />
              <View style={[styles.previewMountain2, { borderBottomColor: accentColor + '40' }]} />
              <View style={[styles.previewSun, { backgroundColor: accentColor }]} />
            </View>
            {watermarkEnabled && (
              <View style={[
                styles.previewWatermark,
                watermarkPosition.includes('top') && { top: 8 },
                watermarkPosition.includes('bottom') && { bottom: 8 },
                watermarkPosition.includes('left') && { left: 8 },
                watermarkPosition.includes('right') && { right: 8 },
                !watermarkPosition.includes('left') && !watermarkPosition.includes('right') && { alignSelf: 'center' },
                !watermarkPosition.includes('top') && !watermarkPosition.includes('bottom') && { top: '40%' },
              ]}>
                <Text style={[styles.previewWatermarkText, {
                  opacity: watermarkOpacity / 100,
                  transform: [{ rotate: `${watermarkRotation}deg` }],
                  fontSize: watermarkSize === 'small' ? 8 : watermarkSize === 'large' ? 14 : 11,
                }]}>
                  {watermarkText || brandName || 'WATERMARK'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.previewButtons}>
            <View style={[styles.previewBtn, { backgroundColor: primaryColor }]}>
              <Text style={[styles.previewBtnText, { color: secondaryColor }]}>View Gallery</Text>
            </View>
            <View style={[styles.previewBtnOutline, { borderColor: accentColor }]}>
              <Text style={[styles.previewBtnOutlineText, { color: accentColor }]}>Access Code</Text>
            </View>
          </View>
          <View style={styles.previewNav}>
            <View style={[styles.previewNavItem, { backgroundColor: primaryColor + '20' }]}>
              <Type size={12} color={primaryColor} />
              <Text style={[styles.previewNavText, { color: primaryColor }]}>Galleries</Text>
            </View>
            <View style={styles.previewNavItem}>
              <Globe size={12} color={Colors.textMuted} />
              <Text style={[styles.previewNavText, { color: Colors.textMuted }]}>Links</Text>
            </View>
            <View style={styles.previewNavItem}>
              <Phone size={12} color={Colors.textMuted} />
              <Text style={[styles.previewNavText, { color: Colors.textMuted }]}>Contact</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderBrandIdentity = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Type size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>Brand Identity</Text>
        </View>

        {/* Logo Upload */}
        <View style={styles.field}>
          <Text style={styles.label}>Studio Logo</Text>
          <View style={styles.logoUploadArea}>
            {logoUrl ? (
              <View style={styles.logoPreviewContainer}>
                <Image source={{ uri: logoUrl }} style={styles.logoPreviewLarge} />
                <Pressable style={styles.logoRemoveBtn} onPress={() => removeLogo('brand')}>
                  <X size={14} color="#fff" />
                </Pressable>
                <Pressable style={styles.logoChangeOverlay} onPress={() => pickLogo('brand')}>
                  <ImagePlus size={16} color="#fff" />
                  <Text style={styles.logoChangeOverlayText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.logoUploadBtn} onPress={() => pickLogo('brand')}>
                <View style={[styles.logoUploadIcon, { backgroundColor: primaryColor + '20' }]}>
                  <ImagePlus size={24} color={primaryColor} />
                </View>
                <Text style={styles.logoUploadText}>Upload Logo</Text>
                <Text style={styles.logoUploadHint}>Square image, recommended 512x512</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Brand Name</Text>
          <TextInput
            style={styles.inputFull}
            value={brandName}
            onChangeText={(v) => { setBrandName(v); markDirty(); }}
            placeholder="Your studio name"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tagline</Text>
          <TextInput
            style={styles.inputFull}
            value={tagline}
            onChangeText={(v) => { setTagline(v); markDirty(); }}
            placeholder="Professional Photography"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>App Display Name</Text>
          <TextInput
            style={styles.inputFull}
            value={appDisplayName}
            onChangeText={(v) => { setAppDisplayName(v); markDirty(); }}
            placeholder="Name shown in app"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        <Pressable
          style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
          onPress={saveBrandIdentity}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <Save size={16} color={Colors.background} />
          )}
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Brand Identity'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderVisualDesign = () => (
    <View style={styles.tabContent}>
      {/* Color Palette */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Palette size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>Brand Colors</Text>
        </View>

        <View style={styles.colorPreviewRow}>
          <View style={[styles.colorPreviewSwatch, { backgroundColor: primaryColor }]}>
            <Text style={[styles.colorPreviewLabel, { color: secondaryColor }]}>Aa</Text>
          </View>
          <View style={[styles.colorPreviewSwatch, { backgroundColor: secondaryColor }]}>
            <Text style={[styles.colorPreviewLabel, { color: '#fff' }]}>Aa</Text>
          </View>
          <View style={[styles.colorPreviewSwatch, { backgroundColor: accentColor }]}>
            <Text style={[styles.colorPreviewLabel, { color: secondaryColor }]}>Aa</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Presets</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            {COLOR_PRESETS.map((preset) => (
              <Pressable
                key={preset.name}
                style={[
                  styles.colorPresetCard,
                  primaryColor === preset.primary && styles.colorPresetActive,
                ]}
                onPress={() => applyColorPreset(preset)}
              >
                <View style={styles.colorPresetSwatches}>
                  <View style={[styles.colorPresetDot, { backgroundColor: preset.primary }]} />
                  <View style={[styles.colorPresetDot, { backgroundColor: preset.secondary }]} />
                  <View style={[styles.colorPresetDot, { backgroundColor: preset.accent }]} />
                </View>
                <Text style={styles.colorPresetName}>{preset.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Pressable
          style={styles.customColorToggle}
          onPress={() => setShowCustomColors(!showCustomColors)}
        >
          <Text style={styles.customColorToggleText}>
            {showCustomColors ? 'Hide' : 'Custom Colors'}
          </Text>
          <ChevronRight
            size={16}
            color={Colors.textMuted}
            style={showCustomColors && { transform: [{ rotate: '90deg' }] }}
          />
        </Pressable>

        {showCustomColors && (
          <View style={styles.customColors}>
            <View style={styles.colorField}>
              <View style={[styles.colorDot, { backgroundColor: primaryColor }]} />
              <Text style={styles.colorLabel}>Primary</Text>
              <TextInput
                style={styles.colorInput}
                value={customPrimary}
                onChangeText={(v) => { setCustomPrimary(v); setPrimaryColor(v); markDirty(); }}
                placeholder="#D4AF37"
                placeholderTextColor={Colors.textMuted}
                maxLength={7}
              />
            </View>
            <View style={styles.colorField}>
              <View style={[styles.colorDot, { backgroundColor: secondaryColor }]} />
              <Text style={styles.colorLabel}>Secondary</Text>
              <TextInput
                style={styles.colorInput}
                value={customSecondary}
                onChangeText={(v) => { setCustomSecondary(v); setSecondaryColor(v); markDirty(); }}
                placeholder="#1A1A1A"
                placeholderTextColor={Colors.textMuted}
                maxLength={7}
              />
            </View>
            <View style={styles.colorField}>
              <View style={[styles.colorDot, { backgroundColor: accentColor }]} />
              <Text style={styles.colorLabel}>Accent</Text>
              <TextInput
                style={styles.colorInput}
                value={customAccent}
                onChangeText={(v) => { setCustomAccent(v); setAccentColor(v); markDirty(); }}
                placeholder="#E8CC6E"
                placeholderTextColor={Colors.textMuted}
                maxLength={7}
              />
            </View>
          </View>
        )}
      </View>

      {/* Watermark */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Droplets size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>Watermark</Text>
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Droplets size={20} color={watermarkEnabled ? Colors.gold : Colors.textMuted} />
            <View>
              <Text style={styles.toggleLabel}>Enable Watermark</Text>
              <Text style={styles.toggleDesc}>Protect your photos</Text>
            </View>
          </View>
          <Switch
            value={watermarkEnabled}
            onValueChange={(v) => { setWatermarkEnabled(v); markDirty(); }}
            trackColor={{ false: Colors.border, true: Colors.goldMuted }}
            thumbColor={watermarkEnabled ? Colors.gold : Colors.textMuted}
          />
        </View>

        {watermarkEnabled && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Quick Presets</Text>
              <View style={styles.chipRow}>
                {Object.entries(WATERMARK_PRESETS).map(([key, preset]) => (
                  <Pressable
                    key={key}
                    style={styles.presetChip}
                    onPress={() => applyWatermarkPreset(key as keyof typeof WATERMARK_PRESETS)}
                  >
                    <Text style={styles.presetChipLabel}>{preset.label}</Text>
                    <Text style={styles.presetChipMeta}>{preset.opacity}% · {preset.rotation}°</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Watermark Type</Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, !watermarkLogoUrl && styles.chipActive]}
                  onPress={() => { setWatermarkLogoUrl(null); markDirty(); }}
                >
                  <Text style={[styles.chipText, !watermarkLogoUrl && styles.chipTextActive]}>Text</Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, !!watermarkLogoUrl && styles.chipActive]}
                  onPress={() => pickLogo('watermark')}
                >
                  <Text style={[styles.chipText, !!watermarkLogoUrl && styles.chipTextActive]}>Logo</Text>
                </Pressable>
              </View>
            </View>

            {!watermarkLogoUrl ? (
              <View style={styles.field}>
                <Text style={styles.label}>Watermark Text</Text>
                <TextInput
                  style={styles.inputFull}
                  value={watermarkText}
                  onChangeText={(v) => { setWatermarkText(v); markDirty(); }}
                  placeholder="Your Studio Name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            ) : (
              <View style={styles.field}>
                <Text style={styles.label}>Logo Preview</Text>
                <View style={styles.logoPreviewRow}>
                  <Image source={{ uri: watermarkLogoUrl }} style={styles.logoPreviewImg} />
                  <Pressable onPress={() => pickLogo('watermark')} style={styles.logoChangeBtn}>
                    <ImagePlus size={14} color={Colors.gold} />
                    <Text style={styles.logoChangeBtnText}>Change</Text>
                  </Pressable>
                  <Pressable onPress={() => removeLogo('watermark')} style={styles.logoRemoveSmall}>
                    <X size={14} color={Colors.error} />
                    <Text style={styles.logoRemoveSmallText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={styles.field}>
              <View style={styles.sliderHeader}>
                <Text style={styles.label}>Opacity</Text>
                <Text style={styles.sliderValue}>{watermarkOpacity}%</Text>
              </View>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${watermarkOpacity}%` }]} />
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(watermarkOpacity)}
                onChangeText={(v) => { setWatermarkOpacity(Math.max(0, Math.min(100, parseInt(v) || 0))); markDirty(); }}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <View style={styles.sliderHeader}>
                <Text style={styles.label}>Rotation</Text>
                <Text style={styles.sliderValue}>{watermarkRotation}°</Text>
              </View>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${((watermarkRotation + 180) / 360) * 100}%` }]} />
              </View>
              <TextInput
                style={styles.numberInput}
                value={String(watermarkRotation)}
                onChangeText={(v) => { setWatermarkRotation(Math.max(-180, Math.min(180, parseInt(v) || 0))); markDirty(); }}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Size</Text>
              <View style={styles.chipRow}>
                {WATERMARK_SIZE_OPTIONS.map((s) => (
                  <Pressable
                    key={s.key}
                    style={[styles.chip, watermarkSize === s.key && styles.chipActive]}
                    onPress={() => { setWatermarkSize(s.key); markDirty(); }}
                  >
                    <Text style={[styles.chipText, watermarkSize === s.key && styles.chipTextActive]}>
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

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
                        onPress={() => { setWatermarkPosition(pos); markDirty(); }}
                      >
                        {pos === 'center' && <View style={styles.positionDot} />}
                        {pos.includes('top') && pos.includes('left') && (
                          <View style={[styles.positionDot, { alignSelf: 'flex-start', marginLeft: 2, marginTop: 2 }]} />
                        )}
                        {pos.includes('top') && pos.includes('right') && (
                          <View style={[styles.positionDot, { alignSelf: 'flex-end', marginRight: 2, marginTop: 2 }]} />
                        )}
                        {pos.includes('bottom') && pos.includes('left') && (
                          <View style={[styles.positionDot, { alignSelf: 'flex-start', marginLeft: 2, marginBottom: 2 }]} />
                        )}
                        {pos.includes('bottom') && pos.includes('right') && (
                          <View style={[styles.positionDot, { alignSelf: 'flex-end', marginRight: 2, marginBottom: 2 }]} />
                        )}
                        {pos.includes('center') && !pos.includes('left') && !pos.includes('right') && pos !== 'center' && (
                          <View style={styles.positionDot} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        <Pressable
          style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
          onPress={saveVisualDesign}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <Save size={16} color={Colors.background} />
          )}
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Visual Design'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderSocialLinks = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Share2 size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>Social Media</Text>
        </View>

        {[
          { key: 'instagram' as const, label: 'Instagram', placeholder: 'https://instagram.com/yourstudio' },
          { key: 'facebook' as const, label: 'Facebook', placeholder: 'https://facebook.com/yourstudio' },
          { key: 'twitter' as const, label: 'Twitter / X', placeholder: 'https://x.com/yourstudio' },
          { key: 'tiktok' as const, label: 'TikTok', placeholder: 'https://tiktok.com/@yourstudio' },
          { key: 'youtube' as const, label: 'YouTube', placeholder: 'https://youtube.com/@yourstudio' },
          { key: 'website' as const, label: 'Website', placeholder: 'https://yourstudio.com' },
        ].map(({ key, label, placeholder }) => (
          <View style={styles.field} key={key}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.inputFull}
              value={socialLinks[key]}
              onChangeText={(v) => updateSocial(key, v)}
              placeholder={placeholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        ))}
      </View>

      {/* Deep Links */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Link2 size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>App Deep Links</Text>
        </View>

        {[
          { key: 'shareAppLink' as const, label: 'App Download Link', placeholder: 'https://play.google.com/...' },
          { key: 'accessCodeLink' as const, label: 'Access Code Link', placeholder: 'epix-visuals://gallery?autoUnlock=true&accessCode=' },
          { key: 'btsShareLink' as const, label: 'BTS Share Link', placeholder: 'Behind-the-scenes link' },
          { key: 'announcementShareLink' as const, label: 'Announcement Link', placeholder: 'Announcement share link' },
          { key: 'galleryShareLink' as const, label: 'Gallery Share Link', placeholder: 'Gallery share link' },
          { key: 'referralLink' as const, label: 'Referral Link', placeholder: 'Referral link' },
          { key: 'whatsappShareLink' as const, label: 'WhatsApp Share Link', placeholder: 'WhatsApp share link' },
        ].map(({ key, label, placeholder }) => {
          const setterMap: Record<string, (v: string) => void> = {
            shareAppLink: setShareAppLink,
            accessCodeLink: setAccessCodeLink,
            btsShareLink: setBtsShareLink,
            announcementShareLink: setAnnouncementShareLink,
            galleryShareLink: setGalleryShareLink,
            referralLink: setReferralLink,
            whatsappShareLink: setWhatsappShareLink,
          };
          const valueMap: Record<string, string> = {
            shareAppLink,
            accessCodeLink,
            btsShareLink,
            announcementShareLink,
            galleryShareLink,
            referralLink,
            whatsappShareLink,
          };
          return (
            <View style={styles.field} key={key}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.inputFull}
                value={valueMap[key]}
                onChangeText={(v) => { setterMap[key](v); markDirty(); }}
                placeholder={placeholder}
                placeholderTextColor={Colors.textMuted}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          );
        })}

        <Pressable
          style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
          onPress={saveSocialLinks}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <Save size={16} color={Colors.background} />
          )}
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Social & Links'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderContactInfo = () => (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Phone size={18} color={Colors.gold} />
          <Text style={styles.sectionTitle}>Contact Information</Text>
        </View>

        <View style={styles.field}>
          <View style={styles.inputWithIcon}>
            <Mail size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.inputIconField}
              value={contactInfo.email}
              onChangeText={(v) => updateContact('email', v)}
              placeholder="studio@example.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.field}>
          <View style={styles.inputWithIcon}>
            <Phone size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.inputIconField}
              value={contactInfo.phone}
              onChangeText={(v) => updateContact('phone', v)}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <View style={styles.inputWithIcon}>
            <Globe size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.inputIconField}
              value={contactInfo.whatsapp}
              onChangeText={(v) => updateContact('whatsapp', v)}
              placeholder="WhatsApp number"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <View style={styles.inputWithIcon}>
            <MapPin size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.inputIconField}
              value={contactInfo.address}
              onChangeText={(v) => updateContact('address', v)}
              placeholder="Street address"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.inputFull}
              value={contactInfo.city}
              onChangeText={(v) => updateContact('city', v)}
              placeholder="City"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.inputFull}
              value={contactInfo.country}
              onChangeText={(v) => updateContact('country', v)}
              placeholder="Country"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        <Pressable
          style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
          onPress={saveContactInfo}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <Save size={16} color={Colors.background} />
          )}
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Contact Info'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const tabContent = {
    identity: renderBrandIdentity,
    visual: renderVisualDesign,
    social: renderSocialLinks,
    contact: renderContactInfo,
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Branding',
          headerRight: () => (
            <Animated.View style={[styles.syncIndicator, { opacity: saveIndicatorAnim }]}>
              <Check size={14} color={Colors.success} />
              <Text style={styles.syncText}>Saved</Text>
            </Animated.View>
          ),
        }}
      />
      {renderSaveBar()}
      {renderTabBar()}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {activeTab === 'identity' && renderLivePreview()}
        {tabContent[activeTab]()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16 },

  // Save Bar
  saveBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  saveBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBarRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  syncDotDirty: { backgroundColor: Colors.warning },
  syncDotSynced: { backgroundColor: Colors.success },
  saveBarText: { fontSize: 12, color: Colors.textSecondary },
  syncTime: { fontSize: 11, color: Colors.textMuted },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: Colors.goldMuted },
  tabText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.gold },

  // Sections
  section: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },

  // Fields
  field: { marginBottom: 16 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, color: Colors.textMuted, marginBottom: 8 },
  inputFull: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  numberInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
    width: 70,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleLabel: { fontSize: 14, color: Colors.textPrimary },
  toggleDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Slider
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderValue: { fontSize: 14, fontWeight: '700', color: Colors.gold },
  sliderTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 8,
  },
  sliderFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 3 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.goldMuted, borderColor: Colors.gold },
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  chipTextActive: { color: Colors.gold },

  // Presets
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetChipLabel: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  presetChipMeta: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  // Position Grid
  positionGrid: { gap: 4 },
  positionRow: { flexDirection: 'row', gap: 4 },
  positionCell: {
    flex: 1,
    height: 36,
    backgroundColor: Colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionCellActive: { borderColor: Colors.gold, backgroundColor: Colors.goldMuted },
  positionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold },

  // Logo
  logoPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoPreviewImg: { width: 48, height: 48, borderRadius: 8 },
  logoChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  logoChangeBtnText: { fontSize: 12, color: Colors.gold, fontWeight: '600' },

  // Logo Upload
  logoUploadArea: { marginBottom: 8 },
  logoUploadBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  logoUploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoUploadText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  logoUploadHint: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  logoPreviewContainer: { position: 'relative', alignItems: 'center' },
  logoPreviewLarge: { width: 96, height: 96, borderRadius: 16 },
  logoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoChangeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  logoChangeOverlayText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  logoRemoveSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },
  logoRemoveSmallText: { fontSize: 12, color: Colors.error, fontWeight: '600' },

  // Colors
  colorPreviewRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  colorPreviewSwatch: {
    flex: 1,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  colorPreviewLabel: { fontSize: 18, fontWeight: '700' },
  presetScroll: { marginHorizontal: -4 },
  colorPresetCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  colorPresetActive: { borderColor: Colors.gold, backgroundColor: Colors.goldMuted },
  colorPresetSwatches: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  colorPresetDot: { width: 14, height: 14, borderRadius: 7 },
  colorPresetName: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary },
  customColorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  customColorToggleText: { fontSize: 13, color: Colors.gold, fontWeight: '600' },
  customColors: { gap: 12, paddingTop: 12 },
  colorField: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border },
  colorLabel: { fontSize: 13, color: Colors.textSecondary, width: 70 },
  colorInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: 'monospace',
  },

  // Contact
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  inputIconField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  // Buttons
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: Colors.background },

  // Sync Indicator
  syncIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  syncText: { fontSize: 12, fontWeight: '600', color: Colors.success },

  // Live Preview
  previewSection: { marginBottom: 16 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  previewTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  previewCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  previewTime: { fontSize: 11, fontWeight: '600' },
  previewStatusIcons: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  previewSignal: { width: 12, height: 6, borderRadius: 1 },
  previewWifi: { width: 10, height: 8, borderRadius: 2 },
  previewBattery: { width: 16, height: 8, borderRadius: 2, borderWidth: 1 },
  previewHeader2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  previewLogo: { width: 36, height: 36, borderRadius: 8 },
  previewLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLogoText: { fontSize: 16, fontWeight: '800' },
  previewBrandInfo: { flex: 1 },
  previewBrandName: { fontSize: 13, fontWeight: '700' },
  previewTagline: { fontSize: 10, marginTop: 1 },
  previewContent: { paddingHorizontal: 16, paddingBottom: 12 },
  previewPhotoFrame: {
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 10,
  },
  previewPhotoInner: {
    flex: 1,
    backgroundColor: '#3a5a40',
    justifyContent: 'flex-end',
  },
  previewMountain: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 25,
    borderRightWidth: 25,
    borderBottomWidth: 30,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#5a8c69',
  },
  previewMountain2: {
    position: 'absolute',
    bottom: 16,
    right: 10,
    width: 0,
    height: 0,
    borderLeftWidth: 20,
    borderRightWidth: 20,
    borderBottomWidth: 25,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#3d6b4a',
  },
  previewSun: {
    position: 'absolute',
    top: 10,
    right: 15,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  previewWatermark: { position: 'absolute' },
  previewWatermarkText: {
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  previewButtons: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  previewBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  previewBtnText: { fontSize: 10, fontWeight: '700' },
  previewBtnOutline: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  previewBtnOutlineText: { fontSize: 10, fontWeight: '600' },
  previewNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
  },
  previewNavItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewNavText: { fontSize: 9, fontWeight: '600' },

  tabContent: {},
});
