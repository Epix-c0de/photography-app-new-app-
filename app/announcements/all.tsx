import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, FlatList, TextInput, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, MessageCircle, Heart, Share2, MoreVertical, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { ClientService } from '@/services/client';
import { useAuth } from '@/contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  content?: string;
  description?: string | null;
  content_html?: string | null;
  media_urls?: string[];
  image_url?: string | null;
  media_url?: string | null;
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

function AnnouncementCard({ announcement, onPress, onSeeAll }: { announcement: Announcement; onPress: () => void; onSeeAll?: () => void }) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [reactionCount, setReactionCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    // Check if user already liked
    const userReacted = announcement.announcement_reactions?.some(r => r.user_id === user?.id);
    setIsLiked(!!userReacted);
    setReactionCount(announcement.announcement_reactions?.length || 0);
    setCommentCount(announcement.announcement_comments?.length || 0);
  }, [announcement, user]);

  const handleReaction = useCallback(async () => {
    setIsLiking(true);
    try {
      await ClientService.announcements.addReaction(announcement.id, '👍');
      setIsLiked(!isLiked);
      setReactionCount(isLiked ? reactionCount - 1 : reactionCount + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.error('Failed to add reaction:', e);
    } finally {
      setIsLiking(false);
    }
  }, [announcement.id, isLiked, reactionCount]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {announcement.user_profiles?.avatar_url && (
            <Image
              source={{ uri: announcement.user_profiles.avatar_url }}
              style={styles.avatar}
              contentFit="cover"
            />
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.authorName}>{announcement.user_profiles?.name || 'Unknown'}</Text>
            <Text style={styles.timestamp}>{relativeTime(announcement.created_at)}</Text>
          </View>
        </View>
        <Pressable style={styles.headerButton}>
          <MoreVertical size={20} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* Content */}
      <Pressable onPress={onPress}>
        <Text style={styles.title}>{announcement.title}</Text>
        {announcement.description && (
          <Text style={styles.description} numberOfLines={3}>{announcement.description}</Text>
        )}
        
        {announcement.content && !announcement.description && (
          <Text style={styles.content} numberOfLines={4}>{announcement.content}</Text>
        )}

        {/* Media */}
        {announcement.media_urls && announcement.media_urls.length > 0 && (
          <Image
            source={{ uri: announcement.media_urls[0] }}
            style={styles.media}
            contentFit="cover"
          />
        )}
      </Pressable>

      {/* Reactions Display */}
      {reactionCount > 0 && (
        <View style={styles.reactionsDisplay}>
          <Text style={styles.reactionsText}>👍 {reactionCount}</Text>
        </View>
      )}

      {/* Footer Stats */}
      <View style={styles.stats}>
        <Text style={styles.statText}>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</Text>
        {reactionCount > 0 && <Text style={styles.statText}>{reactionCount} {reactionCount === 1 ? 'reaction' : 'reactions'}</Text>}
      </View>

      <View style={styles.divider} />

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, isLiked && styles.actionButtonActive]}
          onPress={handleReaction}
          disabled={isLiking}
        >
          <Heart
            size={18}
            color={isLiked ? Colors.error : Colors.textMuted}
            fill={isLiked ? Colors.error : 'none'}
          />
          <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>Like</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onPress}>
          <MessageCircle size={18} color={Colors.textMuted} />
          <Text style={styles.actionText}>Comment</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onPress}>
          <Share2 size={18} color={Colors.textMuted} />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
      </View>
    </View>
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

  if (loading && announcements.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Announcements</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Feed */}
      <FlatList
        data={announcements}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <AnnouncementCard
            announcement={item}
            onPress={() => router.push(`/announcements/${item.id}` as any)}
          />
        )}
        contentContainerStyle={styles.feed}
        scrollEnabled={true}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        ListFooterComponent={<View style={{ height: insets.bottom + 20 }} />}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={styles.emptyText}>No announcements yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  feed: {
    paddingVertical: 12,
  },
  card: {
    backgroundColor: Colors.card,
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerButton: {
    padding: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 12,
    marginTop: 8,
    lineHeight: 20,
  },
  content: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 12,
    marginTop: 8,
    lineHeight: 20,
  },
  media: {
    width: '100%',
    height: 200,
    marginTop: 12,
  },
  reactionsDisplay: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  reactionsText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 16,
  },
  statText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  actionButtonActive: {
    backgroundColor: Colors.error + '10',
    borderRadius: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  actionTextActive: {
    color: Colors.error,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
