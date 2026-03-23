import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Share,
  ViewToken,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  X,
  Send,
  ChevronLeft,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode, Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/supabase';

const { width, height } = Dimensions.get('window');

type BTSPostRow = Database['public']['Tables']['bts_posts']['Row'];

interface BTSWithSocial extends BTSPostRow {
  isLiked: boolean;
  likesCount: number;
  commentsCount: number;
  isBookmarked: boolean;
}

interface BTSComment {
  id: string;
  user_name: string;
  user_avatar?: string;
  comment: string;
  created_at: string;
}

export default function BTSViewerScreen() {
  const { id: initialId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [posts, setPosts] = useState<BTSWithSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Comment sheet state
  const [showComments, setShowComments] = useState<BTSWithSocial | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<BTSComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  // Paging state
  const [activeIndex, setActiveIndex] = useState(0);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchPosts = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('bts_posts')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const withSocial = await Promise.all(
        (data || []).map(async (p) => {
          const [likeRow, bookmarkRow, likesCount, commentsCount] = await Promise.allSettled([
            supabase
              .from('bts_likes')
              .select('id')
              .eq('bts_id', p.id)
              .eq('user_id', user?.id ?? '')
              .maybeSingle(),
            supabase
              .from('bts_bookmarks')
              .select('id')
              .eq('bts_id', p.id)
              .eq('user_id', user?.id ?? '')
              .maybeSingle(),
            supabase
              .from('bts_likes')
              .select('*', { count: 'exact', head: true })
              .eq('bts_id', p.id),
            supabase
              .from('bts_comments')
              .select('*', { count: 'exact', head: true })
              .eq('bts_id', p.id),
          ]);

          return {
            ...p,
            isLiked: likeRow.status === 'fulfilled' && !!likeRow.value.data,
            likesCount: likesCount.status === 'fulfilled' ? (likesCount.value.count ?? 0) : 0,
            commentsCount: commentsCount.status === 'fulfilled' ? (commentsCount.value.count ?? 0) : 0,
            isBookmarked: bookmarkRow.status === 'fulfilled' && !!bookmarkRow.value.data,
          } as BTSWithSocial;
        })
      );

      const visiblePosts = withSocial.filter((post) => {
        const notExpired = !post.expires_at || new Date(post.expires_at).getTime() > Date.now();
        const scheduleReached = !post.scheduled_for || new Date(post.scheduled_for).getTime() <= Date.now();
        return notExpired && scheduleReached;
      });

      setPosts(visiblePosts);

      if (visiblePosts.length === 0) {
        router.back();
        return;
      }

      if (initialId && visiblePosts.length > 0) {
        const idx = visiblePosts.findIndex(p => p.id === initialId);
        if (idx !== -1) {
          setActiveIndex(idx);
          setActivePostId(visiblePosts[idx].id);
        } else {
          setActivePostId(visiblePosts[0].id);
        }
      } else if (visiblePosts.length > 0) {
        setActivePostId(visiblePosts[0].id);
      }
    } catch (err) {
      console.error('[BTS] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, initialId, router]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    const timer = setInterval(() => fetchPosts(true), 30000);
    return () => clearInterval(timer);
  }, [fetchPosts]);

  // View tracking & Music
  useEffect(() => {
    if (!activePostId) return;

    // Increment View Count via RPC
    (supabase as any).rpc('increment_views', { row_id: activePostId, table_name: 'bts_posts' })
      .then(({ error }: any) => { if (error) console.error('[BTS] View tracking failed:', error); });

    const playMusic = async () => {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      const post = posts.find(p => p.id === activePostId);
      if (post && post.music_url) {
        try {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: post.music_url },
            { shouldPlay: true, isLooping: true, volume: 0.2, isMuted }
          );
          setSound(newSound);
        } catch (e) {
          console.log('[BTS] Music error:', e);
        }
      }
    };
    playMusic();

    return () => {
      if (sound) sound.unloadAsync();
    };
  }, [activePostId]);

  useEffect(() => {
    if (sound) {
      sound.setIsMutedAsync(isMuted);
    }
  }, [isMuted, sound]);

  // Clean up sound on unmount
  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, []);

  const fetchComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('bts_comments')
        .select(`*, user_profiles:client_id (name, avatar_url)`)
        .eq('bts_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: BTSComment[] = (data || []).map((c: any) => ({
        id: c.id,
        user_name: c.user_profiles?.name || 'User',
        user_avatar: c.user_profiles?.avatar_url,
        comment: c.comment,
        created_at: c.created_at,
      }));
      setComments(mapped);
    } catch (err) {
      console.error('[BTS] Comments error:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleLike = async (post: BTSWithSocial) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to like posts');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setPosts(prev => prev.map(p => p.id === post.id ? {
      ...p,
      isLiked: !p.isLiked,
      likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1,
    } : p));

    try {
      if (post.isLiked) {
        await supabase.from('bts_likes').delete().match({ bts_id: post.id, user_id: user.id });
      } else {
        await supabase.from('bts_likes').insert({ bts_id: post.id, user_id: user.id });
      }
    } catch {
      // Revert on error
      setPosts(prev => prev.map(p => p.id === post.id ? post : p));
    }
  };

  const submitComment = async () => {
    if (!user || !showComments || !commentText.trim()) return;
    setPostingComment(true);
    try {
      const { error } = await supabase.from('bts_comments').insert({
        bts_id: showComments.id,
        client_id: user.id,
        comment: commentText.trim(),
      });
      if (error) throw error;
      
      setCommentText('');
      fetchComments(showComments.id);
      
      setPosts(prev => prev.map(p => p.id === showComments.id ? {
        ...p,
        commentsCount: p.commentsCount + 1,
      } : p));
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0;
      setActiveIndex(idx);
      setActivePostId(viewableItems[0].item?.id);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = ({ item, index }: { item: BTSWithSocial; index: number }) => {
    const isActive = index === activeIndex;
    const isVideo = item.media_type === 'video';

    return (
      <View style={{ width, height, backgroundColor: 'black' }}>
        {isVideo ? (
          <Video
            source={{ uri: item.media_url }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive}
            isLooping
            isMuted={isMuted}
            posterSource={(item as any).video_thumbnail_url ? { uri: (item as any).video_thumbnail_url } : undefined}
            usePoster={!!(item as any).video_thumbnail_url}
          />
        ) : (
          <Image
            source={{ uri: item.media_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
          style={StyleSheet.absoluteFill}
          locations={[0.4, 0.7, 1]}
        />

        {/* Back Button */}
        <View style={[styles.topOverlay, { top: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color="white" />
          </TouchableOpacity>
        </View>

        {/* Vertical Actions (Right) */}
        <View style={[styles.rightOverlay, { bottom: insets.bottom + 100 }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item)}>
            <Heart 
              size={34} 
              color={item.isLiked ? Colors.error : 'white'} 
              fill={item.isLiked ? Colors.error : 'transparent'} 
            />
            <Text style={styles.actionCount}>{item.likesCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => {
            setShowComments(item);
            fetchComments(item.id);
          }}>
            <MessageCircle size={34} color="white" />
            <Text style={styles.actionCount}>{item.commentsCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => {
            Share.share({ message: `Check out this BTS: ${item.title}` });
            (supabase as any).rpc('increment_shares', { row_id: item.id, table_name: 'bts_posts' });
          }}>
            <Share2 size={34} color="white" />
            <Text style={styles.actionCount}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => {
             router.push('/(tabs)/bookings');
             (supabase as any).rpc('increment_clicks', { row_id: item.id, table_name: 'bts_posts' });
          }}>
            <View style={styles.bookIconWrapper}>
              <Calendar size={20} color="black" />
            </View>
            <Text style={styles.actionCount}>Book</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionBtn} onPress={() => setIsMuted(!isMuted)}>
             {isMuted ? <VolumeX size={28} color="white" /> : <Volume2 size={28} color="white" />}
          </TouchableOpacity>
        </View>

        {/* Info Layout (Bottom) */}
        <View style={[styles.bottomOverlay, { bottom: insets.bottom + 40 }]}>
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          )}
          <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
          {(item as any).caption && (
            <Text style={styles.postCaption} numberOfLines={3}>{(item as any).caption}</Text>
          )}
          <Text style={styles.postTime}>
            {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialScrollIndex={activeIndex}
        getItemLayout={(_, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
      />

      {/* Comment Bottom Sheet */}
      <Modal
        visible={!!showComments}
        animationType="slide"
        transparent
        onRequestClose={() => setShowComments(null)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowComments(null)} />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(null)}>
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
  container: { flex: 1, backgroundColor: 'black' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'black' },
  
  // Overlays
  topOverlay: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightOverlay: {
    position: 'absolute',
    right: 12,
    zIndex: 10,
    alignItems: 'center',
    gap: 22,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  bookIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 60,
    zIndex: 10,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoryText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  postTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  postCaption: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  postTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },

  // Modal
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyComments: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 15 },
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
