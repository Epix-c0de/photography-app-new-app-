/**
 * FeedPostCard — Facebook/LinkedIn-style social feed card.
 *
 * Features:
 *  - Header: Avatar, author name (bold), relative timestamp, 3-dot options menu
 *  - Body: Full text with "See more / See less" collapsing after 4 lines
 *  - Uncropped media: width: 100%, aspect ratio from payload, max-height: 85vh equivalent
 *  - Action bar: Like | Comment | Share | Bookmark  (evenly distributed)
 *  - Dark theme matching app palette (#1A1A1A card on #0A0A0A feed)
 *
 * Props:
 *  post         — the data object (announcements or BTS row)
 *  postType     — 'announcement' | 'bts'
 *  isVisible    — driven by FlatList viewability (passed down to FeedVideoPlayer)
 *  isLiked      — current like state
 *  isBookmarked — current bookmark state
 *  likesCount   — number of likes
 *  commentsCount— number of comments
 *  onLike       — callback
 *  onComment    — callback
 *  onBookmark   — callback
 *  onShare      — callback
 *  onOptions    — 3-dot press callback
 *  onCardPress  — optional, wraps entire card (for admin navigation)
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  ShieldCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import FeedVideoPlayer from './FeedVideoPlayer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_MEDIA_HEIGHT = SCREEN_HEIGHT * 0.85;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface FeedPost {
  id: string;
  title?: string | null;
  description?: string | null;
  content_html?: string | null;
  media_type?: 'image' | 'video' | null;
  media_url?: string | null;
  image_url?: string | null;
  video_thumbnail_url?: string | null;
  media_aspect_ratio?: number | null;
  created_at: string;
  tag?: string | null;
  shoot_type?: string | null;
  // Author data (optional, falls back to "Studio")
  author_name?: string | null;
  author_avatar?: string | null;
  is_admin_badge?: boolean;
}

interface FeedPostCardProps {
  post: FeedPost;
  postType: 'announcement' | 'bts';
  isVisible: boolean;
  isLiked: boolean;
  isBookmarked: boolean;
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  viewsCount?: number;
  onLike: () => void;
  onComment: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onOptions?: () => void;
  onCardPress?: () => void;
}

export default function FeedPostCard({
  post,
  postType,
  isVisible,
  isLiked,
  isBookmarked,
  likesCount,
  commentsCount,
  sharesCount = 0,
  viewsCount,
  onLike,
  onComment,
  onBookmark,
  onShare,
  onOptions,
  onCardPress,
}: FeedPostCardProps) {
  const [expanded, setExpanded] = useState(false);

  const authorName = post.author_name || 'Photography Studio';
  const authorAvatar = post.author_avatar || null;
  const bodyText = post.description || post.content_html || post.title || '';
  const tag = post.tag || post.shoot_type;

  // Media
  const hasMedia = !!(post.media_url || post.image_url);
  const isVideo = post.media_type === 'video';
  const mediaUri = post.media_url || post.image_url || '';
  const posterUri = post.video_thumbnail_url || post.image_url || null;
  const aspectRatio = post.media_aspect_ratio || (isVideo ? 16 / 9 : undefined);

  // Image dynamic height: use aspect ratio to pre-allocate, clamp to MAX_MEDIA_HEIGHT
  const imageStyle = aspectRatio
    ? { width: '100%' as const, aspectRatio, maxHeight: MAX_MEDIA_HEIGHT }
    : { width: '100%' as const, minHeight: 220, maxHeight: MAX_MEDIA_HEIGHT };

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike();
  };

  const handleBookmark = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBookmark();
  };

  const CardWrapper = onCardPress ? Pressable : View;

  return (
    <CardWrapper
      style={styles.card}
      onPress={onCardPress}
    >
      {/* ── HEADER ── */}
      <View style={styles.header}>
        {/* Avatar */}
        <View style={styles.avatar}>
          {authorAvatar ? (
            <Image
              source={{ uri: authorAvatar }}
              style={styles.avatarImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{authorName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Name + time */}
        <View style={styles.headerMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.authorName}>{authorName}</Text>
            {post.is_admin_badge && (
              <View style={styles.adminBadge}>
                <ShieldCheck size={11} color={Colors.gold} />
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>
          {tag && <Text style={styles.tagText}>{tag}</Text>}
          <Text style={styles.timestamp}>{relativeTime(post.created_at)}</Text>
        </View>

        {/* 3-dot menu */}
        {onOptions && (
          <Pressable onPress={onOptions} style={styles.moreButton} hitSlop={10}>
            <MoreHorizontal size={20} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* ── TITLE ── */}
      {post.title && (
        <Text style={styles.title}>{post.title}</Text>
      )}

      {/* ── BODY TEXT with See More ── */}
      {bodyText !== post.title && bodyText.trim() !== '' && (
        <View style={styles.bodyContainer}>
          <Text
            style={styles.bodyText}
            numberOfLines={expanded ? undefined : 4}
          >
            {bodyText}
          </Text>
          {bodyText.length > 200 && (
            <Pressable onPress={() => setExpanded(!expanded)}>
              <Text style={styles.seeMore}>
                {expanded ? 'See less' : 'See more…'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* ── MEDIA ── */}
      {hasMedia && (
        <View style={styles.mediaWrapper}>
          {isVideo ? (
            <FeedVideoPlayer
              uri={mediaUri}
              posterUri={posterUri}
              isVisible={isVisible}
              aspectRatio={aspectRatio}
            />
          ) : (
            <Image
              source={{ uri: mediaUri }}
              style={imageStyle}
              contentFit="contain"
              transition={200}
            />
          )}
        </View>
      )}

      {/* ── ACTION BAR ── */}
      <View style={styles.actionBar}>
        {/* Like */}
        <Pressable style={styles.actionBtn} onPress={handleLike}>
          <Heart
            size={20}
            color={isLiked ? Colors.error : Colors.textSecondary}
            fill={isLiked ? Colors.error : 'transparent'}
          />
          <Text style={[styles.actionLabel, isLiked && styles.actionLabelActive]}>
            {likesCount > 0 ? likesCount : 'Like'}
          </Text>
        </Pressable>

        {/* Comment */}
        <Pressable style={styles.actionBtn} onPress={onComment}>
          <MessageCircle size={20} color={Colors.textSecondary} />
          <Text style={styles.actionLabel}>
            {commentsCount > 0 ? commentsCount : 'Comment'}
          </Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.actionBtn} onPress={onShare}>
          <Share2 size={20} color={Colors.textSecondary} />
          <Text style={styles.actionLabel}>
            {sharesCount > 0 ? sharesCount : 'Share'}
          </Text>
        </Pressable>

        {/* Bookmark */}
        <Pressable style={styles.actionBtn} onPress={handleBookmark}>
          <Bookmark
            size={20}
            color={isBookmarked ? Colors.gold : Colors.textSecondary}
            fill={isBookmarked ? Colors.gold : 'transparent'}
          />
          <Text style={[styles.actionLabel, isBookmarked && styles.actionLabelBookmark]}>
            Save
          </Text>
        </Pressable>
      </View>
    </CardWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.goldMuted,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: Colors.gold,
    fontSize: 17,
    fontWeight: '700',
  },
  headerMeta: {
    flex: 1,
    gap: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.goldMuted,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gold,
  },
  tagText: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  moreButton: {
    padding: 6,
  },

  // Title
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 14,
    marginBottom: 4,
    lineHeight: 22,
  },

  // Body
  bodyContainer: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 4,
  },
  bodyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  seeMore: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '600',
    marginTop: 2,
  },

  // Media
  mediaWrapper: {
    width: '100%',
    backgroundColor: Colors.cardDark,
    overflow: 'hidden',
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  actionLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  actionLabelActive: {
    color: Colors.error,
  },
  actionLabelBookmark: {
    color: Colors.gold,
  },
});
