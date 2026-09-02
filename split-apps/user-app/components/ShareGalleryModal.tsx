import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Lock,
  Download,
  Share2,
  Clock,
  Eye,
  EyeOff,
  Palette,
  Droplets,
  Shield,
  Link as LinkIcon,
  Check,
  Copy,
  Calendar,
  LayoutGrid,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ShareGalleryModalProps {
  visible: boolean;
  onClose: () => void;
  galleryId: string;
  galleryName: string;
  photoCount: number;
  onShareCreated: (shareUrl: string) => void;
}

interface ShareSettings {
  requirePassword: boolean;
  password: string;
  allowDownloads: boolean;
  allowOriginalQuality: boolean;
  allowBulkDownload: boolean;
  watermarkedDownloads: boolean;
  allowReshare: boolean;
  allowPhotoSharing: boolean;
  expiration: string;
  customExpirationDate: Date | null;
  accessLimit: string;
  galleryTitle: string;
  description: string;
  theme: string;
  layout: string;
  enableWatermark: boolean;
  watermarkText: string;
  watermarkPosition: string;
  watermarkOpacity: number;
}

const EXPIRATION_OPTIONS = [
  { label: 'Never', value: 'never' },
  { label: '24 hours', value: '24h' },
  { label: '3 days', value: '3d' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: 'Custom', value: 'custom' },
];

const ACCESS_LIMIT_OPTIONS = [
  { label: 'Unlimited', value: 'unlimited' },
  { label: '10 views', value: '10' },
  { label: '25 views', value: '25' },
  { label: '50 views', value: '50' },
  { label: '100 views', value: '100' },
];

const THEME_OPTIONS = [
  { label: 'Dark Luxury', value: 'dark_luxury' },
  { label: 'Light Elegant', value: 'light_elegant' },
  { label: 'Black & Gold', value: 'black_gold' },
  { label: 'Midnight Purple', value: 'midnight_purple' },
  { label: 'Champagne', value: 'champagne' },
];

const LAYOUT_OPTIONS = [
  { label: 'Grid', value: 'grid', icon: 'grid' },
  { label: 'Masonry', value: 'masonry', icon: 'masonry' },
  { label: 'Large Tiles', value: 'large_tiles', icon: 'tiles' },
  { label: 'Magazine', value: 'magazine', icon: 'magazine' },
  { label: 'Minimal', value: 'minimal', icon: 'minimal' },
];

const WATERMARK_POSITIONS = [
  { label: 'Top Left', value: 'top_left' },
  { label: 'Top Right', value: 'top_right' },
  { label: 'Center', value: 'center' },
  { label: 'Bottom Left', value: 'bottom_left' },
  { label: 'Bottom Right', value: 'bottom_right' },
];

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (!password) return { level: 0, label: '', color: Colors.textMuted };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: '#E74C3C' };
  if (score <= 2) return { level: 2, label: 'Fair', color: '#F39C12' };
  if (score <= 3) return { level: 3, label: 'Good', color: '#2ECC71' };
  if (score <= 4) return { level: 4, label: 'Strong', color: '#27AE60' };
  return { level: 5, label: 'Very Strong', color: '#1ABC9C' };
}

function generateSecureToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `EPIX-${token}`;
}

function generateAutoPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all = upper + lower + digits;
  let pw = '';
  // Ensure at least one of each type
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 0; i < 5; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

