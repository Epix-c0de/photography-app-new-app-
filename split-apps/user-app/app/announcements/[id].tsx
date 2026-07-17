import { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Keyboard, Share, Modal, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MessageCircle, Share2, Clock, Send, ExternalLink, X, ShieldCheck, CornerDownRight, Heart, Play, Bookmark, MoreHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getAnnouncementShareUrl } from '@/lib/platform-config';
import { demoAnnouncementComments, demoAnnouncements } from '@/lib/demo';
import type { Database } from '@/types/supabase';

type Announcement = Database['public']['Tables']['announcements']['Row'] & {
  user_profiles?: {
    name: string | null;
    avatar_url: string | null;
  } | null;
  media_urls?: string[];
};
type AnnouncementComment = Database['public']['Tables']['announcement_comments']['Row'] & {
  user_profiles: {
    name: string | null;
    avatar_url: string | null;
  } | null;
  is_admin_reply?: boolean;
  parent_comment_id?: string | null;
  replies?: AnnouncementComment[];
};

const { width } = Dimensions.get('window');

function relativeTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AnnouncementViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, isDemoMode } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullScreenMedia, setFullScreenMedia] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [reactionCount, setReactionCount] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);

  const likeScale = useRef(new Animated.Value(1)).current;

  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const quickReplies = [
    'Love this!',
    'Amazing work!',
    'Interested in this.',
    'How do I book?'
  ];

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchAnnouncement = async () => {
      setLoading(true);
      if (isDemoMode) {
        const demoAnnouncement = demoAnnouncements.find((item) => item.id === id) ?? demoAnnouncements[0] ?? null;
        if (!cancelled && demoAnnouncement) {
          setAnnouncement(demoAnnouncement as Announcement);
          setIsLiked(false);
          setReactionCount(4);
        }
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('id', id)
          .single();
        
        if (cancelled) return;

        if (error) {
          console.error('[Announcement] Failed to fetch:', error.message);
          setLoading(false);
          return;
        }

        if (data) {
          setAnnouncement(data);

          try {
            const { data: reactions } = await supabase
              .from('announcement_reactions')
              .select('user_id')
              .eq('announcement_id', id);

            if (!cancelled && reactions) {
              const userReacted = reactions?.some((r: any) => r.user_id === userIdRef.current);
              setIsLiked(!!userReacted);
              setReactionCount(reactions?.length || 0);
            }
          } catch (e) {
            console.warn('[Announcement] Reactions fetch failed:', e);
          }
        }
      } catch (e) {
        console.error('[Announcement] Fetch error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAnnouncement();
    return () => { cancelled = true; };
  }, [id, isDemoMode]);

  useEffect(() => {
    if (id) {
        (supabase as any).rpc('increment_views', { row_id: id, table_name: 'announcements' });
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    if (!id) return;

    if (isDemoMode) {
      setComments((demoAnnouncementComments[id] ?? []) as AnnouncementComment[]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('announcement_comments')
        .select('*, user_profiles(name, avatar_url)')
        .eq('announcement_id', id)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.warn('[Announcement] Comments fetch error:', error.message);
        return;
      }
      
      if (data) {
        const rawComments = data as any[];
        const topLevel: AnnouncementComment[] = [];
        const repliesMap: Record<string, AnnouncementComment[]> = {};

        rawComments.forEach(c => {
          const formatted: AnnouncementComment = { ...c };
          
          if (c.parent_comment_id) {
            if (!repliesMap[c.parent_comment_id]) repliesMap[c.parent_comment_id] = [];
            repliesMap[c.parent_comment_id].push(formatted);
          } else {
            topLevel.push(formatted);
          }
        });

        topLevel.forEach(parent => {
          parent.replies = repliesMap[parent.id] || [];
        });

        setComments(topLevel);
      }
    } catch (e) {
      console.warn('[Announcement] Comments fetch failed:', e);
    }
  }, [id, isDemoMode]);

  useEffect(() => {
    if (!id) return;
    fetchComments();

    if (isDemoMode) return;

    const channel = supabase
      .channel(`public:announcement_comments_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_comments', filter: `announcement_id=eq.${id}` }, () => {
        fetchComments();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [fetchComments, id, isDemoMode]);

  const submitComment = async () => {
    if (!commentText.trim() || !id || !user) return;
    
    setSubmittingComment(true);
    const text = commentText.trim();
    const parentId = replyingToId;
    
    const tempComment: AnnouncementComment = {
      id: 'temp-' + Date.now(),
      announcement_id: id,
      client_id: user.id,
      comment: text,
      created_at: new Date().toISOString(),
      parent_comment_id: parentId,
      is_admin_reply: false,
      user_profiles: {
        name: profile?.name || user.email?.split('@')[0] || 'Me',
        avatar_url: profile?.avatar_url || null
      }
    };

    setComments(prev => {
      if (parentId) {
        return prev.map(p => {
          if (p.id === parentId) {
            return { ...p, replies: [...(p.replies || []), tempComment] };
          }
          return p;
        });
      }
      return [...prev, tempComment];
    });

    setCommentText('');
    setReplyingToId(null);
    Keyboard.dismiss();

    if (isDemoMode) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmittingComment(false);
      return;
    }

    const { error } = await supabase.from('announcement_comments').insert({
      announcement_id: id,
      client_id: user.id,
      comment: text,
      parent_comment_id: parentId || null
    });

    if (!error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchComments();
      setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
    setSubmittingComment(false);
  };

  const handleShare = async () => {
    if (!announcement) return;
    try {
      const link = await getAnnouncementShareUrl(announcement.id, announcement.admin_id);
      await Share.share({
        title: announcement.title,
        message: `Check out this announcement: ${announcement.title}\n${link}`,
        url: link,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const isLikedRef = useRef(isLiked);
  isLikedRef.current = isLiked;
  const reactionCountRef = useRef(reactionCount);
  reactionCountRef.current = reactionCount;

  const handleLike = useCallback(async () => {
    if (!id || !user) return;

    const nextLiked = !isLikedRef.current;
    const previousCount = reactionCountRef.current;

    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.4, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();

    setIsLiked(nextLiked);
    setReactionCount(nextLiked ? previousCount + 1 : Math.max(0, previousCount - 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (nextLiked) {
        const { error } = await supabase.from('announcement_reactions').insert({
          announcement_id: id,
          user_id: user.id,
          reaction_emoji: '❤️',
        });
        if (error && (error as any)?.code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('announcement_reactions')
          .delete()
          .eq('announcement_id', id)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error('[Announcement] Like toggle failed:', error);
      setIsLiked(!nextLiked);
      setReactionCount(previousCount);
    }
  }, [id, user]);

  const renderCommentItem = (comment: AnnouncementComment, isReply = false) => (
    <View key={comment.id} style={[styles.commentThread, isReply && styles.replyThread]}>
      {isReply && (
        <View style={styles.replyConnector}>
          <View style={styles.replyLine} />
        </View>
      )}
      <View style={[styles.commentCard, comment.is_admin_reply && styles.adminCommentCard]}>
        <View style={styles.commentCardHeader}>
          <View style={styles.commentAvatarWrap}>
            <Image 
              source={{ uri: comment.user_profiles?.avatar_url || 'https://via.placeholder.com/40' }} 
              style={styles.commentAvatar}
              contentFit="cover"
            />
            {comment.is_admin_reply && (
              <View style={styles.adminBadgeSmall}>
                <ShieldCheck size={8} color="#000" />
              </View>
            )}
          </View>
          <View style={styles.commentMeta}>
            <View style={styles.commentAuthorRow}>
              <Text style={[styles.commentAuthorName, comment.is_admin_reply && styles.adminAuthorName]}>
                {comment.user_profiles?.name || 'User'}
              </Text>
              {comment.is_admin_reply && (
                <View style={styles.adminTag}>
                  <Text style={styles.adminTagText}>STUDIO</Text>
                </View>
              )}
            </View>
            <Text style={styles.commentTimeText}>{relativeTime(comment.created_at)}</Text>
          </View>
          <Pressable style={styles.commentMoreBtn}>
            <MoreHorizontal size={14} color={Colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.commentBody}>{comment.comment}</Text>
        {!isReply && (
          <Pressable 
            style={styles.replyBtn}
            onPress={() => {
              setReplyingToId(comment.id);
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }}
          >
            <CornerDownRight size={12} color={Colors.gold} />
            <Text style={styles.replyBtnText}>Reply</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  if (loading || !announcement) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Loading announcement...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <View style={{ flex: 1 }}>
        <ScrollView 
          ref={scrollViewRef} 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 120 }]}
          showsVerticalScrollIndicator={false}
        >
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => router.back()} style={styles.headerBtn}>
                        <View style={styles.headerBtnBg}>
                            <ArrowLeft size={18} color={Colors.textPrimary} />
                        </View>
                    </Pressable>
                    <View style={styles.headerCenter}>
                        <View style={styles.headerAvatarRing}>
                            <Image
                                source={{ uri: announcement.user_profiles?.avatar_url || 'https://via.placeholder.com/50' }}
                                style={styles.headerAvatar}
                                contentFit="cover"
                            />
                            <View style={styles.headerAvatarDot} />
                        </View>
                        <View>
                            <Text style={styles.headerTitle}>Studio Announcement</Text>
                            <View style={styles.headerMeta}>
                                <Clock size={10} color={Colors.textMuted} />
                                <Text style={styles.headerTime}>{relativeTime(announcement.created_at)}</Text>
                                <View style={styles.publicPill}>
                                    <Text style={styles.publicPillText}>Public</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <Pressable onPress={handleShare} style={styles.headerBtn}>
                        <View style={styles.headerShareBg}>
                            <Share2 size={16} color={Colors.gold} />
                        </View>
                    </Pressable>
                </View>

                {/* Post Content */}
                <View style={styles.postBody}>
                    <Text style={styles.postTitle} selectable>{announcement.title}</Text>
                    {announcement.description && (
                        <Text style={styles.postDescription} selectable>{announcement.description}</Text>
                    )}
                </View>

                {/* Media */}
                {(announcement.media_url || announcement.image_url) && (
                    <View style={styles.mediaWrap}>
                        {announcement.media_type === 'video' ? (
                            <View style={styles.videoWrap}>
                                <Pressable onPress={() => setIsMuted(!isMuted)}>
                                    <Video
                                        source={{ uri: announcement.media_url || announcement.image_url || '' }}
                                        style={styles.video}
                                        resizeMode={ResizeMode.COVER}
                                        useNativeControls={false}
                                        isLooping
                                        shouldPlay
                                        isMuted={isMuted}
                                        onPlaybackStatusUpdate={(status) => {
                                            if (status.isLoaded && status.durationMillis) {
                                                setVideoProgress((status.positionMillis / status.durationMillis) * 100);
                                            }
                                        }}
                                    />
                                </Pressable>
                                {isMuted && (
                                    <View style={styles.mutePill}>
                                        <Text style={styles.mutePillText}>🔇 Tap to unmute</Text>
                                    </View>
                                )}
                                <View style={styles.videoBadge}>
                                    <Play size={10} color="#fff" fill="#fff" />
                                    <Text style={styles.videoBadgeText}>VIDEO</Text>
                                </View>
                                <View style={styles.videoProgressTrack}>
                                    <View style={[styles.videoProgressFill, { width: `${videoProgress}%` }]} />
                                </View>
                            </View>
                        ) : (
                            <Pressable 
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    setFullScreenMedia(true);
                                }}
                                style={styles.imageWrap}
                            >
                                <Image
                                    source={{ uri: announcement.media_url || announcement.image_url || '' }}
                                    style={styles.postImage}
                                    contentFit="cover"
                                    transition={300}
                                />
                                {announcement.media_urls && announcement.media_urls.length > 1 && (
                                    <View style={styles.imageCountPill}>
                                        <Text style={styles.imageCountText}>1 / {announcement.media_urls.length}</Text>
                                    </View>
                                )}
                            </Pressable>
                        )}
                    </View>
                )}

                {/* Stats Bar */}
                <View style={styles.statsBar}>
                    <View style={styles.statsLeft}>
                        <View style={styles.reactionEmojiStack}>
                            <View style={[styles.reactionDot, { backgroundColor: '#FF6B6B' }]}>
                                <Heart size={8} color="#fff" fill="#fff" />
                            </View>
                            <View style={[styles.reactionDot, { backgroundColor: '#FFD93D', marginLeft: -4 }]}>
                                <Text style={{ fontSize: 8 }}>🔥</Text>
                            </View>
                        </View>
                        <Text style={styles.statsText}>
                          {reactionCount > 0 ? `${reactionCount}` : ''}
                        </Text>
                    </View>
                    <Text style={styles.statsText}>
                      {comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)} comments
                    </Text>
                </View>

                {/* Action Bar */}
                <View style={styles.actionBar}>
                    <Pressable 
                        style={[styles.actionBtn, isLiked && styles.actionBtnActive]} 
                        onPress={handleLike}
                    >
                        <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                            <Heart 
                                size={20} 
                                color={isLiked ? '#FF6B6B' : Colors.textMuted} 
                                fill={isLiked ? '#FF6B6B' : 'none'}
                            />
                        </Animated.View>
                        <Text style={[styles.actionBtnText, isLiked && { color: '#FF6B6B' }]}>
                          {isLiked ? 'Liked' : 'Like'}
                        </Text>
                    </Pressable>

                    <View style={styles.actionDivider} />

                    <Pressable 
                        style={[styles.actionBtn, showCommentInput && styles.actionBtnActive]}
                        onPress={() => {
                            setShowCommentInput(!showCommentInput);
                            if (!showCommentInput) {
                                setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
                            }
                        }}
                    >
                        <MessageCircle size={20} color={showCommentInput ? Colors.gold : Colors.textMuted} />
                        <Text style={[styles.actionBtnText, showCommentInput && { color: Colors.gold }]}>Comment</Text>
                    </Pressable>

                    <View style={styles.actionDivider} />

                    <Pressable style={styles.actionBtn} onPress={handleShare}>
                        <Share2 size={20} color={Colors.textMuted} />
                        <Text style={styles.actionBtnText}>Share</Text>
                    </Pressable>
                </View>

                {/* CTA */}
                {announcement.cta && (
                    <View style={styles.ctaWrap}>
                        <Pressable style={styles.ctaBtn} onPress={() => {
                            (supabase as any).rpc('increment_clicks', { row_id: announcement.id, table_name: 'announcements' });
                            router.push({
                                pathname: '/(tabs)/chat',
                                params: { initialMessage: `Hi, I'm interested in "${announcement.title}"` }
                            }); 
                        }}>
                            <LinearGradient
                                colors={[Colors.gold, Colors.goldDark]}
                                style={styles.ctaGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.ctaText}>{announcement.cta}</Text>
                                <ExternalLink size={16} color="#000" />
                            </LinearGradient>
                        </Pressable>
                    </View>
                )}

                {/* Comments Header */}
                <View style={styles.commentsHeader}>
                    <Text style={styles.commentsTitle}>
                      Comments
                    </Text>
                    <View style={styles.commentsDivider} />
                </View>

                {/* Comments List */}
                <View style={styles.commentsList}>
                    {comments.length === 0 ? (
                        <View style={styles.emptyComments}>
                            <MessageCircle size={28} color={Colors.textMuted} />
                            <Text style={styles.emptyCommentsText}>No comments yet</Text>
                            <Text style={styles.emptyCommentsSubtext}>Be the first to share your thoughts</Text>
                        </View>
                    ) : (
                        comments.map((comment) => (
                            <View key={comment.id}>
                                {renderCommentItem(comment)}
                                {comment.replies?.map(reply => renderCommentItem(reply, true))}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Floating Comment Input */}
            {showCommentInput && (
                <KeyboardAvoidingView 
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
                  keyboardVerticalOffset={0}
                >
                {replyingToId && (
                  <View style={styles.replyBanner}>
                    <CornerDownRight size={14} color={Colors.gold} />
                    <Text style={styles.replyBannerText}>Replying to comment</Text>
                    <Pressable onPress={() => setReplyingToId(null)} style={styles.replyBannerClose}>
                      <X size={14} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                )}
                {/* Quick Replies */}
                <View style={styles.quickRepliesWrap}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesInner}>
                    {quickReplies.map((reply, index) => (
                      <Pressable 
                        key={index} 
                        style={styles.quickPill}
                        onPress={() => {
                          setCommentText(reply);
                          Haptics.selectionAsync();
                        }}
                      >
                        <Text style={styles.quickPillText}>{reply}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                {/* Input Row */}
                <View style={styles.inputRow}>
                  <View style={styles.inputFieldWrap}>
                      <TextInput
                          style={styles.inputField}
                          placeholder={replyingToId ? "Write a reply..." : "Share your thoughts..."}
                          placeholderTextColor={Colors.textMuted}
                          value={commentText}
                          onChangeText={setCommentText}
                          multiline
                      />
                  </View>
                  <Pressable 
                      style={[styles.sendBtn, (!commentText.trim() || submittingComment) && styles.sendBtnDisabled]} 
                      onPress={submitComment}
                      disabled={!commentText.trim() || submittingComment}
                  >
                      {submittingComment ? (
                          <ActivityIndicator size="small" color="#000" />
                      ) : (
                          <Send size={16} color="#000" />
                      )}
                  </Pressable>
                </View>
                </KeyboardAvoidingView>
            )}

        {/* Full Screen Media Modal */}
        <Modal
          visible={fullScreenMedia}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setFullScreenMedia(false)}
        >
          <View style={styles.fullScreenBackdrop}>
            {announcement?.media_type === 'video' ? (
              <Video
                source={{ uri: announcement.media_url || announcement.image_url || '' }}
                style={styles.fullScreenMedia}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay
                isLooping
              />
            ) : (
              <Image
                source={{ uri: announcement?.media_url || announcement?.image_url || '' }}
                style={styles.fullScreenMedia}
                contentFit="contain"
              />
            )}
            <Pressable 
              style={[styles.fullScreenClose, { top: insets.top + 10 }]}
              onPress={() => setFullScreenMedia(false)}
            >
              <X size={24} color="white" />
            </Pressable>
          </View>
        </Modal>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
  },

  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: {
    padding: 2,
  },
  headerBtnBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerShareBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginHorizontal: 12,
  },
  headerAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    backgroundColor: Colors.goldMuted,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#4CAF50',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  headerTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  publicPill: {
    backgroundColor: Colors.card,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  publicPillText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  // Post Body
  postBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  postTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 26,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  postDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Media
  mediaWrap: {
    marginBottom: 4,
  },
  imageWrap: {
    width: width,
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: Colors.cardDark,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  imageCountPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backdropFilter: 'blur(10px)',
  },
  imageCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  videoWrap: {
    width: '100%',
    aspectRatio: 16/9,
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  mutePill: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backdropFilter: 'blur(10px)',
  },
  mutePillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  videoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backdropFilter: 'blur(10px)',
  },
  videoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  videoProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  videoProgressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
  },

  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionEmojiStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  // Action Bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnActive: {},
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  actionDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  ctaText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },

  // Comments Header
  commentsHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  commentsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  commentsDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // Comments
  commentsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyCommentsText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptyCommentsSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Comment Thread
  commentThread: {
    marginBottom: 8,
  },
  replyThread: {
    marginLeft: 28,
    marginTop: 4,
  },
  replyConnector: {
    position: 'absolute',
    left: -20,
    top: 0,
    bottom: 0,
    width: 16,
  },
  replyLine: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(212,175,55,0.2)',
    borderRadius: 1,
  },
  commentCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adminCommentCard: {
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
  },
  commentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAvatarWrap: {
    position: 'relative',
    marginRight: 10,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.border,
  },
  adminBadgeSmall: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: Colors.gold,
  },
  commentMeta: {
    flex: 1,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAuthorName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  adminAuthorName: {
    color: Colors.gold,
  },
  adminTag: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminTagText: {
    fontSize: 9,
    color: Colors.gold,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  commentTimeText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  commentMoreBtn: {
    padding: 4,
  },
  commentBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  replyBtnText: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '600',
  },

  // Input Bar
  inputBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  replyBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '600',
  },
  replyBannerClose: {
    padding: 4,
  },
  quickRepliesWrap: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  quickRepliesInner: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickPill: {
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickPillText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 10,
  },
  inputFieldWrap: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  inputField: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
    maxHeight: 100,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  sendBtn: {
    backgroundColor: Colors.gold,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.card,
    opacity: 0.5,
  },

  // Full Screen Media
  fullScreenBackdrop: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenMedia: {
    width: '100%',
    height: '100%',
  },
  fullScreenClose: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});
