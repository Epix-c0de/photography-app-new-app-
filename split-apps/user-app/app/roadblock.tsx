// Task 8.1: Roadblock screen for unassigned users
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.9, 19.10

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, X, WifiOff, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import type { BTSPost, Announcement } from '@/types/content';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;

export default function RoadblockScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // State
  const [loading, setLoading] = useState(true);
  const [btsPosts, setBtsPosts] = useState<BTSPost[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [contentError, setContentError] = useState(false);

  // Load global content on mount
  useEffect(() => {
    loadGlobalContent();
    
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Log analytics event
    logUnassignedUserEvent('landed');
  }, []);

  const loadGlobalContent = async () => {
    setLoading(true);
    setContentError(false);
    try {
      const [btsRes, annRes] = await Promise.all([
        supabase
          .from('bts_posts')
          .select('*, user_profiles!bts_posts_created_by_fkey(name)')
          .eq('is_active', true)
          .eq('visibility', 'global')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('announcements')
          .select('*, user_profiles!announcements_admin_id_fkey(name)')
          .eq('is_active', true)
          .eq('visibility', 'global')
          .order('created_at', { ascending: false })
          .limit(4),
      ]);

      if (btsRes.error) console.error('[Roadblock] BTS error:', btsRes.error);
      else {
        setBtsPosts(
          (btsRes.data || []).map((post) => ({
            ...post,
            admin_name: (post as any).user_profiles?.name || 'Photographer',
          })) as BTSPost[]
        );
      }

      if (annRes.error) console.error('[Roadblock] Announcements error:', annRes.error);
      else {
        setAnnouncements(
          (annRes.data || []).map((ann) => ({
            ...ann,
            admin_name: (ann as any).user_profiles?.name || 'Photographer',
          })) as Announcement[]
        );
      }
    } catch (error) {
      console.error('[Roadblock] Error loading content:', error);
      setContentError(true);
    } finally {
      setLoading(false);
    }
  };

  const logUnassignedUserEvent = async (eventType: string, metadata?: any) => {
    if (!user?.id) return;
    
    try {
      await supabase.rpc('log_unassigned_user_event', {
        p_event_type: eventType,
        p_metadata: metadata || {},
      });
    } catch (error) {
      // Silent fail - analytics shouldn't block user experience
      console.warn('[Roadblock] Analytics error:', error);
    }
  };

  const handleEnterCode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Continue browsing global content - just scroll down
  };

  const handleCodeSubmit = async () => {
    if (!code || code.trim().length !== 8) {
      Alert.alert('Invalid Code', 'Please enter a valid 8-character photographer code.');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to enter a photographer code.');
      return;
    }

    setSubmitting(true);
    setNetworkError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await logUnassignedUserEvent('code_entered', { code: code.toUpperCase() });

      const { data, error } = await supabase.rpc('assign_client_to_photographer', {
        p_client_id: user.id,
        p_photographer_code: code.toUpperCase(),
      });

      if (error) {
        console.error('[Roadblock] Assignment error:', error);
        // Check for network error — show inline banner so code stays intact (Req 16.7)
        const msg = (error as any)?.message?.toLowerCase() || '';
        if (
          msg.includes('failed to fetch') ||
          msg.includes('network') ||
          msg.includes('connection') ||
          msg.includes('timeout')
        ) {
          setNetworkError(true);
        } else {
          Alert.alert('Error', 'Failed to connect with photographer. Please try again.');
        }
        return;
      }

      if (!data?.success) {
        Alert.alert(
          'Invalid Code',
          data?.error || 'Invalid photographer code. Please check with your photographer.'
        );
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Connected!',
        `Connected to ${data.admin_name || 'your photographer'}! You can now access your galleries and packages.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setModalVisible(false);
              router.replace('/(tabs)/home');
            },
          },
        ]
      );
    } catch (error) {
      console.error('[Roadblock] Unexpected error:', error);
      // Network-level error — show inline retry banner (Req 16.1)
      const msg = (error as any)?.message?.toLowerCase() || '';
      if (
        error instanceof TypeError ||
        msg.includes('failed to fetch') ||
        msg.includes('network')
      ) {
        setNetworkError(true);
      } else {
        Alert.alert('Error', 'Connection lost. Please check your internet and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewBTSPost = (post: BTSPost) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    logUnassignedUserEvent('viewed_bts', { post_id: post.id });
    router.push(`/bts/${post.id}` as any);
  };

  const handleViewAnnouncement = (announcement: Announcement) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    logUnassignedUserEvent('viewed_announcement', { announcement_id: announcement.id });
    router.push(`/announcements/${announcement.id}` as any);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 120 },
        ]}
      >
        {/* Hero Section */}
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Illustration placeholder - using gradient + camera icon */}
          <View style={styles.illustration}>
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.illustrationGradient}
            >
              <Camera size={64} color={Colors.background} strokeWidth={1.5} />
            </LinearGradient>
          </View>

          {/* Heading */}
          <Text style={styles.heroTitle}>Connect with Your Photographer</Text>
          <Text style={styles.heroSubtitle}>
            Browse available content below, or enter your photographer's code to unlock your personal gallery
          </Text>

          {/* CTA Buttons */}
          <Pressable
            style={styles.primaryButton}
            onPress={handleEnterCode}
            android_ripple={{ color: Colors.goldLight }}
          >
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Enter Photographer Code</Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleSkip}>
            <Text style={styles.secondaryButtonText}>Skip</Text>
          </Pressable>

          <Text style={styles.footerText}>
            Don't have a code? Your photographer will provide one.
          </Text>
        </Animated.View>

        {/* Global Content Section */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingText}>Loading content...</Text>
          </View>
        ) : contentError ? (
          <View style={styles.errorContainer}>
            <WifiOff size={40} color={Colors.textMuted} />
            <Text style={styles.errorText}>Could not load content.</Text>
            <Pressable style={styles.retryContentButton} onPress={loadGlobalContent}>
              <RefreshCw size={16} color={Colors.gold} />
              <Text style={styles.retryContentButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* BTS Posts */}
            {btsPosts.length > 0 && (
              <Animated.View style={[styles.contentSection, { opacity: fadeAnim }]}>
                <Text style={styles.sectionTitle}>Behind the Scenes</Text>
                <Text style={styles.sectionSubtitle}>
                  Explore exclusive content from talented photographers
                </Text>

                {btsPosts.map((post, index) => (
                  <BTSCard
                    key={post.id}
                    post={post}
                    index={index}
                    onPress={() => handleViewBTSPost(post)}
                  />
                ))}
              </Animated.View>
            )}

            {/* Announcements */}
            {announcements.length > 0 && (
              <Animated.View style={[styles.contentSection, { opacity: fadeAnim }]}>
                <Text style={styles.sectionTitle}>Announcements</Text>
                <Text style={styles.sectionSubtitle}>
                  Stay updated with the latest news and offers
                </Text>

                {announcements.map((announcement, index) => (
                  <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                    index={index}
                    onPress={() => handleViewAnnouncement(announcement)}
                  />
                ))}
              </Animated.View>
            )}

            {/* Empty state */}
            {btsPosts.length === 0 && announcements.length === 0 && (
              <View style={styles.emptyState}>
                <Camera size={48} color={Colors.textMuted} strokeWidth={1.5} />
                <Text style={styles.emptyStateText}>No global content available yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Enter your photographer code to access your personal content
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Code Entry Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !submitting && setModalVisible(false)}
          />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Photographer Code</Text>
              <Pressable
                onPress={() => !submitting && setModalVisible(false)}
                style={styles.modalClose}
              >
                <X size={24} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.modalDescription}>
              Enter the 8-character code provided by your photographer to access your galleries and packages.
            </Text>

            {/* Inline network error banner — code stays intact on retry (Req 16.7) */}
            {networkError && (
              <View style={styles.networkErrorBanner}>
                <WifiOff size={16} color="#FF3B30" />
                <Text style={styles.networkErrorText}>
                  Connection lost. Please check your internet and try again.
                </Text>
                <Pressable
                  onPress={() => { setNetworkError(false); handleCodeSubmit(); }}
                  style={styles.retryButton}
                  disabled={submitting}
                >
                  <RefreshCw size={14} color={Colors.gold} />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            )}

            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(text) => setCode(text.toUpperCase())}
              placeholder="ABC12345"
              placeholderTextColor={Colors.textMuted}
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              editable={!submitting}
            />

            <Pressable
              style={[styles.modalSubmitButton, submitting && styles.modalSubmitButtonDisabled]}
              onPress={handleCodeSubmit}
              disabled={submitting || code.trim().length !== 8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Text style={styles.modalSubmitButtonText}>Connect</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// BTS Card Component
function BTSCard({ post, index, onPress }: { post: BTSPost; index: number; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
      <Pressable
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
        onPress={onPress}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <View style={styles.cardImageContainer}>
            {post.image_url || post.media_url ? (
              <Image
                source={{ uri: post.image_url || post.media_url }}
                style={styles.cardImage}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={[Colors.card, Colors.cardLight]}
                style={styles.cardImage}
              />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.cardOverlay}
            />
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {post.title}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              By {post.admin_name}
            </Text>
            <View style={styles.cardCta}>
              <Text style={styles.cardCtaText}>View</Text>
              <ChevronRight size={14} color={Colors.gold} />
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// Announcement Card Component
function AnnouncementCard({
  announcement,
  index,
  onPress,
}: {
  announcement: Announcement;
  index: number;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
      <Pressable
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
        onPress={onPress}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <View style={styles.cardImageContainer}>
            {announcement.image_url ? (
              <Image
                source={{ uri: announcement.image_url }}
                style={styles.cardImage}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={[Colors.cardDark, Colors.card]}
                style={styles.cardImage}
              />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.cardOverlay}
            />
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {announcement.title}
            </Text>
            <Text style={styles.cardText} numberOfLines={2}>
              {announcement.content}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              By {announcement.admin_name}
            </Text>
            <View style={styles.cardCta}>
              <Text style={styles.cardCtaText}>Read More</Text>
              <ChevronRight size={14} color={Colors.gold} />
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  illustration: {
    width: 160,
    height: 160,
    marginBottom: 32,
  },
  illustrationGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  primaryButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.background,
  },
  secondaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  footerText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  contentSection: {
    marginBottom: 48,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardCtaText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gold,
    marginRight: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryContentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  retryContentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gold,
  },
  networkErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  networkErrorText: {
    flex: 1,
    fontSize: 13,
    color: '#FF3B30',
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  modalClose: {
    padding: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  codeInput: {
    width: '100%',
    height: 56,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalSubmitButton: {
    width: '100%',
    height: 56,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitButtonDisabled: {
    opacity: 0.5,
  },
  modalSubmitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.background,
  },
});