export default function ShareGalleryModal({
  visible,
  onClose,
  galleryId,
  galleryName,
  photoCount,
  onShareCreated,
}: ShareGalleryModalProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [linkCreated, setLinkCreated] = useState(false);
  const [createdShareUrl, setCreatedShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const [settings, setSettings] = useState<ShareSettings>({
    requirePassword: true,
    password: '',
    allowDownloads: true,
    allowOriginalQuality: false,
    allowBulkDownload: false,
    watermarkedDownloads: false,
    allowReshare: false,
    allowPhotoSharing: true,
    expiration: 'never',
    customExpirationDate: null,
    accessLimit: 'unlimited',
    galleryTitle: galleryName,
    description: '',
    theme: 'dark_luxury',
    layout: 'grid',
    enableWatermark: false,
    watermarkText: 'Epix Visuals',
    watermarkPosition: 'bottom_right',
    watermarkOpacity: 0.5,
  });

  useEffect(() => {
    if (visible) {
      setSettings((prev) => ({
        ...prev,
        galleryTitle: galleryName,
      }));
      setLinkCreated(false);
      setCreatedShareUrl('');
      setCopied(false);
    }
  }, [visible, galleryName]);

  const updateSetting = useCallback(
    <K extends keyof ShareSettings>(key: K, value: ShareSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  const getExpirationDate = useCallback((): string | null => {
    if (settings.expiration === 'never') return null;
    if (settings.expiration === 'custom' && settings.customExpirationDate) {
      return settings.customExpirationDate.toISOString();
    }
    const now = new Date();
    switch (settings.expiration) {
      case '24h':
        now.setHours(now.getHours() + 24);
        return now.toISOString();
      case '3d':
        now.setDate(now.getDate() + 3);
        return now.toISOString();
      case '7d':
        now.setDate(now.getDate() + 7);
        return now.toISOString();
      case '30d':
        now.setDate(now.getDate() + 30);
        return now.toISOString();
      default:
        return null;
    }
  }, [settings.expiration, settings.customExpirationDate]);

  const createShareLink = useCallback(async (passwordToUse: string) => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const shareToken = generateSecureToken();

      let passwordHash: string | null = null;
      if (settings.requirePassword && passwordToUse) {
        passwordHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          passwordToUse
        );
      }

      const expiresAt = getExpirationDate();

      const { error } = await supabase.from('gallery_shares').insert({
        gallery_id: galleryId,
        share_token: shareToken,
        password_hash: passwordHash,
        require_password: settings.requirePassword,
        allow_downloads: settings.allowDownloads,
        allow_original_quality: settings.allowOriginalQuality,
        allow_bulk_download: settings.allowBulkDownload,
        watermarked_downloads: settings.watermarkedDownloads,
        allow_reshare: settings.allowReshare,
        allow_photo_sharing: settings.allowPhotoSharing,
        expires_at: expiresAt,
        max_views: settings.accessLimit === 'unlimited' ? null : parseInt(settings.accessLimit, 10),
        gallery_display_name: settings.galleryTitle || galleryName,
        gallery_description: settings.description,
        theme: settings.theme,
        layout: settings.layout,
        enable_watermark: settings.enableWatermark,
        watermark_text: settings.enableWatermark ? settings.watermarkText : null,
        watermark_position: settings.enableWatermark ? settings.watermarkPosition : null,
        watermark_opacity: settings.enableWatermark ? settings.watermarkOpacity : null,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[ShareGalleryModal] Insert error:', error);
        Alert.alert('Error', 'Failed to create share link. Please try again.');
        setLoading(false);
        return;
      }

      const shareUrl = `https://epix-visuals.vercel.app/gallery/${shareToken}`;
      setCreatedShareUrl(shareUrl);
      setLinkCreated(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onShareCreated(shareUrl);
    } catch (err) {
      console.error('[ShareGalleryModal] Unexpected error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [settings, galleryId, galleryName, getExpirationDate, onShareCreated]);

  const handleCreateLink = useCallback(async () => {
    let passwordToUse = settings.password;
    if (settings.requirePassword && passwordToUse.length < 6) {
      // Auto-generate password instead of prompting
      passwordToUse = generateAutoPassword();
      setSettings((prev) => ({ ...prev, password: passwordToUse }));
    }
    if (passwordToUse.length > 64) {
      Alert.alert('Password Too Long', 'Password must be 64 characters or less.');
      return;
    }
    await createShareLink(passwordToUse);
  }, [settings, createShareLink]);

  const handleCopyLink = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(createdShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [createdShareUrl]);

  const handleShareLink = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(createdShareUrl, {
          dialogTitle: `Share ${settings.galleryTitle || galleryName}`,
          mimeType: 'text/plain',
        });
      } else {
        Alert.alert('Share', 'Sharing is not available on this device.');
      }
    } catch (err) {
      console.error('[ShareGalleryModal] Share error:', err);
    }
  }, [createdShareUrl, settings.galleryTitle, galleryName]);

  const handleClose = useCallback(() => {
    if (loading) return;
    onClose();
  }, [loading, onClose]);

  const renderSectionHeader = (icon: React.ReactNode, title: string) => (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderToggle = (
    label: string,
    value: boolean,
    onValueChange: (v: boolean) => void,
    description?: string
  ) => (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#374151', true: Colors.gold + '60' }}
        thumbColor={value ? Colors.white : '#9CA3AF'}
        ios_backgroundColor="#374151"
      />
    </View>
  );

  const renderRadioOption = (
    label: string,
    selected: boolean,
    onPress: () => void
  ) => (
    <Pressable
      style={[styles.radioOption, selected && styles.radioOptionSelected]}
      onPress={onPress}
    >
      <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>{label}</Text>
    </Pressable>
  );

  const renderDatePicker = () => (
    <View style={styles.datePickerContainer}>
      <Calendar size={16} color={Colors.gold} />
      <Text style={styles.datePickerText}>
        {settings.customExpirationDate
          ? settings.customExpirationDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : 'Select expiration date'}
      </Text>
      <Pressable
        style={styles.datePickerButton}
        onPress={() => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(23, 59, 59, 999);
          updateSetting('customExpirationDate', tomorrow);
        }}
      >
        <Text style={styles.datePickerButtonText}>Set</Text>
      </Pressable>
    </View>
  );

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <Share2 size={22} color={Colors.gold} />
              </View>
              <View>
                <Text style={styles.title}>Share Private Gallery</Text>
                <Text style={styles.subtitle}>
                  {galleryName} · {photoCount} photos
                </Text>
              </View>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Access Security Section */}
            <View style={styles.section}>
              {renderSectionHeader(
                <Shield size={18} color={Colors.gold} />,
                'Access Security'
              )}
              {renderToggle(
                'Require Password',
                settings.requirePassword,
                (v) => updateSetting('requirePassword', v),
                'Viewers must enter a password to access'
              )}

              {settings.requirePassword && (
                <View style={styles.inputGroup}>
                  <View style={styles.passwordContainer}>
                    <Lock size={18} color={Colors.textMuted} />
                    <TextInput
                      style={styles.passwordInput}
                      value={settings.password}
                      onChangeText={(text) => updateSetting('password', text)}
                      placeholder="Enter password (6-64 characters)"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <EyeOff size={18} color={Colors.textMuted} />
                      ) : (
                        <Eye size={18} color={Colors.textMuted} />
                      )}
                    </Pressable>
                  </View>
                  {settings.password.length > 0 && (
                    <View style={styles.strengthContainer}>
                      <View style={styles.strengthBars}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <View
                            key={i}
                            style={[
                              styles.strengthBar,
                              {
                                backgroundColor:
                                  i <= getPasswordStrength(settings.password).level
                                    ? getPasswordStrength(settings.password).color
                                    : '#374151',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text
                        style={[
                          styles.strengthLabel,
                          { color: getPasswordStrength(settings.password).color },
                        ]}
                      >
                        {getPasswordStrength(settings.password).label}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Download Settings Section */}
            <View style={styles.section}>
              {renderSectionHeader(
                <Download size={18} color={Colors.gold} />,
                'Download Settings'
              )}
              {renderToggle(
                'Allow Downloads',
                settings.allowDownloads,
                (v) => updateSetting('allowDownloads', v),
                'Viewers can download photos'
              )}

              {settings.allowDownloads && (
                <View style={styles.nestedToggles}>
                  {renderToggle(
                    'Allow Original Quality',
                    settings.allowOriginalQuality,
                    (v) => updateSetting('allowOriginalQuality', v),
                    'Provide full-resolution downloads'
                  )}
                  {renderToggle(
                    'Allow Bulk Download',
                    settings.allowBulkDownload,
                    (v) => updateSetting('allowBulkDownload', v),
                    'Viewers can download entire gallery'
                  )}
                  {renderToggle(
                    'Watermarked Downloads',
                    settings.watermarkedDownloads,
                    (v) => updateSetting('watermarkedDownloads', v),
                    'Apply watermark to downloaded images'
                  )}
                </View>
              )}
            </View>

            {/* Sharing Controls Section */}
            <View style={styles.section}>
              {renderSectionHeader(
                <Share2 size={18} color={Colors.gold} />,
                'Sharing Controls'
              )}
              {renderToggle(
                'Allow Recipient to Reshare',
                settings.allowReshare,
                (v) => updateSetting('allowReshare', v),
                'Viewers can create their own share links'
              )}
              {renderToggle(
                'Allow Photo Sharing',
                settings.allowPhotoSharing,
                (v) => updateSetting('allowPhotoSharing', v),
                'Viewers can share individual photos'
              )}
            </View>

            {/* Expiration Section */}
            <View style={styles.section}>
              {renderSectionHeader(
                <Clock size={18} color={Colors.gold} />,
                'Expiration'
              )}
              <View style={styles.radioGroup}>
                {EXPIRATION_OPTIONS.map((option) => (
                  <React.Fragment key={option.value}>
                    {renderRadioOption(
                      option.label,
                      settings.expiration === option.value,
                      () => updateSetting('expiration', option.value)
                    )}
                    {option.value === 'custom' &&
                      settings.expiration === 'custom' &&
                      renderDatePicker()}
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* Access Limits Section */}
            <View style={styles.section}>
              {renderSectionHeader(
                <Eye size={18} color={Colors.gold} />,
                'Access Limits'
              )}
              <View style={styles.radioGroup}>
                {ACCESS_LIMIT_OPTIONS.map((option) => (
                  <React.Fragment key={option.value}>
                    {renderRadioOption(
                      option.label,
                      settings.accessLimit === option.value,
                      () => updateSetting('accessLimit', option.value)
                    )}
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* Gallery Customization Section */}
            <View style={styles.section}>
              {renderSectionHeader(
                <Palette size={18} color={Colors.gold} />,
                'Gallery Customization'
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gallery Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={settings.galleryTitle}
                  onChangeText={(text) => updateSetting('galleryTitle', text)}
                  placeholder="Gallery name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  value={settings.description}
                  onChangeText={(text) => updateSetting('description', text)}
                  placeholder="Add a description for your gallery..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Theme</Text>
                <View style={styles.chipGroup}>
                  {THEME_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.chip,
                        settings.theme === option.value && styles.chipSelected,
                      ]}
                      onPress={() => updateSetting('theme', option.value)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          settings.theme === option.value && styles.chipTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Layout</Text>
                <View style={styles.layoutGrid}>
                  {LAYOUT_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.layoutOption,
                        settings.layout === option.value && styles.layoutOptionSelected,
                      ]}
                      onPress={() => updateSetting('layout', option.value)}
                    >
                      <LayoutGrid
                        size={20}
                        color={
                          settings.layout === option.value ? Colors.gold : Colors.textMuted
                        }
                      />
                      <Text
                        style={[
                          styles.layoutLabel,
                          settings.layout === option.value && styles.layoutLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Watermark Section */}
            <View style={styles.section}>
              {renderSectionHeader(
                <Droplets size={18} color={Colors.gold} />,
                'Watermark'
              )}
              {renderToggle(
                'Enable Watermark',
                settings.enableWatermark,
                (v) => updateSetting('enableWatermark', v),
                'Apply a watermark to shared photos'
              )}

              {settings.enableWatermark && (
                <View style={styles.nestedToggles}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Watermark Text</Text>
                    <TextInput
                      style={styles.textInput}
                      value={settings.watermarkText}
                      onChangeText={(text) => updateSetting('watermarkText', text)}
                      placeholder="Enter watermark text"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Position</Text>
                    <View style={styles.chipGroup}>
                      {WATERMARK_POSITIONS.map((option) => (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.chip,
                            settings.watermarkPosition === option.value &&
                              styles.chipSelected,
                          ]}
                          onPress={() => updateSetting('watermarkPosition', option.value)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              settings.watermarkPosition === option.value &&
                                styles.chipTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.sliderHeader}>
                      <Text style={styles.inputLabel}>Opacity</Text>
                      <Text style={styles.sliderValue}>
                        {Math.round(settings.watermarkOpacity * 100)}%
                      </Text>
                    </View>
                    <View style={styles.opacityBar}>
                      {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(
                        (val) => (
                          <Pressable
                            key={val}
                            style={[
                              styles.opacitySegment,
                              {
                                backgroundColor:
                                  val <= settings.watermarkOpacity
                                    ? Colors.gold
                                    : '#374151',
                              },
                            ]}
                            onPress={() => updateSetting('watermarkOpacity', val)}
                          />
                        )
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Bottom Action */}
          <View style={styles.bottomAction}>
            {!linkCreated ? (
              <Pressable
                style={[styles.createButton, loading && styles.createButtonDisabled]}
                onPress={handleCreateLink}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.background} />
                ) : (
                  <>
                    <LinkIcon size={20} color={Colors.background} />
                    <Text style={styles.createButtonText}>Create Secure Link</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <View style={styles.linkCreatedContainer}>
                {settings.requirePassword && settings.password && (
                  <View style={[styles.linkDisplay, { backgroundColor: 'rgba(212,175,55,0.15)', borderColor: Colors.gold, marginBottom: 8 }]}>
                    <Lock size={16} color={Colors.gold} />
                    <Text style={[styles.linkText, { color: Colors.gold }]} selectable>
                      Password: {settings.password}
                    </Text>
                  </View>
                )}
                <View style={styles.linkDisplay}>
                  <Check size={16} color="#10B981" />
                  <Text style={styles.linkText} numberOfLines={1}>
                    {createdShareUrl}
                  </Text>
                </View>
                <View style={styles.linkActions}>
                  <Pressable style={styles.copyButton} onPress={handleCopyLink}>
                    {copied ? (
                      <Check size={16} color="#10B981" />
                    ) : (
                      <Copy size={16} color={Colors.gold} />
                    )}
                    <Text style={[styles.copyButtonText, copied && { color: '#10B981' }]}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.shareButton} onPress={handleShareLink}>
                    <Share2 size={16} color={Colors.background} />
                    <Text style={styles.shareButtonText}>Share</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  container: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.white,
  },
  toggleDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  nestedToggles: {
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  inputGroup: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.white,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 8,
  },
  radioGroup: {
    gap: 4,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
  },
  radioOptionSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
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
    color: Colors.textSecondary,
  },
  radioLabelSelected: {
    color: Colors.white,
    fontWeight: '500',
  },
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginLeft: 32,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  datePickerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  datePickerButton: {
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  datePickerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gold,
  },
  textInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.white,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSelected: {
    backgroundColor: Colors.goldMuted,
    borderColor: Colors.gold,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.gold,
    fontWeight: '600',
  },
  layoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  layoutOption: {
    width: (SCREEN_WIDTH - 80) / 3,
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  layoutOptionSelected: {
    backgroundColor: Colors.goldMuted,
    borderColor: Colors.gold,
  },
  layoutLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  layoutLabelSelected: {
    color: Colors.gold,
    fontWeight: '600',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
  opacityBar: {
    flexDirection: 'row',
    gap: 4,
  },
  opacitySegment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  bottomSpacer: {
    height: 20,
  },
  bottomAction: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  linkCreatedContainer: {
    gap: 12,
  },
  linkDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: Colors.white,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  linkActions: {
    flexDirection: 'row',
    gap: 10,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gold,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.background,
  },
});
