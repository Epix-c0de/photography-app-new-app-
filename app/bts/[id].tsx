import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Animated, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Audio, Video, ResizeMode } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import { Heart, MessageCircle, Share2, Calendar, X, Send, MoreHorizontal } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/supabase';

type BTSPost = Database['public']['Tables']['bts_posts']['Row'];
type BTSComment = Database['public']['Tables']['bts_comments']['Row'] & {
  user_profiles: {
    name: string | null;
    avatar_url: string | null;
  } | null;
};

const { width, height } = Dimensions.get('window');
const LIKED_BTS_KEY = 'liked_bts_post_ids_v1';

async function loadLikedSet() {
  const raw = await AsyncStorage.getItem(LIKED_BTS_KEY);
  if (!raw) return new Set<string>();
  try {
    const ids = JSON.parse(raw);
    if (Array.isArray(ids)) return new Set(ids.filter((v) => typeof v === 'string'));
    return new Set<string>();
  } catch {
    return new Set<string>();
  }
}

async function persistLikedSet(set: Set<string>) {
  await AsyncStorage.setItem(LIKED_BTS_KEY, JSON.stringify(Array.from(set)));
}

function relativeTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function BTSViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [posts, setPosts] = useState<BTSPost[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<BTSComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const flatListRef = useRef<FlatList<BTSPost>>(null);

  const fetchPosts = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('bts_posts')
      .select('*')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return;

    setPosts(data);
    
    // Find index of the requested post
    if (id) {
      const idx = data.findIndex(p => p.id === id);
      if (idx !== -1) {
        setActiveIndex(idx);
        setActivePostId(data[idx].id);
        // We can't scroll immediately here reliably, but initialScrollIndex on FlatList works
      } else {
        setActivePostId(data[0]?.id);
      }
    }
  }, [id]);

  useEffect(() => {
    fetchPosts();
    loadLikedSet().then(setLikedIds);
  }, [fetchPosts]);

  // View Tracking & Music
  useEffect(() => {
    if (!activePostId) return;
    
    // 1. Increment View
    (supabase as any).rpc('increment_views', { row_id: activePostId, table_name: 'bts_posts' });

    // 2. Play Music
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
            { shouldPlay: true, isLooping: true, volume: 0.2 }
            );
            setSound(newSound);
        } catch (e) {
            console.log('Music play error', e);
        }
      }
    };
    playMusic();

    return () => {
        if (sound) sound.unloadAsync();
    };
  }, [activePostId]); // Note: adding posts/sound to deps might cause loops, keeping simple

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
        if (sound) sound.unloadAsync();
    };
  }, []);

  // Comments fetching
  const fetchComments = useCallback(async (postId: string) => {
    setLoadingComments(true);
    const { data, error } = await supabase
      .from('bts_comments')
      .select('*, user_profiles(name, avatar_url)')
      .eq('bts_id', postId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setComments(data as any);
    }
    setLoadingComments(false);
  }, []);

  useEffect(() => {
    if (showComments && activePostId) {
      fetchComments(activePostId);
      
      const channel = supabase
        .channel(`bts_comments_${activePostId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bts_comments', filter: `bts_id=eq.${activePostId}` }, (payload) => {
           // Optimistically fetch or just append if we have user details (which we don't in payload)
           fetchComments(activePostId);
        })
        .subscribe();
        
      return () => { supabase.removeChannel(channel); };
    }
  }, [showComments, activePostId, fetchComments]);

  const toggleLike = async (post: BTSPost) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isLiked = likedIds.has(post.id);
    const newSet = new Set(likedIds);
    
    if (isLiked) {
      newSet.delete(post.id);
      // DB remove
      if (user) {
        await supabase.from('bts_likes').delete().match({ user_id: user.id, bts_id: post.id });
      }
    } else {
      newSet.add(post.id);
      // DB add
      if (user) {
        await supabase.from('bts_likes').insert({ user_id: user.id, bts_id: post.id });
      }
    }
    
    setLikedIds(newSet);
    persistLikedSet(newSet);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !activePostId || !user) return;
    
    const text = commentText.trim();
    setCommentText('');
    Keyboard.dismiss();

    const { error } = await supabase.from('bts_comments').insert({
      bts_id: activePostId,
      client_id: user.id,
      comment: text,
    });

    if (error) {
      // Handle error (maybe toast)
    } else {
      // fetchComments(activePostId); // Realtime should handle this
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index;
      if (idx !== null && idx !== undefined) {
        setActiveIndex(idx);
        setActivePostId(posts[idx]?.id);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = ({ item, index }: { item: BTSPost; index: number }) => {
    const isActive = index === activeIndex;
    const isLiked = likedIds.has(item.id);

    return (
      <View style={{ width, height, backgroundColor: 'black' }}>
        {item.media_type === 'video' ? (
          <Video
            source={{ uri: item.media_url }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive}
            isLooping
            isMuted={false}
          />
        ) : (
          <Image
            source={{ uri: item.media_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        )}
        
        {/* Overlay Gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
          style={StyleSheet.absoluteFill}
          locations={[0.5, 0.8, 1]}
        />

        {/* Top Controls */}
        <View style={[styles.topControls, { top: insets.top + 10 }]}>
           <Pressable onPress={() => router.back()} style={styles.iconButton}>
             <X size={28} color="white" />
           </Pressable>
        </View>

        {/* Right Sidebar Actions */}
        <View style={[styles.rightActions, { bottom: insets.bottom + 100 }]}>
          <Pressable style={styles.actionButton} onPress={() => toggleLike(item)}>
            <Heart size={32} color={isLiked ? Colors.error : 'white'} fill={isLiked ? Colors.error : 'transparent'} />
            <Text style={styles.actionText}>{item.likes_count + (isLiked ? 1 : 0)}</Text>
          </Pressable>
          
          <Pressable style={styles.actionButton} onPress={() => setShowComments(true)}>
            <MessageCircle size={32} color="white" />
            <Text style={styles.actionText}>{item.comments_count}</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => {
            Share2
            Clipboard.setStringAsync(`Check out this BTS: ${item.title}`);
            // Simple toast or feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}>
            <Share2 size={32} color="white" />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => {
            // Track conversion
            (supabase as any).rpc('increment_clicks', { row_id: item.id, table_name: 'bts_posts' });
            router.push('/(tabs)/bookings');
          }}>
            <View style={styles.bookButton}>
               <Calendar size={20} color="black" />
            </View>
            <Text style={styles.actionText}>Book</Text>
          </Pressable>
        </View>

        {/* Bottom Info */}
        <View style={[styles.bottomInfo, { bottom: insets.bottom + 20 }]}>
          {item.shoot_type && (
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{item.shoot_type}</Text>
            </View>
          )}
          <Text style={styles.postTitle}>{item.title || 'Behind the Scenes'}</Text>
          <Text style={styles.postTime}>{relativeTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  if (posts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: 'white' }}>Loading BTS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        initialScrollIndex={activeIndex}
        getItemLayout={(data, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
      />

      {/* Comments Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        transparent
        onRequestClose={() => setShowComments(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowComments(false)} />
          <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <Pressable onPress={() => setShowComments(false)}>
                <X size={24} color={Colors.textPrimary} />
              </Pressable>
            </View>
            
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <Image source={{ uri: item.user_profiles?.avatar_url || 'https://via.placeholder.com/40' }} style={styles.commentAvatar} />
                  <View style={styles.commentTextContainer}>
                    <Text style={styles.commentUser}>{item.user_profiles?.name || 'User'}</Text>
                    <Text style={styles.commentBody}>{item.comment}</Text>
                    <Text style={styles.commentTime}>{relativeTime(item.created_at)}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyComments}>No comments yet. Be the first!</Text>
              }
            />

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                returnKeyType="send"
                onSubmitEditing={submitComment}
              />
              <Pressable onPress={submitComment} disabled={!commentText.trim()}>
                <Send size={24} color={commentText.trim() ? Colors.gold : '#ccc'} />
              </Pressable>
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
    backgroundColor: 'black',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topControls: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 22,
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  bookButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 80, // Leave room for right actions
    zIndex: 10,
  },
  tagBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  tagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  postTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  postTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  commentTextContainer: {
    flex: 1,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  commentBody: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  commentTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  emptyComments: {
    textAlign: 'center',
    color: Colors.textMuted,
    marginTop: 40,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: Colors.background,
  },
  commentInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginRight: 12,
    color: Colors.textPrimary,
  },
});
