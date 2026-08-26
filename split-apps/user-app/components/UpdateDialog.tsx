import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Dimensions,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Download,
  ExternalLink,
  Shield,
  Sparkles,
  ChevronRight,
  Clock,
  FileDown,
  X,
  AlertTriangle,
} from 'lucide-react-native';
import { useUpdate } from '../contexts/UpdateContext';
import Colors from '../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Animated glow pulse ─────────────────────────────────────────────────────

function GlowPulse() {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 1200 }, () => {
      opacity.value = withTiming(0.3, { duration: 1200 });
    });
  }, [opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.glowOrb,
        style,
        {
          position: 'absolute',
          top: -60,
          alignSelf: 'center',
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(212, 175, 55, 0.15)',
          blurRadius: 60,
        },
      ]}
    />
  );
}

// ─── Update dialog (optional update) ─────────────────────────────────────────

export function UpdateDialog() {
  const { showDialog, versionInfo, installedVersion, applyUpdate, dismissUpdate, status } =
    useUpdate();

  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (showDialog && status !== 'force-update') {
      cardScale.value = withSpring(1, { damping: 15, stiffness: 200 });
      cardOpacity.value = withTiming(1, { duration: 250 });
    }
  }, [showDialog, status]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  if (!showDialog || !versionInfo || status === 'force-update') return null;

  const handleUpdate = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    applyUpdate();
    if (versionInfo.downloadUrl) {
      Linking.openURL(versionInfo.downloadUrl);
    }
  };

  const handleLater = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissUpdate();
  };

  return (
    <Modal transparent visible={showDialog} animationType="fade" onRequestClose={handleLater}>
      <View style={styles.overlay}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.dialogContainer}
        >
          <Animated.View style={[styles.dialogCard, cardAnimatedStyle]}>
            <GlowPulse />

            {/* Close button (hidden in force mode, but shown here for optional) */}
            <Pressable style={styles.closeButton} onPress={handleLater} hitSlop={12}>
              <X size={18} color={Colors.textMuted} />
            </Pressable>

            {/* App icon + sparkle */}
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.iconContainer}>
              <View style={styles.iconGlow} />
              <View style={styles.appIconWrap}>
                <Text style={styles.appIconText}>Epix</Text>
              </View>
              <View style={styles.sparkleWrap}>
                <Sparkles size={16} color={Colors.gold} />
              </View>
            </Animated.View>

            {/* Title */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <Text style={styles.dialogTitle}>Update Available</Text>
            </Animated.View>

            {/* Version badge */}
            <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.versionBadgeRow}>
              <View style={styles.versionBadge}>
                <Text style={styles.versionBadgeText}>{installedVersion}</Text>
              </View>
              <ChevronRight size={14} color={Colors.textMuted} />
              <View style={[styles.versionBadge, styles.versionBadgeNew]}>
                <Text style={[styles.versionBadgeText, { color: Colors.gold }]}>
                  {versionInfo.latestVersion}
                </Text>
              </View>
            </Animated.View>

            {/* Release notes */}
            <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.notesContainer}>
              <ScrollView style={styles.notesScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.notesTitle}>What's New</Text>
                <Text style={styles.notesText}>{versionInfo.releaseNotes}</Text>
              </ScrollView>
            </Animated.View>

            {/* File info */}
            {versionInfo.fileSize && (
              <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.fileInfoRow}>
                <FileDown size={14} color={Colors.textMuted} />
                <Text style={styles.fileInfoText}>{versionInfo.fileSize}</Text>
                {versionInfo.publishedAt && (
                  <>
                    <View style={styles.fileDot} />
                    <Clock size={12} color={Colors.textMuted} />
                    <Text style={styles.fileInfoText}>
                      {new Date(versionInfo.publishedAt).toLocaleDateString()}
                    </Text>
                  </>
                )}
              </Animated.View>
            )}

            {/* Buttons */}
            <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.buttonRow}>
              <Pressable style={styles.laterButton} onPress={handleLater}>
                <Text style={styles.laterButtonText}>Later</Text>
              </Pressable>
              <Pressable style={styles.updateButton} onPress={handleUpdate}>
                <LinearGradient
                  colors={[Colors.gold, Colors.goldDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.updateButtonGradient}
                >
                  <Download size={16} color="#000" />
                  <Text style={styles.updateButtonText}>Update Now</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Force update lock screen ────────────────────────────────────────────────

export function ForceUpdateScreen() {
  const { showDialog, versionInfo, installedVersion, applyUpdate, status } = useUpdate();

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (showDialog && status === 'force-update') {
      pulse.value = withSpring(1.05, { damping: 10, stiffness: 100 }, () => {
        pulse.value = withSpring(1, { damping: 10, stiffness: 100 });
      });
    }
  }, [showDialog, status]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  if (!showDialog || !versionInfo || status !== 'force-update') return null;

  const handleUpdate = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    applyUpdate();
    if (versionInfo.downloadUrl) {
      Linking.openURL(versionInfo.downloadUrl);
    }
  };

  return (
    <Modal transparent visible={showDialog} animationType="fade" statusBarTranslucent>
      <View style={styles.forceOverlay}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.forceContainer}>
          {/* Shield icon with warning */}
          <Animated.View entering={FadeIn.delay(100).springify()} style={styles.forceIconWrap}>
            <View style={styles.forceShieldBg}>
              <Shield size={40} color={Colors.gold} />
            </View>
            <View style={styles.forceWarningBadge}>
              <AlertTriangle size={14} color="#000" />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Text style={styles.forceTitle}>Update Required</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <Text style={styles.forceSubtitle}>
              This version is no longer supported.{'\n'}Please update to continue using the app.
            </Text>
          </Animated.View>

          {/* Version info */}
          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.forceVersionRow}>
            <View style={styles.forceVersionItem}>
              <Text style={styles.forceVersionLabel}>Current</Text>
              <View style={styles.forceVersionBadge}>
                <Text style={styles.forceVersionValue}>{installedVersion}</Text>
              </View>
            </View>
            <ChevronRight size={16} color={Colors.textMuted} />
            <View style={styles.forceVersionItem}>
              <Text style={styles.forceVersionLabel}>Required</Text>
              <View style={[styles.forceVersionBadge, { borderColor: Colors.gold }]}>
                <Text style={[styles.forceVersionValue, { color: Colors.gold }]}>
                  {versionInfo.latestVersion}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Release notes */}
          <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.forceNotesWrap}>
            <ScrollView style={styles.forceNotesScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.forceNotes}>{versionInfo.releaseNotes}</Text>
            </ScrollView>
          </Animated.View>

          {/* Update button */}
          <Animated.View entering={FadeInUp.delay(450).springify()}>
            <Pressable style={styles.forceUpdateButton} onPress={handleUpdate}>
              <Animated.View style={pulseStyle}>
                <LinearGradient
                  colors={[Colors.gold, Colors.goldDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.forceUpdateGradient}
                >
                  <Download size={18} color="#000" />
                  <Text style={styles.forceUpdateText}>Update Now</Text>
                  <ExternalLink size={16} color="#000" />
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </Animated.View>

          {/* File size */}
          {versionInfo.fileSize && (
            <Animated.View entering={FadeIn.delay(500)} style={styles.forceFileInfo}>
              <FileDown size={12} color={Colors.textMuted} />
              <Text style={styles.forceFileInfoText}>{versionInfo.fileSize}</Text>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Update error toast (inline) ─────────────────────────────────────────────

export function UpdateErrorBanner() {
  const { error, status } = useUpdate();

  if (status !== 'error' || !error) return null;

  return (
    <Animated.View entering={FadeInDown.springify()} style={styles.errorBanner}>
      <AlertTriangle size={16} color={Colors.warning} />
      <Text style={styles.errorBannerText}>{error.friendlyMessage}</Text>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Overlay ──
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  dialogContainer: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
  },

  // ── Card ──
  dialogCard: {
    backgroundColor: 'rgba(22,22,28,0.97)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  glowOrb: {
    position: 'absolute',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },

  // ── Icon ──
  iconContainer: {
    width: 72,
    height: 72,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  appIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.gold,
    letterSpacing: -0.5,
  },
  sparkleWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Text ──
  dialogTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 8,
    letterSpacing: -0.5,
  },

  // ── Version badge ──
  versionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.cardLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  versionBadgeNew: {
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  versionBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  // ── Release notes ──
  notesContainer: {
    width: '100%',
    maxHeight: 160,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    marginBottom: 16,
  },
  notesScroll: {
    flex: 1,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── File info ──
  fileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  fileInfoText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  fileDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
    marginHorizontal: 2,
  },

  // ── Buttons ──
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  laterButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  updateButton: {
    flex: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  updateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  updateButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },

  // ── Force update screen ──
  forceOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  forceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  forceIconWrap: {
    width: 96,
    height: 96,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forceShieldBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forceWarningBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  forceTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 10,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  forceSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  forceVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  forceVersionItem: {
    alignItems: 'center',
    gap: 6,
  },
  forceVersionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  forceVersionBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.cardLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  forceVersionValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  forceNotesWrap: {
    width: '100%',
    maxHeight: 120,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 28,
  },
  forceNotesScroll: {
    flex: 1,
  },
  forceNotes: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  forceUpdateButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  forceUpdateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  forceUpdateText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  forceFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  forceFileInfoText: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  // ── Error banner ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(243,156,18,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(243,156,18,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.warning,
    lineHeight: 18,
  },
});
