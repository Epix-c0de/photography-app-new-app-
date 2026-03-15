import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Share,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, X, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/supabase';
import { Image } from 'expo-image';
import FeedPostCard, { FeedPost } from '@/components/FeedPostCard';

type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];

interface AnnouncementWithSocial extends AnnouncementRow {
  isLiked: boolean;
  likesCount: number;
  commentsCount: number;
  isBookmarked: boolean;
}

interface AnnouncementComment {
  id: string;
  user_name: string;
  user_avatar?: string;
  comment: string;
  created_at: string;
}

export default function AnnouncementsFeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState<AnnouncementWithSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Comment sheet state
  const [commentSheetPost, setCommentSheetPost] = useState<AnnouncementWithSocial | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  // Track which cards are visible for video auto-play
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const ids = new Set<string>(
        viewableItems
          .filter((v) => v.isViewable)
          .map((v) => v.item?.id as string)
          .filter(Boolean)
      );
      setVisibleIds(ids);
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const fetchAnnouncements = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const withSocial = await Promise.all(
        (data || []).map(async (ann) => {
          const [likeRow, bookmarkRow, likesCount, commentsCount] = await Promise.allSettled([
            supabase
              .from('announcement_likes')
              .select('id')
              .eq('announcement_id', ann.id)
              .eq('user_id', user?.id ?? '')
              .maybeSingle(),
            supabase
              .from('announcement_bookmarks')
              .select('id')
              .eq('announcement_id', ann.id)
              .eq('user_id', user?.id ?? '')
              .maybeSingle(),
            supabase
              .from('announcement_likes')
              .select('*', { count: 'exact', head: true })
              .eq('announcement_id', ann.id),
            supabase
              .from('announcement_comments')
              .select('*', { count: 'exact', head: true })
              .eq('announcement_id', ann.id),
          ]);

          return {
            ...ann,
            isLiked: likeRow.status === 'fulfilled' && !!likeRow.value.data,
            likesCount:
              likesCount.status === 'fulfilled'
                ? (likesCount.value.count ?? 0)
                : 0,
            commentsCount:
              commentsCount.status === 'fulfilled'
                ? (commentsCount.value.count ?? 0)
                : 0,
            isBookmarked:
              bookmarkRow.status === 'fulfilled' && !!bookmarkRow.value.data,
          } as AnnouncementWithSocial;
        })
      );

      setAnnouncements(withSocial);
    } catch (err) {
      console.error('[Announcements] Fetch error:', err);
      Alert.alert('Error', 'Failed to load announcements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // ── Social actions ──────────────────────────────────────────────

  const handleLike = async (ann: AnnouncementWithSocial) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to like posts');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic update
    setAnnouncements((prev) =>
      prev.map((a) =>
        a.id === ann.id
          ? {
              ...a,
              isLiked: !a.isLiked,
              likesCount: a.isLiked ? a.likesCount - 1 : a.likesCount + 1,
            }
          : a
      )
    );

    try {
      if (ann.isLiked) {
        await supabase
          .from('announcement_likes')
          .delete()
          .eq('announcement_id', ann.id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('announcement_likes')
          .insert({ announcement_id: ann.id, user_id: user.id });
      }
    } catch {
      // Revert on failure
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === ann.id
            ? {
                ...a,
                isLiked: ann.isLiked,
                likesCount: ann.likesCount,
              }
            : a
        )
      );
    }
  };

  const handleBookmark = async (ann: AnnouncementWithSocial) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to bookmark posts');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setAnnouncements((prev) =>
      prev.map((a) =>
        a.id === ann.id ? { ...a, isBookmarked: !a.isBookmarked } : a
      )
    );

    try {
      if (ann.isBookmarked) {
        await supabase
          .from('announcement_bookmarks')
          .delete()
          .eq('announcement_id', ann.id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('announcement_bookmarks')
          .insert({ announcement_id: ann.id, user_id: user.id });
      }
    } catch {
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === ann.id ? { ...a, isBookmarked: ann.isBookmarked } : a
        )
      );
    }
  };

  const handleShare = async (ann: AnnouncementWithSocial) => {
    try {
      await Share.share({
        message: `${ann.title || 'Check this out!'}\n\n${ann.description || ''}`,
        title: ann.title || 'Announcement',
      });
    } catch {
      // silent
    }
  };

  const fetchComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('announcement_comments')
        .select(`*, user_profiles:client_id (name, avatar_url)`)
        .eq('announcement_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: AnnouncementComment[] = (data || []).map((c: any) => ({
        id: c.id,
        user_name: c.user_profiles?.name || 'User',
        user_avatar: c.user_profiles?.avatar_url,
        comment: c.comment,
        created_at: c.created_at,
      }));
      setComments(mapped);
    } catch (err) {
      console.error('[Announcements] Comments error:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleComment = (ann: AnnouncementWithSocial) => {
    setCommentSheetPost(ann);
    setCommentText('');
    fetchComments(ann.id);
  };

  const submitComment = async () => {
    if (!user || !commentSheetPost || !commentText.trim()) return;
    setPostingComment(true);
    try {
      await supabase.from('announcement_comments').insert({
        announcement_id: commentSheetPost.id,
        client_id: user.id,
        comment: commentText.trim(),
      });

      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === commentSheetPost.id
            ? { ...a, commentsCount: a.commentsCount + 1 }
            : a
        )
      );

      setCommentText('');
      fetchComments(commentSheetPost.id);
      setCommentSheetPost(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  const toFeedPost = (ann: AnnouncementWithSocial): FeedPost => ({
    id: ann.id,
    title: ann.title,
    description: ann.description,
    content_html: ann.content_html,
    media_type: ann.media_type as 'image' | 'video' | null,
    media_url: ann.media_url,
    image_url: ann.image_url,
    video_thumbnail_url: (ann as any).video_thumbnail_url ?? null,
    media_aspect_ratio: (ann as any).media_aspect_ratio ?? null,
    created_at: ann.created_at,
    tag: ann.tag,
    is_admin_badge: true,
  });

  const renderItem = ({ item }: { item: AnnouncementWithSocial }) => (
    <FeedPostCard
      post={toFeedPost(item)}
      postType="announcement"
      isVisible={visibleIds.has(item.id)}
      isLiked={item.isLiked}
      isBookmarked={item.isBookmarked}
      likesCount={item.likesCount}
      commentsCount={item.commentsCount}
      onLike={() => handleLike(item)}
      onComment={() => handleComment(item)}
      onBookmark={() => handleBookmark(item)}
      onShare={() => handleShare(item)}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcements</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No announcements yet</Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedContainer}
          showsVerticalScrollIndicator={false}
          onRefresh={() => fetchAnnouncements(true)}
          refreshing={refreshing}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}

      {/* ── Comment Sheet ── */}
      <Modal
        visible={!!commentSheetPost}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentSheetPost(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.commentSheet, { height: '70%', paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.commentSheetHeader}>
              <Text style={styles.commentSheetTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentSheetPost(null)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={comments}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16, gap: 16 }}
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  {item.user_avatar ? (
                    <Image source={{ uri: item.user_avatar }} style={styles.commentAvatar} />
                  ) : (
                    <View style={styles.commentAvatarPlaceholder}>
                      <Text style={styles.avatarInitial}>{item.user_name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.commentBody}>
                    <Text style={styles.commentName}>{item.user_name}</Text>
                    <Text style={styles.commentText}>{item.comment}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                loadingComments ? (
                  <ActivityIndicator style={{ marginTop: 40 }} color={Colors.gold} />
                ) : (
                  <Text style={styles.emptyComments}>No comments yet. Start the conversation!</Text>
                )
              }
            />

            <View style={styles.inputArea}>
              <TextInput
                style={styles.textInput}
                placeholder="Say something nice…"
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                onPress={submitComment}
                disabled={!commentText.trim() || postingComment}
                style={[styles.sendBtn, !commentText.trim() && { opacity: 0.5 }]}
              >
                {postingComment ? (
                  <ActivityIndicator size="small" color={Colors.gold} />
                ) : (
                  <Send size={24} color={Colors.gold} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  feedContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 32,
  },

  // Comment sheet
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  commentSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 14,
  },
  commentSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.inputBg,
  },
  commentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.background,
  },
  commentRow: { flexDirection: 'row', gap: 12 },
  commentAvatar: { width: 38, height: 38, borderRadius: 19 },
  commentAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { color: Colors.gold, fontWeight: '700', fontSize: 16 },
  commentBody: { flex: 1, gap: 2 },
  commentName: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  commentText: { fontSize: 14, color: Colors.text, lineHeight: 19 },
  emptyComments: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 15 },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    color: Colors.text,
    maxHeight: 100,
  },
  sendBtn: { padding: 4 },
});
