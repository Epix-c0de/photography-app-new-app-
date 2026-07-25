import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Alert, Share, Linking, Platform, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Shield, Link2, Check, X, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { getGalleryShareUrl, getShareMessage, getAppShareUrl } from '@/lib/platform-config';

interface GalleryShareSheetProps {
  visible: boolean;
  onClose: () => void;
  galleryId: string;
  galleryName: string;
  adminId?: string;
  accessCode?: string;
  coverUrl?: string;
  photoCount?: number;
  brandName?: string;
}

export default function GalleryShareSheet({
  visible,
  onClose,
  galleryId,
  galleryName,
  adminId,
  accessCode,
  coverUrl,
  photoCount = 0,
  brandName = 'Studio',
}: GalleryShareSheetProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (visible) {
      setLoading(true);
      getGalleryShareUrl(galleryId, accessCode, adminId)
        .then(setShareUrl)
        .catch(() => setShareUrl(''))
        .finally(() => setLoading(false));
    }
  }, [visible, galleryId, accessCode, adminId]);

  const getMessage = (extra?: string) => {
    const base = `Check out "${galleryName}" by ${brandName}`;
    const link = shareUrl ? `\n\nView here: ${shareUrl}` : '';
    const app = shareUrl ? `\n\nGet the app: ${shareUrl}` : '';
    return extra ? `${extra}\n${link}` : `${base}${link}${app}`;
  };

  const handleCopyLink = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppChat = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = getMessage(`Hey! Look at "${galleryName}" by ${brandName}`);
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp Not Installed', 'Install WhatsApp to share directly.');
      }
    } catch {}
    onClose();
  };

  const handleWhatsAppStatus = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // WhatsApp Status sharing - copy link for user to paste
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert(
      'Link Copied',
      'Open WhatsApp → Status → Paste the link to share.',
      [
        { text: 'Open WhatsApp', onPress: () => Linking.openURL('whatsapp://') },
        { text: 'OK', style: 'cancel' },
      ]
    );
    onClose();
  };

  const handleInstagram = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Instagram doesn't support direct link sharing - copy for manual paste
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert(
      'Link Copied',
      'Open Instagram → Story or Post → Paste the link in your caption.',
      [
        { text: 'Open Instagram', onPress: () => Linking.openURL('instagram://app') },
        { text: 'OK', style: 'cancel' },
      ]
    );
    onClose();
  };

  const handleTikTok = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert(
      'Link Copied',
      'Open TikTok → Create a post → Paste the link in your caption or bio.',
      [
        { text: 'Open TikTok', onPress: () => Linking.openURL('snssdk1233://') },
        { text: 'OK', style: 'cancel' },
      ]
    );
    onClose();
  };

  const handleFacebook = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = getMessage();
    try {
      const fbUrl = `fb://facewebmodal/f?href=${encodeURIComponent(shareUrl)}`;
      if (await Linking.canOpenURL(fbUrl)) {
        await Linking.openURL(fbUrl);
      } else {
        await Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`);
      }
    } catch {
      await Clipboard.setStringAsync(shareUrl);
      Alert.alert('Link Copied', 'Open Facebook to share.');
    }
    onClose();
  };

  const handleTwitter = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tweet = encodeURIComponent(getMessage(`Beautiful moments from "${galleryName}" by ${brandName}`));
    try {
      const xUrl = `twitter://post?message=${tweet}`;
      if (await Linking.canOpenURL(xUrl)) {
        await Linking.openURL(xUrl);
      } else {
        await Linking.openURL(`https://x.com/intent/tweet?text=${tweet}`);
      }
    } catch {
      await Clipboard.setStringAsync(shareUrl);
    }
    onClose();
  };

  const handleMoreOptions = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: getMessage(),
        url: shareUrl,
        title: `Share ${galleryName}`,
      });
    } catch {}
    onClose();
  };

  const channels = [
    {
      id: 'whatsapp-chat',
      label: 'WhatsApp Chat',
      icon: 'whatsapp' as const,
      color: '#25D366',
      bgColor: 'rgba(37,211,102,0.18)',
      onPress: handleWhatsAppChat,
    },
    {
      id: 'whatsapp-status',
      label: 'WhatsApp Status',
      icon: 'whatsapp' as const,
      color: '#25D366',
      bgColor: 'rgba(37,211,102,0.18)',
      onPress: handleWhatsAppStatus,
    },
    {
      id: 'instagram',
      label: 'Instagram',
      icon: 'instagram' as const,
      color: '#E1306C',
      bgColor: 'rgba(225,48,108,0.18)',
      onPress: handleInstagram,
    },
    {
      id: 'tiktok',
      label: 'TikTok',
      icon: 'music-note-eighth' as const,
      color: Colors.white,
      bgColor: 'rgba(255,255,255,0.12)',
      onPress: handleTikTok,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: 'facebook' as const,
      color: '#1877F2',
      bgColor: 'rgba(24,119,242,0.2)',
      onPress: handleFacebook,
    },
    {
      id: 'twitter',
      label: 'X (Twitter)',
      icon: 'alpha-x' as const,
      color: Colors.white,
      bgColor: 'rgba(255,255,255,0.12)',
      onPress: handleTwitter,
    },
    {
      id: 'copy',
      label: copied ? 'Copied!' : 'Copy Link',
      icon: copied ? 'check' as const : 'content-copy' as const,
      color: copied ? '#10B981' : Colors.white,
      bgColor: copied ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.12)',
      onPress: handleCopyLink,
    },
    {
      id: 'more',
      label: 'More Options',
      icon: 'share-variant' as const,
      color: Colors.gold,
      bgColor: 'rgba(212,175,55,0.2)',
      onPress: handleMoreOptions,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Share Gallery</Text>
              <Text style={styles.subtitle}>{galleryName} by {brandName}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textMuted} />
            </Pressable>
          </View>

          {/* Privacy badge */}
          <View style={styles.privacyBadge}>
            <Shield size={14} color="#10B981" />
            <Text style={styles.privacyText}>Photos are protected — recipients can view but cannot download or screenshot</Text>
          </View>

          {/* Preview */}
          {coverUrl && (
            <View style={styles.previewRow}>
              <Image source={{ uri: coverUrl }} style={styles.previewImage} contentFit="cover" />
              <View style={styles.previewInfo}>
                <Text style={styles.previewName} numberOfLines={1}>{galleryName}</Text>
                <Text style={styles.previewMeta}>{photoCount} photos</Text>
              </View>
              <View style={styles.linkBadge}>
                <Link2 size={12} color={Colors.gold} />
                <Text style={styles.linkBadgeText}>Link ready</Text>
              </View>
            </View>
          )}

          {/* Channel grid */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={Colors.gold} />
              <Text style={styles.loadingText}>Generating share link...</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {channels.map((ch) => (
                <Pressable key={ch.id} style={styles.gridButton} onPress={ch.onPress}>
                  <View style={[styles.gridIconWrap, { backgroundColor: ch.bgColor }]}>
                    <MaterialCommunityIcons name={ch.icon} size={20} color={ch.color} />
                  </View>
                  <Text style={styles.gridLabel} numberOfLines={1}>{ch.label}</Text>
                  {ch.id === 'copy' && copied && (
                    <View style={styles.checkBadge}>
                      <Check size={10} color="#10B981" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropPress: {
    flex: 1,
  },
  container: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '80%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  privacyText: {
    flex: 1,
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    gap: 10,
  },
  previewImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  previewMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  linkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  linkBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.gold,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridButton: {
    width: '23%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    position: 'relative',
  },
  gridIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
