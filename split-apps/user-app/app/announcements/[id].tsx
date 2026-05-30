import { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Keyboard, Share, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ArrowLeft, MessageCircle, Share2, Clock, Send, ExternalLink, X, ShieldCheck, CornerDownRight, Heart, Sparkles, Bookmark, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
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
  const { announcementShareLink } = useBranding();
  const scrollViewRef = useRef<ScrollView>(null);

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullScreenMedia, setFullScreenMedia] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [reactionCount, setReactionCount] = useState(0);
  
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);

  const quickReplies = [
    'Love this!',
    'Amazing work!',
    'Interested in this.',
    'How do I book?'
  ];

  useEffect(() => {
    if (!id) return;

    const fetchAnnouncement = async () => {
      setLoading(true);
      if (isDemoMode) {
        const demoAnnouncement = demoAnnouncements.find((item) => item.id === id) ?? demoAnnouncements[0] ?? null;
        if (demoAnnouncement) {
          setAnnouncement(demoAnnouncement as Announcement);
          setIsLiked(false);
          setReactionCount(4);
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!error && data) {
        setAnnouncement(data);
        const { data: reactions } = await supabase
          .from('announcement_reactions')
          .select('user_id')
          .eq('announcement_id', id);

        const userReacted = reactions?.some((r: any) => r.user_id === user?.id);
        setIsLiked(!!userReacted);
        setReactionCount(reactions?.length || 0);
      }
      setLoading(false);
    };

    fetchAnnouncement();
  }, [id, isDemoMode, user]);

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
    
    const { data } = await supabase
      .from('announcement_comments')
      .select('*, user_profiles(name, avatar_url)')
      .eq('announcement_id', id)
      .order('created_at', { ascending: true });
    
    if (data) {
      // Build comment tree
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

      // Attach replies to parents
      topLevel.forEach(parent => {
        parent.replies = repliesMap[parent.id] || [];
      });

      setComments(topLevel);
    }
  }, [id, isDemoMode]);

  useEffect(() => {
    if (!id) return;
    fetchComments();

    if (isDemoMode) return;

    // 1. Realtime subscription (catch-all event)
    const channel = supabase
      .channel(`public:announcement_comments_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_comments', filter: `announcement_id=eq.${id}` }, () => {
        fetchComments();
      })
      .subscribe();

    // 2. Polling fallback every 5 seconds (in case realtime is not configured)
    const pollInterval = setInterval(fetchComments, 5000);

    return () => { 
      supabase.removeChannel(channel); 
      clearInterval(pollInterval);
    };
  }, [fetchComments, id, isDemoMode]);


  const submitComment = async () => {
    if (!commentText.trim() || !id || !user) return;
    
    setSubmittingComment(true);
    const text = commentText.trim();
    const parentId = replyingToId;
    
    // Optimistic update
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
      fetchComments(); // fetch real IDs
      setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
    setSubmittingComment(false);
  };

  const handleShare = async () => {
    if (!announcement) return;
    try {
      const baseLink = announcementShareLink?.trim() || 'https://rork.app';
      const link = baseLink.includes('{id}')
        ? baseLink.replace('{id}', announcement.id)
        : `${baseLink}${baseLink.endsWith('/') ? '' : '/'}${announcement.id}`;
      
      await Share.share({
        title: announcement.title,
        message: `Check out this announcement: ${announcement.title}\n${link}`,
        url: link,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleLike = useCallback(async () => {
    if (!id || !user) return;

    const nextLiked = !isLiked;
    const previousCount = reactionCount;

    setIsLiked(nextLiked);
    setReactionCount(nextLiked ? previousCount + 1 : Math.max(0, previousCount - 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (nextLiked) {
        const { error } = await supabase.from('announcement_reactions').insert({
          announcement_id: id,
          user_id: user.id,
          reaction_emoji: '👍',
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
  }, [id, isDemoMode, isLiked, reactionCount, user]);

  const renderCommentItem = (comment: AnnouncementComment, isReply = false) => (
    <View key={comment.id} style={[styles.commentWrapper, isReply && styles.replyWrapper]}>
      {isReply && <CornerDownRight size={16} color={Colors.textMuted} style={styles.replyIcon} />}
      <View style={[styles.commentItem, isReply && styles.commentItemReply, comment.is_admin_reply && styles.adminCommentItem]}>
        <Image 
            source={{ uri: comment.user_profiles?.avatar_url || 'https://via.placeholder.com/40' }} 
            style={styles.avatar}
            contentFit="cover"
        />
        <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
                <View style={styles.authorRow}>
                  <Text style={styles.commentAuthor}>{comment.user_profiles?.name || 'User'}</Text>
                  {comment.is_admin_reply && (
                    <View style={styles.adminBadge}>
                      <ShieldCheck size={10} color={Colors.gold} />
                      <Text style={styles.adminBadgeText}>Admin</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.commentTime}>{relativeTime(comment.created_at)}</Text>
            </View>
            <Text style={styles.commentText}>{comment.comment}</Text>
            
            {!isReply && (
              <Pressable 
                style={styles.replyButton}
                onPress={() => {
                  setReplyingToId(comment.id);
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }}
              >
                <Text style={styles.replyButtonText}>Reply</Text>
              </Pressable>
            )}
        </View>
      </View>
    </View>
  );

  if (loading || !announcement) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <View style={{ flex: 1 }}>
        <ScrollView 
          ref={scrollViewRef} 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 100 }]}
          showsVerticalScrollIndicator={false}
        >
                {/* Facebook-Style Post Header */}
                <View style={[styles.postHeader, { paddingTop: insets.top + 12 }]}>
                    <View style={styles.postHeaderLeft}>
                        <Pressable onPress={() => router.push('/(tabs)/home' as any)} style={styles.postBackBtn}>
                            <View style={styles.postBackBtnBg}>
                                <ArrowLeft size={18} color={Colors.textPrimary} />
                            </View>
                        </Pressable>
                        <View style={styles.postAvatarRing}>
                            <Image
                                source={{ uri: announcement.user_profiles?.avatar_url || 'https://via.placeholder.com/50' }}
                                style={styles.postAvatar}
                                contentFit="cover"
                            />
                        </View>
                        <View style={styles.postHeaderInfo}>
                            <Text style={styles.postAuthorName}>Studio Announcement</Text>
                            <View style={styles.postMetaRow}>
                                <Clock size={12} color={Colors.textMuted} />
                                <Text style={styles.postTime}>{relativeTime(announcement.created_at)}</Text>
                                <View style={styles.publicBadge}>
                                    <Text style={styles.publicText}>Public</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <Pressable onPress={handleShare} style={styles.postShareBtn}>
                        <View style={styles.postShareBtnBg}>
                            <Share2 size={16} color={Colors.gold} />
                        </View>
                    </Pressable>
                </View>

                {/* Post Content - Facebook Style */}
                <View style={styles.postContent}>
                    <Text style={styles.postTitle} selectable>{announcement.title}</Text>
                    {announcement.description && (
                        <Text style={styles.postDescription} selectable>{announcement.description}</Text>
                    )}
                </View>

                {/* Full-Width Media - Facebook Style */}
                {(announcement.media_url || announcement.image_url) && (
                    <View style={styles.fbMediaContainer}>
                        {announcement.media_type === 'video' ? (
                            <Pressable 
                                style={styles.fbVideoContainer}
                                onPress={() => setFullScreenMedia(true)}
                            >
                                <Video
                                    source={{ uri: announcement.media_url || announcement.image_url || '' }}
                                    style={styles.fbVideo}
                                    resizeMode={ResizeMode.COVER}
                                    useNativeControls={false}
                                    isLooping
                                    shouldPlay
                                    isMuted={true}
                                />
                                {/* Video Controls Overlay */}
                                <View style={styles.videoControlsOverlay}>
                                    <View style={styles.playPauseBtn}>
                                        <Play size={32} color={Colors.textPrimary} fill={Colors.textPrimary} />
                                    </View>
                                </View>
                                {/* Video Duration / Indicator */}
                                <View style={styles.videoIndicator}>
                                    <View style={styles.videoIndicatorBg}>
                                        <Text style={styles.videoIndicatorText}>VIDEO</Text>
                                    </View>
                                </View>
                            </Pressable>
                        ) : (
                            <Pressable 
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    setFullScreenMedia(true);
                                }}
                                style={styles.fbImageContainer}
                            >
                                <Image
                                    source={{ uri: announcement.media_url || announcement.image_url || '' }}
                                    style={styles.fbImage}
                                    contentFit="cover"
                                />
                                {/* Image Count Badge for Multiple Images */}
                                {announcement.media_urls && announcement.media_urls.length > 1 && (
                                    <View style={styles.imageCountBadge}>
                                        <Text style={styles.imageCountText}>1 / {announcement.media_urls.length}</Text>
                                    </View>
                                )}
                            </Pressable>
                        )}
                    </View>
                )}

                {/* Reaction Stats Bar - Facebook Style */}
                <View style={styles.reactionBar}>
                    <View style={styles.reactionLeft}>
                        <View style={styles.reactionEmojis}>
                            <View style={[styles.reactionEmoji, { backgroundColor: Colors.error }]}>
                                <Heart size={10} color="#fff" fill="#fff" />
                            </View>
                        </View>
                        <Text style={styles.reactionCount}>{reactionCount > 0 ? reactionCount : 'Be the first to like'}</Text>
                    </View>
                    <View style={styles.reactionRight}>
                        <Text style={styles.commentsStat}>{comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)} comments</Text>
                    </View>
                </View>

                {/* Action Bar - Facebook Style */}
                <View style={styles.actionBar}>
                    <Pressable 
                        style={[styles.actionBarBtn, isLiked && styles.actionBarBtnActive]} 
                        onPress={handleLike}
                    >
                        <Heart 
                            size={20} 
                            color={isLiked ? Colors.error : Colors.textMuted} 
                            fill={isLiked ? Colors.error : 'none'}
                        />
                        <Text style={[styles.actionBarBtnText, isLiked && { color: Colors.error }]}>Like</Text>
                    </Pressable>
                    <Pressable 
                        style={styles.actionBarBtn}
                        onPress={() => {
                            setShowCommentInput(!showCommentInput);
                            if (!showCommentInput) {
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 100);
                            }
                        }}
                    >
                        <MessageCircle size={20} color={showCommentInput ? Colors.gold : Colors.textMuted} />
                        <Text style={[styles.actionBarBtnText, showCommentInput && { color: Colors.gold }]}>Comment</Text>
                    </Pressable>
                    <Pressable style={styles.actionBarBtn} onPress={handleShare}>
                        <Share2 size={20} color={Colors.textMuted} />
                        <Text style={styles.actionBarBtnText}>Share</Text>
                    </Pressable>
                </View>

                {/* CTA Section */}
                {announcement.cta && (
                    <View style={styles.fbCtaSection}>
                        <Pressable style={styles.fbCtaButton} onPress={() => {
                            (supabase as any).rpc('increment_clicks', { row_id: announcement.id, table_name: 'announcements' });
                            router.push({
                                pathname: '/(tabs)/chat',
                                params: { initialMessage: `Hi, I'm interested in "${announcement.title}"` }
                            }); 
                        }}>
                            <LinearGradient
                                colors={[Colors.gold, Colors.goldDark]}
                                style={styles.fbCtaGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.fbCtaText}>{announcement.cta}</Text>
                                <ExternalLink size={18} color="#000" />
                            </LinearGradient>
                        </Pressable>
                    </View>
                )}

                {/* Comments Section Header */}
                <View style={styles.fbCommentsHeader}>
                    <Text style={styles.fbCommentsTitle}>Comments</Text>
                    <View style={styles.fbCommentsDivider} />
                </View>

                {/* Comments List - Facebook Style */}
                <View style={styles.fbCommentsContainer}>
                    {comments.length === 0 ? (
                        <View style={styles.fbEmptyComments}>
                            <Text style={styles.fbEmptyCommentsText}>No comments yet. Start the conversation!</Text>
                        </View>
                    ) : (
                        comments.map((comment) => (
                            <View key={comment.id} style={styles.fbCommentThread}>
                                {renderCommentItem(comment)}
                                {comment.replies?.map(reply => renderCommentItem(reply, true))}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Premium Comment Input - Conditional */}
            {showCommentInput && (
                <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) + 80 }]}>
                {replyingToId && (
                  <View style={styles.replyingToBanner}>
                    <View style={styles.replyingToIcon}>
                        <CornerDownRight size={14} color={Colors.gold} />
                    </View>
                    <Text style={styles.replyingToText}>Replying to comment</Text>
                    <Pressable onPress={() => setReplyingToId(null)} style={styles.replyingToClose}>
                      <X size={16} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                )}
                <View style={styles.quickRepliesContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesContent}>
                    {quickReplies.map((reply, index) => (
                      <Pressable 
                        key={index} 
                        style={styles.quickReplyChip}
                        onPress={() => {
                          setCommentText(reply);
                          Haptics.selectionAsync();
                        }}
                      >
                        <Text style={styles.quickReplyText}>{reply}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.inputRow}>
                  <View style={styles.inputWrapper}>
                      <TextInput
                          style={styles.input}
                          placeholder={replyingToId ? "Write a thoughtful reply..." : "Share your thoughts..."}
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
                          <Send size={18} color="#000" />
                      )}
                  </Pressable>
                </View>
                </View>
            )}

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
              <X size={28} color="white" />
            </Pressable>
          </View>
        </Modal>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Premium Floating Header
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  floatingHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  floatingBackBtn: { padding: 4 },
  floatingBackBtnBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(26,26,26,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  floatingHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  floatingActionBtn: { padding: 4 },
  floatingActionBtnBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },

  // Content
  scrollContent: {
    paddingBottom: 40,
  },

  // Facebook-Style Post Header
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  postBackBtn: {
    padding: 4,
  },
  postBackBtnBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  postShareBtn: {
    padding: 4,
  },
  postShareBtnBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.goldMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  postAvatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    backgroundColor: Colors.goldMuted,
  },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  postHeaderInfo: {
    gap: 2,
  },
  postAuthorName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postTime: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  publicBadge: {
    backgroundColor: Colors.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  publicText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  // Facebook-Style Post Content
  postContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 24,
    marginBottom: 8,
  },
  postDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Facebook-Style Media
  fbMediaContainer: {
    width: width,
    backgroundColor: Colors.cardDark,
  },
  fbImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  fbImage: {
    width: '100%',
    height: '100%',
  },
  fbVideoContainer: {
    width: '100%',
    aspectRatio: 16/9,
    position: 'relative',
    backgroundColor: '#000',
  },
  fbVideo: {
    width: '100%',
    height: '100%',
  },
  videoControlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  videoIndicatorBg: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoIndicatorText: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  imageCountText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Facebook-Style Reaction Bar
  reactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  reactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reactionEmojis: {
    flexDirection: 'row',
  },
  reactionEmoji: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionCount: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  reactionRight: {},
  commentsStat: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  // Facebook-Style Action Bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  actionBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  actionBarBtnActive: {},
  actionBarBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  // Facebook-Style CTA
  fbCtaSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  fbCtaButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  fbCtaGradient: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  fbCtaText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },

  // Facebook-Style Comments Header
  fbCommentsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fbCommentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  fbCommentsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Facebook-Style Comments
  fbCommentsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  fbCommentThread: {
    marginBottom: 12,
  },
  fbEmptyComments: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  fbEmptyCommentsText: {
    fontSize: 14,
    color: Colors.textMuted,
  },

  // Comments (shared)
  commentWrapper: {
    flexDirection: 'row',
    position: 'relative',
  },
  replyWrapper: {
    marginLeft: 44,
    marginTop: 8,
  },
  replyIcon: {
    position: 'absolute',
    left: -28,
    top: 12,
  },
  commentItem: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  commentItemReply: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: Colors.cardLight,
  },
  adminCommentItem: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderColor: 'rgba(212,175,55,0.15)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.border,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 10,
    color: Colors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commentTime: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  commentText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  replyButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  replyButtonText: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '600',
  },

  // Premium Input Section
  inputContainer: {
    flexDirection: 'column',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: Colors.background,
  },
  replyingToBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  replyingToIcon: { marginRight: 8 },
  replyingToText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '600',
    flex: 1,
  },
  replyingToClose: { padding: 4 },
  quickRepliesContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  quickRepliesContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  quickReplyChip: {
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickReplyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 12,
    minHeight: 48,
    maxHeight: 120,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  sendBtn: {
    backgroundColor: Colors.gold,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
