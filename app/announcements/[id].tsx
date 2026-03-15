import { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Keyboard, Share, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { ArrowLeft, MessageCircle, Share2, Clock, Send, ExternalLink, X, ShieldCheck, CornerDownRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/supabase';

type Announcement = Database['public']['Tables']['announcements']['Row'];
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
  const { user, profile } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullScreenMedia, setFullScreenMedia] = useState(false);
  
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  const quickReplies = [
    "Love this! 😍",
    "More info please? 🤔",
    "Is this still available?",
    "Can't wait! 🔥"
  ];

  useEffect(() => {
    if (!id) return;

    const fetchAnnouncement = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!error && data) setAnnouncement(data);
      setLoading(false);
    };

    fetchAnnouncement();
  }, [id]);

  useEffect(() => {
    if (id) {
        (supabase as any).rpc('increment_views', { row_id: id, table_name: 'announcements' });
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    
    // Simplest query that we know works from before, grabbing relations safely
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
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchComments();

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
  }, [id, fetchComments]);


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
      await Share.share({
        message: `Check out this announcement: ${announcement.title}`,
      });
    } catch (error) {
      // ignore
    }
  };

  if (loading || !announcement) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

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

  return (
    <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <ArrowLeft size={24} color={Colors.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={handleShare} style={styles.headerAction}>
                <Share2 size={24} color={Colors.textPrimary} />
            </Pressable>
        </View>

        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
        >
            <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
                {/* Hero Media */}
                {(announcement.media_url || announcement.image_url) && (
                  <Pressable 
                    style={styles.heroContainer}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setFullScreenMedia(true);
                    }}
                  >
                      {announcement.media_type === 'video' ? (
                          <Video
                              source={{ uri: announcement.media_url || announcement.image_url || '' }}
                              style={styles.heroMedia}
                              resizeMode={ResizeMode.COVER}
                              useNativeControls
                              isLooping
                          />
                      ) : (
                          <Image
                              source={{ uri: announcement.media_url || announcement.image_url || '' }}
                              style={styles.heroMedia}
                              contentFit="cover"
                          />
                      )}
                      
                      {/* Gradient Overlay for better text visibility if any overlaid elements exist */}
                      <View style={styles.heroOverlay} />

                      {announcement.category && (
                          <View style={styles.categoryBadge}>
                              <Text style={styles.categoryText}>{announcement.category}</Text>
                          </View>
                      )}
                  </Pressable>
                )}

                {/* Content Body */}
                <View style={styles.body}>
                    <Text style={styles.title} selectable>{announcement.title}</Text>
                    
                    <View style={styles.metaRow}>
                        <Clock size={14} color={Colors.textMuted} />
                        <Text style={styles.date}>{new Date(announcement.created_at).toLocaleDateString()}</Text>
                        {announcement.tag && (
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>{announcement.tag}</Text>
                            </View>
                        )}
                    </View>

                    <Text style={styles.content} selectable>
                        {announcement.content_html || announcement.description || 'No content available.'}
                    </Text>

                    {announcement.cta && (
                        <Pressable style={styles.ctaButton} onPress={() => {
                            (supabase as any).rpc('increment_clicks', { row_id: announcement.id, table_name: 'announcements' });
                            router.push({
                                pathname: '/(tabs)/chat',
                                params: { initialMessage: `Hi, I'm interested in "${announcement.title}"` }
                            }); 
                        }}>
                            <Text style={styles.ctaText}>{announcement.cta}</Text>
                            <ExternalLink size={20} color="#000" />
                        </Pressable>
                    )}

                    <View style={styles.divider} />

                    {/* Comments Section */}
                    <View style={styles.commentsSection}>
                        <View style={styles.commentsHeader}>
                            <MessageCircle size={20} color={Colors.textPrimary} />
                            <Text style={styles.commentsTitle}>Discussion ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})</Text>
                        </View>

                        {comments.length === 0 ? (
                            <Text style={styles.emptyComments}>No comments yet. Be the first to say something!</Text>
                        ) : (
                            comments.map((comment) => (
                                <View key={comment.id}>
                                    {renderCommentItem(comment)}
                                    {/* Render Replies */}
                                    {comment.replies?.map(reply => renderCommentItem(reply, true))}
                                </View>
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Comment Input */}
            <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                {replyingToId && (
                  <View style={styles.replyingToBanner}>
                    <Text style={styles.replyingToText}>Replying to comment...</Text>
                    <Pressable onPress={() => setReplyingToId(null)} style={{ padding: 4 }}>
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
                  <TextInput
                      style={styles.input}
                      placeholder={replyingToId ? "Write a reply..." : "Write a comment..."}
                      placeholderTextColor={Colors.textMuted}
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                  />
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
        </KeyboardAvoidingView>

        <Modal
          visible={fullScreenMedia}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setFullScreenMedia(false)}
        >
          <Pressable 
            style={styles.fullScreenBackdrop}
            onPress={() => setFullScreenMedia(false)}
          >
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
          </Pressable>
        </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerAction: {
    padding: 8,
    marginRight: -8,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroContainer: {
    width: width,
    height: width * 0.75, // 4:3 aspect ratio
    backgroundColor: Colors.card,
    position: 'relative',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)', // Light darkening to make it look premium
  },
  heroMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    backgroundColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  categoryText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  body: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    lineHeight: 34,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  date: {
    fontSize: 14,
    color: Colors.textMuted,
    marginLeft: 6,
    marginRight: 12,
  },
  tag: {
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '600',
  },
  content: {
    fontSize: 16,
    lineHeight: 26,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  ctaButton: {
    flexDirection: 'row',
    backgroundColor: Colors.gold,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  ctaText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 24,
  },
  commentsSection: {
    marginBottom: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyComments: {
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
  },
  commentWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
  },
  replyWrapper: {
    marginLeft: 40,
    marginBottom: 12,
  },
  replyIcon: {
    position: 'absolute',
    left: -24,
    top: 12,
  },
  commentItem: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  commentItemReply: {
    padding: 10,
    borderRadius: 12,
  },
  adminCommentItem: {
    backgroundColor: 'rgba(212,175,55,0.05)',
    borderColor: Colors.goldMuted,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.border,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
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
    gap: 6,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    fontSize: 9,
    color: Colors.gold,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  commentTime: {
    fontSize: 11,
    color: Colors.textMuted,
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
  inputContainer: {
    flexDirection: 'column',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  replyingToBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  replyingToText: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '600',
  },
  quickRepliesContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  quickRepliesContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickReplyChip: {
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickReplyText: {
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
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    minHeight: 44,
    maxHeight: 100,
    fontSize: 15,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
