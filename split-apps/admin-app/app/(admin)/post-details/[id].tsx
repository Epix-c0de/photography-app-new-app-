import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  RefreshControl,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ChevronLeft,
  Send,
  ShieldCheck,
  Play,
  Trash2,
  RefreshCw,
  TrendingUp,
  Clock,
  Users,
  Zap,
  ExternalLink,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type PostType = 'bts' | 'announcement' | 'portfolio';

interface PostStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
}

interface Comment {
  id: string;
  user_id?: string;
  user_name: string;
  user_avatar?: string;
  comment: string;
  created_at: string;
  is_admin_reply?: boolean;
  parent_comment_id?: string | null;
  replies?: Comment[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STAT_CONFIGS = [
  { key: 'views', icon: Eye, label: 'Views', color: '#60A5FA' },
  { key: 'likes', icon: Heart, label: 'Likes', color: Colors.error },
  { key: 'comments', icon: MessageCircle, label: 'Comments', color: Colors.gold },
  { key: 'shares', icon: Share2, label: 'Shares', color: '#A78BFA' },
  { key: 'bookmarks', icon: Bookmark, label: 'Saved', color: '#34D399' },
] as const;

export default function PostDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const postType = (type as PostType) || 'announcement';

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any>(null);
  const [stats, setStats] = useState<PostStats>({ views: 0, likes: 0, comments: 0, shares: 0, bookmarks: 0 });
  const [comments, setComments] = useState<Comment[]>([]);
  const [likesUsers, setLikesUsers] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const [activeSection, setActiveSection] = useState<'likes' | 'comments' | 'views' | 'shares' | 'saved' | null>('likes');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [engagementRate, setEngagementRate] = useState(0);
  const videoRef = useRef<Video>(null);

  const tableMap: Record<PostType, string> = {
    bts: 'bts_posts',
    announcement: 'announcements',
    portfolio: 'portfolio_items',
  };

  const commentTableMap: Record<PostType, string> = {
    bts: 'bts_comments',
    announcement: 'announcement_comments',
    portfolio: 'portfolio_comments',
  };

  const idFieldMap: Record<PostType, string> = {
    bts: 'bts_id',
    announcement: 'announcement_id',
    portfolio: 'portfolio_item_id',
  };

  const likeTableMap: Record<PostType, string> = {
    bts: 'bts_likes',
    announcement: 'announcement_likes',
    portfolio: 'portfolio_likes',
  };

  const bookmarkTableMap: Record<PostType, string> = {
    bts: 'bts_bookmarks',
    announcement: 'announcement_bookmarks',
    portfolio: 'portfolio_bookmarks',
  };

  const likeIdFieldMap: Record<PostType, string> = {
    bts: 'bts_id',
    announcement: 'announcement_id',
    portfolio: 'portfolio_item_id',
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadPost(), loadStats(), loadComments(), loadLikesUsers()]);
      // Increment views count on load, then refresh stats
      try {
        await supabase.rpc('increment_views', { row_id: id, table_name: tableMap[postType] });
        await loadStats();
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  }, [id, postType]);

  useEffect(() => {
    if (!id || !type) { router.back(); return; }
    loadAll();
  }, [id, type]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // Real-time subscription for live updates
  useEffect(() => {
    if (!id || !type) return;
    const channel = supabase
      .channel(`post_details_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: likeTableMap[postType], filter: `${likeIdFieldMap[postType]}=eq.${id}` }, () => loadStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: commentTableMap[postType], filter: `${idFieldMap[postType]}=eq.${id}` }, () => { loadStats(); loadComments(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: bookmarkTableMap[postType], filter: `${likeIdFieldMap[postType]}=eq.${id}` }, () => loadStats())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, postType]);

  const loadPost = async () => {
    const { data, error } = await supabase
      .from(tableMap[postType])
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    setPost(data);
  };

  const loadStats = async () => {
    try {
      const likeField = likeIdFieldMap[postType];
      const bookmarkField = likeIdFieldMap[postType];

      const [likesRes, commentsRes, bookmarksRes, postRes] = await Promise.allSettled([
        supabase
          .from(likeTableMap[postType])
          .select('*', { count: 'exact', head: true })
          .eq(likeField, id),
        supabase
          .from(commentTableMap[postType])
          .select('*', { count: 'exact', head: true })
          .eq(idFieldMap[postType], id),
        supabase
          .from(bookmarkTableMap[postType])
          .select('*', { count: 'exact', head: true })
          .eq(bookmarkField, id),
        supabase
          .from(tableMap[postType])
          .select('views_count, shares_count')
          .eq('id', id)
          .single(),
      ]);

      const views = postRes.status === 'fulfilled' ? ((postRes.value.data as any)?.views_count || 0) : (post?.views_count || 0);
      const likes = likesRes.status === 'fulfilled' ? (likesRes.value.count ?? 0) : 0;
      const comments = commentsRes.status === 'fulfilled' ? (commentsRes.value.count ?? 0) : 0;
      const shares = postRes.status === 'fulfilled' ? ((postRes.value.data as any)?.shares_count || 0) : (post?.shares_count || 0);
      const bookmarks = bookmarksRes.status === 'fulfilled' ? (bookmarksRes.value.count ?? 0) : 0;

      setStats({ views, likes, comments, shares, bookmarks });

      if (views > 0) {
        const engagement = ((likes + comments + shares + bookmarks) / views) * 100;
        setEngagementRate(Math.round(engagement * 10) / 10);
      }
    } catch (e) {
      console.error('[Stats]', e);
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from(commentTableMap[postType])
        .select(`*, user_profiles:user_id (name, avatar_url, role)`)
        .eq(idFieldMap[postType], id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const flat: Comment[] = (data || []).map((c: any) => ({
        id: c.id,
        user_id: c.user_id || c.client_id,
        user_name: c.user_profiles?.name || 'User',
        user_avatar: c.user_profiles?.avatar_url,
        comment: c.comment,
        created_at: c.created_at,
        is_admin_reply: c.is_admin_reply ?? false,
        parent_comment_id: c.parent_comment_id ?? null,
      }));

      setComments(flat);
    } catch (e) {
      console.error('[Comments]', e);
    } finally {
      setLoadingComments(false);
    }
  };

  const loadLikesUsers = async () => {
    try {
      const likeField = likeIdFieldMap[postType];
      const { data, error } = await supabase
        .from(likeTableMap[postType])
        .select(`*, user_profiles:user_id (name, avatar_url)`)
        .eq(likeField, id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLikesUsers(
        (data || []).map((r: any) => ({
          id: r.user_id || r.client_id,
          name: r.user_profiles?.name || 'User',
          avatar: r.user_profiles?.avatar_url || null,
        }))
      );
    } catch (e) {
      console.error('[Likes]', e);
    }
  };

  useEffect(() => {
    const likeField = likeIdFieldMap[postType];
    const likeChannel = supabase
      .channel(`post_likes_${postType}_${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: likeTableMap[postType],
        filter: `${likeField}=eq.${id}`,
      }, async () => {
        await loadLikesUsers();
        await loadStats();
      })
      .subscribe();

    const commentChannel = supabase
      .channel(`post_comments_${postType}_${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: commentTableMap[postType],
        filter: `${idFieldMap[postType]}=eq.${id}`,
      }, async () => {
        await loadComments();
        await loadStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(likeChannel);
      supabase.removeChannel(commentChannel);
    };
  }, [id, postType]);

  const handleAdminReply = async (parentCommentId?: string) => {
    if (!user || !replyText.trim()) return;
    setPostingReply(true);
    try {
      const payload: Record<string, any> = {
        [idFieldMap[postType]]: id,
        user_id: user.id,
        comment: replyText.trim(),
        is_admin_reply: true,
        parent_comment_id: parentCommentId || null,
      };

      const { error } = await supabase.from(commentTableMap[postType]).insert(payload);
      if (error) throw error;

      setReplyText('');
      setReplyingToId(null);
      await loadComments();
      await loadStats();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to post reply');
    } finally {
      setPostingReply(false);
    }
  };

  const handleDeletePost = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from(tableMap[postType])
                .delete()
                .eq('id', id);
              if (error) throw error;
              Alert.alert('Success', 'Post deleted successfully');
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete post');
            }
          }
        }
      ]
    );
  };

  // ── Render helpers ────────────────────────────────────────────

  const renderStatCard = ({ key, icon: Icon, label, color }: typeof STAT_CONFIGS[number]) => (
    <Pressable 
      key={key} 
      style={[
        styles.statCard, 
        activeSection === key && { borderColor: color, backgroundColor: color + '11' }
      ]}
      onPress={() => setActiveSection(key as any)}
    >
      <View style={[styles.statIconWrapper, { backgroundColor: color + '22' }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{stats[key].toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );

  const renderComment = ({ item }: { item: Comment }) => {
    const isAdminReply = item.is_admin_reply;
    const isReplying = replyingToId === item.id;

    return (
      <View style={[styles.commentCard, isAdminReply && styles.adminReplyCard]}>
        {/* Comment row */}
        <View style={styles.commentRow}>
          <View style={styles.commentAvatarWrapper}>
            {item.user_avatar ? (
              <Image source={{ uri: item.user_avatar }} style={styles.commentAvatar} />
            ) : (
              <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder]}>
                <Text style={styles.commentAvatarInitial}>
                  {item.user_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.commentBody}>
            <View style={styles.commentNameRow}>
              <Text style={styles.commentName}>{item.user_name}</Text>
              {isAdminReply && (
                <View style={styles.adminCommentBadge}>
                  <ShieldCheck size={10} color={Colors.gold} />
                  <Text style={styles.adminCommentBadgeText}>Admin</Text>
                </View>
              )}
              <Text style={styles.commentTime}>{relativeTime(item.created_at)}</Text>
            </View>
            <Text style={styles.commentText}>{item.comment}</Text>

            {/* Reply button for top-level comments */}
            {!item.parent_comment_id && (
              <Pressable onPress={() => setReplyingToId(isReplying ? null : item.id)}>
                <Text style={styles.replyTrigger}>
                  {isReplying ? 'Cancel' : '↩ Admin Reply'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Inline Admin Reply Input */}
        {isReplying && (
          <View style={styles.replyInputRow}>
            <TextInput
              style={styles.replyInput}
              placeholder="Type your admin reply…"
              placeholderTextColor={Colors.textMuted}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              autoFocus
            />
            <Pressable
              style={[styles.replySendBtn, !replyText.trim() && styles.replySendBtnDisabled]}
              onPress={() => handleAdminReply(item.id)}
              disabled={!replyText.trim() || postingReply}
            >
              {postingReply ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Send size={16} color={Colors.background} />
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingText}>Loading post…</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.centered]}>
        <Text style={styles.errorText}>Post not found</Text>
      </View>
    );
  }

  const mediaUri = post.media_url || post.image_url || '';
  const isVideo = post.media_type === 'video';
  const posterUri = post.video_thumbnail_url || post.image_url || null;
  const aspectRatio = post.media_aspect_ratio || (isVideo ? 16 / 9 : undefined);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Premium Header ── */}
      <LinearGradient
        colors={[Colors.card, Colors.background]}
        style={styles.pageHeader}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.pageTitle}>Post Details</Text>
          <Text style={styles.headerSubtitle}>{postType.charAt(0).toUpperCase() + postType.slice(1)}</Text>
        </View>
        <Pressable onPress={handleDeletePost} style={styles.deleteBtn}>
          <Trash2 size={18} color={Colors.error} />
        </Pressable>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        >

          {/* ══ SECTION A: Master Post ══ */}
          <View style={styles.masterPost}>
            {/* Media */}
            {mediaUri ? (
              <View style={[styles.mediaBox, aspectRatio ? { aspectRatio } : { minHeight: 280 }]}>
                {isVideo ? (
                  <>
                    <Video
                      ref={videoRef}
                      source={{ uri: mediaUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={isVideoPlaying}
                      useNativeControls
                      posterSource={posterUri ? { uri: posterUri } : undefined}
                      usePoster={!!posterUri}
                      onPlaybackStatusUpdate={(s) => {
                        if (s.isLoaded) setIsVideoPlaying(s.isPlaying);
                      }}
                    />
                    {!isVideoPlaying && (
                      <Pressable
                        style={styles.playOverlay}
                        onPress={() => videoRef.current?.playAsync()}
                      >
                        <View style={styles.playBtn}>
                          <Play size={28} color={Colors.white} fill={Colors.white} />
                        </View>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <Image
                    source={{ uri: mediaUri }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                )}
              </View>
            ) : null}

            {/* Post info */}
            <View style={styles.postInfo}>
              {post.title && <Text style={styles.postTitle}>{post.title}</Text>}
              {post.description && (
                <Text style={styles.postDescription}>{post.description}</Text>
              )}
              <View style={styles.postMeta}>
                <Clock size={12} color={Colors.textMuted} />
                <Text style={styles.postDate}>
                  {new Date(post.created_at).toLocaleDateString('en-US', {
                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </Text>
                {(post.tag || post.shoot_type) && (
                  <View style={styles.tagChip}>
                    <Zap size={10} color={Colors.gold} />
                    <Text style={styles.tagChipText}>{post.tag || post.shoot_type}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ══ SECTION B: Analytics Grid ══ */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <TrendingUp size={14} color={Colors.gold} />
                </View>
                <Text style={styles.sectionTitle}>Analytics</Text>
              </View>
              {engagementRate > 0 && (
                <View style={styles.engagementBadge}>
                  <Text style={styles.engagementText}>{engagementRate}%</Text>
                </View>
              )}
            </View>
            <View style={styles.statsGrid}>
              {STAT_CONFIGS.map(renderStatCard)}
            </View>
          </View>

          {/* ══ SECTION B1.5: Post Metadata ══ */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Eye size={14} color={Colors.gold} />
              </View>
              <Text style={styles.sectionTitle}>Overview</Text>
            </View>
            <View style={styles.metadataCard}>
              <View style={styles.metadataItem}>
                <Clock size={14} color={Colors.textMuted} />
                <Text style={styles.metadataLabel}>Posted</Text>
                <Text style={styles.metadataValue}>{relativeTime(post.created_at)}</Text>
              </View>
              <View style={styles.metadataDivider} />
              <View style={styles.metadataItem}>
                <Eye size={14} color={Colors.textMuted} />
                <Text style={styles.metadataLabel}>Views</Text>
                <Text style={styles.metadataValue}>{stats.views.toLocaleString()}</Text>
              </View>
              <View style={styles.metadataDivider} />
              <View style={styles.metadataItem}>
                <Users size={14} color={Colors.textMuted} />
                <Text style={styles.metadataLabel}>Engagement</Text>
                <Text style={[styles.metadataValue, { color: engagementRate > 5 ? '#34D399' : engagementRate > 0 ? Colors.gold : Colors.textMuted }]}>
                  {engagementRate}%
                </Text>
              </View>
              <View style={styles.metadataDivider} />
              <View style={styles.metadataItem}>
                <TrendingUp size={14} color={Colors.textMuted} />
                <Text style={styles.metadataLabel}>Reach</Text>
                <Text style={styles.metadataValue}>{(stats.likes + stats.comments + stats.shares).toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* ══ SECTION B2: Dynamic Detail Section ══ */}
          {activeSection === 'likes' && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <Heart size={14} color={Colors.error} />
                </View>
                <Text style={styles.sectionTitle}>Likes ({stats.likes})</Text>
              </View>
              {likesUsers.length === 0 ? (
                <View style={styles.emptyDetailCard}>
                  <Heart size={24} color={Colors.textMuted} />
                  <Text style={styles.emptyDetailText}>No likes yet</Text>
                </View>
              ) : (
                <View style={styles.likesList}>
                  {likesUsers.map(u => (
                    <View key={u.id} style={styles.likeRow}>
                      {u.avatar ? (
                        <Image source={{ uri: u.avatar }} style={styles.likeAvatar} />
                      ) : (
                        <View style={[styles.likeAvatar, styles.likeAvatarPlaceholder]}>
                          <Text style={styles.likeAvatarInitial}>{u.name.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={styles.likeName}>{u.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeSection === 'comments' && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <MessageCircle size={14} color={Colors.gold} />
                </View>
                <Text style={styles.sectionTitle}>Comments ({stats.comments})</Text>
              </View>

              {/* Global admin reply input */}
              <View style={styles.globalReplyContainer}>
                <TextInput
                  style={styles.globalReplyInput}
                  placeholder="Post an admin reply to the community..."
                  placeholderTextColor={Colors.textMuted}
                  value={replyingToId === '__global__' ? replyText : ''}
                  onChangeText={setReplyText}
                  onFocus={() => setReplyingToId('__global__')}
                  multiline
                />
                <Pressable
                  style={[
                    styles.globalReplyBtn,
                    (!replyText.trim() || replyingToId !== '__global__') && styles.replySendBtnDisabled,
                  ]}
                  onPress={() => {
                    if (replyingToId === '__global__') handleAdminReply(undefined);
                  }}
                  disabled={!replyText.trim() || postingReply || replyingToId !== '__global__'}
                >
                  {postingReply && replyingToId === '__global__' ? (
                    <ActivityIndicator size="small" color={Colors.background} />
                  ) : (
                    <>
                      <ShieldCheck size={14} color={Colors.background} />
                      <Text style={styles.globalReplyBtnText}>Post as Admin</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {loadingComments ? (
                <ActivityIndicator style={{ marginTop: 20 }} color={Colors.gold} />
              ) : comments.length === 0 ? (
                <View style={styles.emptyDetailCard}>
                  <MessageCircle size={24} color={Colors.textMuted} />
                  <Text style={styles.emptyDetailText}>No comments yet</Text>
                </View>
              ) : (
                <FlatList
                  data={comments}
                  keyExtractor={(c) => c.id}
                  renderItem={renderComment}
                  scrollEnabled={false}
                  contentContainerStyle={{ gap: 10 }}
                />
              )}
            </View>
          )}
          
          {['views', 'shares', 'bookmarks'].includes(activeSection as string) && (
             <View style={styles.section}>
               <View style={styles.emptyDetailCard}>
                 <ExternalLink size={24} color={Colors.textMuted} />
                 <Text style={styles.emptyDetailText}>Detailed tracking coming soon</Text>
               </View>
             </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  errorText: { color: Colors.textSecondary, fontSize: 16 },

  // Header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { alignItems: 'center' },
  pageTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  headerSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Master Post
  masterPost: {
    backgroundColor: Colors.card,
    marginHorizontal: 12,
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  mediaBox: {
    width: '100%',
    backgroundColor: '#0A0A12',
    overflow: 'hidden',
    position: 'relative',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212,175,55,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  postInfo: { padding: 16, gap: 8 },
  postTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, lineHeight: 28, letterSpacing: -0.3 },
  postDescription: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  postDate: { fontSize: 12, color: Colors.textMuted, flex: 1 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagChipText: { fontSize: 11, fontWeight: '700', color: Colors.gold },

  // Section
  section: { paddingHorizontal: 12, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, letterSpacing: -0.2 },
  engagementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  engagementText: { fontSize: 12, fontWeight: '800', color: Colors.gold },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },

  // Metadata Card
  metadataCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metadataDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 36,
  },
  metadataLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '500', flex: 1 },
  metadataValue: { fontSize: 13, color: Colors.text, fontWeight: '700' },

  // Likes
  likesList: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    gap: 8,
  },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  likeAvatar: { width: 32, height: 32, borderRadius: 16 },
  likeAvatarPlaceholder: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeAvatarInitial: { color: Colors.gold, fontSize: 13, fontWeight: '700' },
  likeName: { color: Colors.text, fontSize: 14, fontWeight: '600' },

  // Empty detail card
  emptyDetailCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyDetailText: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },

  // Comments
  globalReplyContainer: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    padding: 14,
    gap: 10,
    marginBottom: 14,
  },
  globalReplyInput: {
    fontSize: 14,
    color: Colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  globalReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Colors.gold,
    paddingVertical: 11,
    borderRadius: 10,
  },
  globalReplyBtnText: { fontSize: 13, fontWeight: '700', color: Colors.background },

  commentCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  adminReplyCard: {
    backgroundColor: 'rgba(212,175,55,0.05)',
    borderColor: 'rgba(212,175,55,0.2)',
  },
  commentRow: { flexDirection: 'row', gap: 10 },
  commentAvatarWrapper: { flexShrink: 0 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentAvatarPlaceholder: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarInitial: { color: Colors.gold, fontSize: 14, fontWeight: '700' },
  commentBody: { flex: 1, gap: 4 },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  commentName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  adminCommentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adminCommentBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.gold },
  commentTime: { fontSize: 11, color: Colors.textMuted },
  commentText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  replyTrigger: { fontSize: 12, color: Colors.gold, fontWeight: '700', marginTop: 6 },

  replyInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    alignItems: 'flex-end',
  },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    color: Colors.text,
    fontSize: 14,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  replySendBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replySendBtnDisabled: { opacity: 0.4 },
});
