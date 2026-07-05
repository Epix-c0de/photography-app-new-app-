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
import { Video, ResizeMode, Audio, AVPlaybackStatusContext, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { demoBtsComments, demoBtsPosts } from '@/lib/demo';
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
  const { user, isDemoMode } = useAuth();
  const { btsShareLink } = useBranding();

  const [posts, setPosts] = useState<BTSWithSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
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

      if (isDemoMode) {
        const withSocial = demoBtsPosts.map((p, index) => ({
          ...p,
          isLiked: index === 0,
          likesCount: p.likes_count,
          commentsCount: p.comments_count,
          isBookmarked: false,
        })) as BTSWithSocial[];
        setPosts(withSocial);
        if (initialId && withSocial.length > 0) {
          const idx = withSocial.findIndex(p => p.id === initialId);
          setActiveIndex(idx >= 0 ? idx : 0);
          setActivePostId(withSocial[idx >= 0 ? idx : 0]?.id ?? null);
        } else {
          setActivePostId(withSocial[0]?.id ?? null);
        }
        return;
      }

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('bts_posts')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Batch: fetch all user likes and bookmarks in 2 queries instead of N*2
      const postIds = (data || []).map(p => p.id);
      
      const [allLikes, allBookmarks] = await Promise.allSettled([
        postIds.length > 0 ? supabase
          .from('bts_likes')
          .select('bts_id')
          .in('bts_id', postIds)
          .eq('user_id', user?.id ?? '') : Promise.resolve({ data: [] }),
        postIds.length > 0 ? supabase
          .from('bts_bookmarks')
          .select('bts_id')
          .in('bts_id', postIds)
          .eq('user_id', user?.id ?? '') : Promise.resolve({ data: [] }),
      ]);

      const userLikeSet = new Set(
        (allLikes.status === 'fulfilled' ? allLikes.value.data : [])?.map((r: any) => r.bts_id) || []
      );
      const userBookmarkSet = new Set(
        (allBookmarks.status === 'fulfilled' ? allBookmarks.value.data : [])?.map((r: any) => r.bts_id) || []
      );

      const withSocial = (data || []).map((p) => ({
        ...p,
        isLiked: userLikeSet.has(p.id),
        likesCount: typeof p.likes_count === 'number' ? p.likes_count : 0,
        commentsCount: typeof p.comments_count === 'number' ? p.comments_count : 0,
        isBookmarked: userBookmarkSet.has(p.id),
      })) as BTSWithSocial[];

      setPosts(withSocial);

      if (initialId && withSocial.length > 0) {
        const idx = withSocial.findIndex(p => p.id === initialId);
        if (idx !== -1) {
          setActiveIndex(idx);
          setActivePostId(withSocial[idx].id);
        } else {
          setActivePostId(withSocial[0].id);
        }
      } else if (withSocial.length > 0) {
        setActivePostId(withSocial[0].id);
      }
    } catch (err) {
      console.error('[BTS] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [initialId, isDemoMode, user?.id]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // View tracking & Music
  useEffect(() => {
    if (isDemoMode) return;
    if (!activePostId) return;

    // Increment View Count via RPC
    (supabase as any).rpc('increment_views', { row_id: activePostId, table_name: 'bts_posts' })
      .then(({ error }: any) => { if (error) console.error('[BTS] View tracking failed:', error); });

    const playMusic = async () => {
      // Cleanup previous sound using ref (avoids stale closure)
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
        setSound(null);
      }

      const post = posts.find(p => p.id === activePostId);
      if (post && post.music_url) {
        try {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: post.music_url },
            { shouldPlay: true, isLooping: true, volume: 0.2, isMuted }
          );
          soundRef.current = newSound;
          setSound(newSound);
        } catch (e) {
          console.log('[BTS] Music error:', e);
        }
      }
    };
    playMusic();

    return () => {
      if (soundRef.current) {
        try { soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
    };
  }, [activePostId, isDemoMode]);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setIsMutedAsync(isMuted);
    }
  }, [isMuted]);

  const fetchComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      if (isDemoMode) {
        setComments((demoBtsComments[postId] ?? []) as BTSComment[]);
        return;
      }

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

    if (isDemoMode) {
      return;
    }

    try {
      if (post.isLiked) {
        const { error } = await supabase.from('bts_likes').delete().match({ bts_id: post.id, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bts_likes').insert({ bts_id: post.id, user_id: user.id });
        if (error && (error as any)?.code !== '23505') throw error;
      }
      const { data: refreshed } = await supabase
        .from('bts_posts')
        .select('likes_count')
        .eq('id', post.id)
        .maybeSingle();

      if (refreshed && typeof refreshed.likes_count === 'number') {
        setPosts(prev => prev.map(p => p.id === post.id ? {
          ...p,
          likesCount: refreshed.likes_count,
        } : p));
      }
    } catch (error) {
      console.error('[BTS] Like toggle failed:', error);
      // Revert on error
      setPosts(prev => prev.map(p => p.id === post.id ? post : p));
    }
  };

  const submitComment = async () => {
    if (!user || !showComments || !commentText.trim()) return;
    setPostingComment(true);
    try {
      if (isDemoMode) {
        setCommentText('');
        setPosts(prev => prev.map(p => p.id === showComments.id ? {
          ...p,
          commentsCount: p.commentsCount + 1,
        } : p));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

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
    return (
      <BTSViewerCard
        item={item}
        isActive={index === activeIndex}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        onLike={() => handleLike(item)}
        onComment={() => {
          setShowComments(item);
          fetchComments(item.id);
        }}
        onShare={() => {
          const baseLink = btsShareLink?.trim() || 'https://rork.app';
          const link = baseLink.includes('{id}')
            ? baseLink.replace('{id}', item.id)
            : `${baseLink}${baseLink.endsWith('/') ? '' : '/'}${item.id}`;
          Share.share({ message: `Check out this BTS: ${item.title}\n${link}`, url: link });
          (supabase as any).rpc('increment_shares', { row_id: item.id, table_name: 'bts_posts' });
        }}
        onBack={() => router.back()}
        insets={insets}
        router={router}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: Colors.textMuted, fontSize: 16 }}>No posts available</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.gold, fontSize: 14 }}>Go Back</Text>
        </Pressable>
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
    maxHeight: '70%',
    minHeight: 300,
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
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
});

function BTSViewerCard({ item, isActive, isMuted, setIsMuted, onLike, onComment, onShare, onBack, insets, router }: any) {
  const isVideo = item.media_type === 'video';
  const [progress, setProgress] = useState(0);

  const handleStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.positionMillis !== undefined && status.durationMillis !== undefined) {
      setProgress(status.positionMillis / status.durationMillis);
    }
  };

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
          onPlaybackStatusUpdate={handleStatusUpdate}
        />
      ) : (
        <Image
          source={{ uri: item.media_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']}
        style={StyleSheet.absoluteFill}
        locations={[0.5, 0.8, 1]}
      />

      <View style={[styles.topOverlay, { top: insets.top + 10 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ChevronLeft size={28} color="white" />
        </TouchableOpacity>
      </View>

      <View style={[styles.rightOverlay, { bottom: insets.bottom + 100 }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <Heart 
            size={34} 
            color={item.isLiked ? Colors.error : 'white'} 
            fill={item.isLiked ? Colors.error : 'transparent'} 
          />
          <Text style={styles.actionCount}>{item.likesCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onComment}>
          <MessageCircle size={34} color="white" />
          <Text style={styles.actionCount}>{item.commentsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
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

      {isVideo && isActive && (
        <View style={[styles.progressBarContainer, { bottom: insets.bottom }]}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      )}
    </View>
  );
}
