import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronLeft, MessageCircle, Heart, Share2, ArrowRight, Play, Layers, Crown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { ClientService } from '@/services/client';
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;

interface Announcement {
  id: string;
  title: string;
  content?: string;
  description?: string | null;
  content_html?: string | null;
  media_urls?: string[];
  image_url?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  created_at: string;
  user_profiles?: {
    name: string | null;
    avatar_url: string | null;
  };
  announcement_comments?: Array<{
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    user_profiles?: {
      id: string;
      name: string | null;
      avatar_url: string | null;
    };
  }> | any[];
  announcement_reactions?: Array<{
    id: string;
    user_id: string;
    reaction_emoji: string;
  }> | any[];
  owner_admin_id?: string;
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function AnnouncementCard({ announcement, onPress, index }: { announcement: Announcement; onPress: () => void; index: number }) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [reactionCount, setReactionCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    const userReacted = announcement.announcement_reactions?.some(r => r.user_id === user?.id);
    setIsLiked(!!userReacted);
    setReactionCount(announcement.announcement_reactions?.length || 0);
    setCommentCount(announcement.announcement_comments?.length || 0);
  }, [announcement, user]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleReaction = useCallback(async () => {
    if (isLiking || !user) return;
    setIsLiking(true);
    
    const newLikedState = !isLiked;
    const newCount = newLikedState ? reactionCount + 1 : Math.max(0, reactionCount - 1);
    
    // Optimistic update
    setIsLiked(newLikedState);
    setReactionCount(newCount);
    
    try {
      if (newLikedState) {
        await ClientService.announcements.addReaction(announcement.id, '👍');
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Revert on error
      setIsLiked(!newLikedState);
      setReactionCount(reactionCount);
      console.error('Failed to toggle reaction:', e);
    } finally {
      setIsLiking(false);
    }
  }, [announcement.id, isLiked, reactionCount, user, isLiking]);

  
  const hasMedia = announcement.media_urls && announcement.media_urls.length > 0;

  return (
    <Animated.View style={[styles.cardContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        {/* Premium Glass Card Background */}
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['rgba(26,26,26,0.9)', 'rgba(10,10,10,0.95)']}
          style={StyleSheet.absoluteFillObject}
        />
        
        {/* Gold Accent Border */}
        <View style={styles.cardBorder} />
        
        {/* Featured Media - Premium Style */}
        {hasMedia && (
          <Pressable 
            style={styles.mediaContainer}
            onPress={onPress}
          >
            <LinearGradient
              colors={['rgba(212,175,55,0.1)', 'transparent']}
              style={styles.mediaGradient}
            />
            {announcement.media_type === 'video' || (announcement.media_urls?.[0] && /\.(mp4|mov|avi|mkv)$/i.test(announcement.media_urls[0])) ? (
              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: announcement.media_urls![0] }}
                  style={styles.video}
                  resizeMode={ResizeMode.COVER}
                  useNativeControls={true}
                  isLooping={false}
                  shouldPlay={false}
                  isMuted={true}
                />
                {/* Play Button Overlay */}
                <View style={styles.playButtonOverlay}>
                  <View style={styles.playButton}>
                    <View style={styles.playButtonBg}>
                      <Play size={24} color={Colors.textPrimary} fill={Colors.textPrimary} />
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <Image
                source={{ uri: announcement.media_urls![0] }}
                style={styles.media}
                contentFit="cover"
              />
            )}
            {/* Multiple Media Indicator */}
            {announcement.media_urls && announcement.media_urls.length > 1 && (
              <View style={styles.multiMediaIndicator}>
                <View style={styles.multiMediaBadge}>
                  <Layers size={14} color={Colors.textPrimary} />
                  <Text style={styles.multiMediaText}>{announcement.media_urls.length}</Text>
                </View>
              </View>
            )}
          </Pressable>
        )}

        {/* Content */}
        <View style={styles.contentContainer}>
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <View style={styles.authorSection}>
              <View style={styles.avatarRing}>
                <Image
                  source={{ uri: announcement.user_profiles?.avatar_url || 'https://via.placeholder.com/40' }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              </View>
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>{announcement.user_profiles?.name || 'Studio Team'}</Text>
                <Text style={styles.timestamp}>{relativeTime(announcement.created_at)}</Text>
              </View>
            </View>
            <Pressable style={styles.moreButton} onPress={onPress}>
              <View style={styles.moreButtonBg}>
                <ArrowRight size={18} color={Colors.gold} />
              </View>
            </Pressable>
          </View>

          {/* Title & Description */}
          <Text style={styles.title} numberOfLines={2}>{announcement.title}</Text>
          {(announcement.description || announcement.content) && (
            <Text style={styles.description} numberOfLines={hasMedia ? 2 : 3}>
              {announcement.description || announcement.content}
            </Text>
          )}

          {/* Stats & Actions Row */}
          <View style={styles.footer}>
            <View style={styles.statsRow}>
              {reactionCount > 0 && (
                <View style={styles.statItem}>
                  <View style={styles.statIconBg}>
                    <Heart size={12} color={Colors.error} fill={Colors.error} />
                  </View>
                  <Text style={styles.statValue}>{reactionCount}</Text>
                </View>
              )}
              {commentCount > 0 && (
                <View style={styles.statItem}>
                  <View style={[styles.statIconBg, { backgroundColor: Colors.goldMuted }]}>
                    <MessageCircle size={12} color={Colors.gold} />
                  </View>
                  <Text style={styles.statValue}>{commentCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionBtn, isLiked && styles.actionBtnActive]}
                onPress={handleReaction}
                disabled={isLiking}
              >
                <Heart
                  size={18}
                  color={isLiked ? Colors.error : Colors.textMuted}
                  fill={isLiked ? Colors.error : 'none'}
                />
                <Text style={[styles.actionBtnText, isLiked && { color: Colors.error }]}>
                  {reactionCount > 0 ? reactionCount : 'Like'}
                </Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={onPress}>
                <MessageCircle size={18} color={Colors.textMuted} />
                <Text style={styles.actionBtnText}>
                  {commentCount > 0 ? commentCount : 'Comment'}
                </Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={onPress}>
                <Share2 size={18} color={Colors.textMuted} />
                <Text style={styles.actionBtnText}>Share</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function AnnouncementsAllScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ClientService.announcements.list();
      setAnnouncements(data as unknown as Announcement[]);
    } catch (e) {
      console.error('Failed to fetch announcements:', e);
      Alert.alert('Error', 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAnnouncements();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAnnouncements]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    const unsubscribe = ClientService.announcements.subscribeToAnnouncements(() => {
      fetchAnnouncements();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchAnnouncements]);

  const scrollY = useRef(new Animated.Value(0)).current;

  if (loading && announcements.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <View style={[styles.modernHeader, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.push('/(tabs)/home' as any)} style={styles.backBtn}>
          <View style={styles.backBtnBg}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </View>
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Announcements</Text>
          <Text style={styles.headerSubtitle}>{announcements.length} updates</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.filterBtn}>
            <Sparkles size={20} color={Colors.gold} />
          </Pressable>
        </View>
      </View>

      {/* Modern Grid Layout */}
      <Animated.FlatList
        data={announcements}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <AnnouncementCard
            announcement={item}
            onPress={() => router.push(`/announcements/${item.id}` as any)}
            index={index}
          />
        )}
        contentContainerStyle={[styles.modernFeed, { paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={true}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.modernEmpty}>
            <View style={styles.emptyIconWrapper}>
              <Crown size={56} color={Colors.gold} />
            </View>
            <Text style={styles.emptyTitle}>No Updates Yet</Text>
            <Text style={styles.emptyText}>Stay tuned for premium content</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Container & Layout
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  
  // Modern Header
  modernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    padding: 8,
  },
  backBtnBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  modernFeed: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 20,
  },
  modernEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  
  // Card Container
  cardContainer: {
    marginHorizontal: 4,
    marginBottom: 24,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: Colors.card,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  cardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.gold,
    opacity: 0.3,
  },
  
  // Media Section - Facebook Style
  mediaContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.cardDark,
  },
  mediaGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  multiMediaIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  multiMediaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  multiMediaText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.goldMuted,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Content Container
  contentContainer: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    backgroundColor: Colors.goldMuted,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorInfo: {
    gap: 2,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  moreButton: {
    padding: 4,
  },
  moreButtonBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
    fontWeight: '500',
  },
  
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIconBg: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(231,76,60,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.cardLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderColor: 'rgba(231,76,60,0.3)',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
    position: 'relative',
  },
  emptyGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    zIndex: 2,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    position: 'relative',
    zIndex: 2,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  emptyFooter: {
    flexDirection: 'row',
    gap: 24,
    position: 'relative',
    zIndex: 2,
  },
  emptyFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyFooterText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
