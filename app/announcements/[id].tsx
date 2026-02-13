import { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Keyboard, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { ArrowLeft, MessageCircle, Share2, Clock, Send, ExternalLink } from 'lucide-react-native';
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
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

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
    const { data } = await supabase
      .from('announcement_comments')
      .select('*, user_profiles(name, avatar_url)')
      .eq('announcement_id', id)
      .order('created_at', { ascending: true });
    
    if (data) setComments(data as any);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchComments();

    const channel = supabase
      .channel(`announcement_comments_${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_comments', filter: `announcement_id=eq.${id}` }, () => {
        fetchComments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, fetchComments]);

  const submitComment = async () => {
    if (!commentText.trim() || !id || !user) return;
    
    setSubmittingComment(true);
    const text = commentText.trim();
    setCommentText('');
    Keyboard.dismiss();

    const { error } = await supabase.from('announcement_comments').insert({
      announcement_id: id,
      client_id: user.id,
      comment: text,
    });

    if (error) {
       // Alert.alert('Error', 'Failed to post comment');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Wait a bit and scroll to bottom
      setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 500);
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
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
                {/* Hero Media */}
                <View style={styles.heroContainer}>
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
                    {announcement.category && (
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryText}>{announcement.category}</Text>
                        </View>
                    )}
                </View>

                {/* Content Body */}
                <View style={styles.body}>
                    <Text style={styles.title}>{announcement.title}</Text>
                    
                    <View style={styles.metaRow}>
                        <Clock size={14} color="#888" />
                        <Text style={styles.date}>{new Date(announcement.created_at).toLocaleDateString()}</Text>
                        {announcement.tag && (
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>{announcement.tag}</Text>
                            </View>
                        )}
                    </View>

                    <Text style={styles.content}>
                        {announcement.content_html || announcement.description || 'No content available.'}
                    </Text>

                    {announcement.cta && (
                        <Pressable style={styles.ctaButton} onPress={() => {
                            // Track conversion
                            (supabase as any).rpc('increment_clicks', { row_id: announcement.id, table_name: 'announcements' });
                            
                            router.push({
                                pathname: '/(tabs)/chat',
                                params: { initialMessage: `Hi, I'm interested in "${announcement.title}"` }
                            }); 
                        }}>
                            <Text style={styles.ctaText}>{announcement.cta}</Text>
                            <ExternalLink size={20} color="#fff" />
                        </Pressable>
                    )}

                    <View style={styles.divider} />

                    {/* Comments Section */}
                    <View style={styles.commentsSection}>
                        <View style={styles.commentsHeader}>
                            <MessageCircle size={20} color={Colors.textPrimary} />
                            <Text style={styles.commentsTitle}>Discussion ({comments.length})</Text>
                        </View>

                        {comments.length === 0 ? (
                            <Text style={styles.emptyComments}>No comments yet. Be the first to say something!</Text>
                        ) : (
                            comments.map((comment) => (
                                <View key={comment.id} style={styles.commentItem}>
                                    <Image 
                                        source={{ uri: comment.user_profiles?.avatar_url || 'https://via.placeholder.com/40' }} 
                                        style={styles.avatar}
                                    />
                                    <View style={styles.commentContent}>
                                        <View style={styles.commentHeader}>
                                            <Text style={styles.commentAuthor}>{comment.user_profiles?.name || 'User'}</Text>
                                            <Text style={styles.commentTime}>{relativeTime(comment.created_at)}</Text>
                                        </View>
                                        <Text style={styles.commentText}>{comment.comment}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Comment Input */}
            <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 10 }]}>
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
                      placeholder="Write a comment..."
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                  />
                  <Pressable 
                      style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]} 
                      onPress={submitComment}
                      disabled={!commentText.trim() || submittingComment}
                  >
                      {submittingComment ? (
                          <ActivityIndicator size="small" color="#fff" />
                      ) : (
                          <Send size={20} color="#fff" />
                      )}
                  </Pressable>
                </View>
            </View>
        </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    paddingBottom: 100,
  },
  heroContainer: {
    width: width,
    height: width * 0.75, // 4:3 aspect ratio
    backgroundColor: '#eee',
    position: 'relative',
  },
  heroMedia: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  body: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  date: {
    fontSize: 14,
    color: '#888',
    marginLeft: 6,
    marginRight: 12,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  content: {
    fontSize: 16,
    lineHeight: 26,
    color: '#333',
    marginBottom: 30,
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
    marginBottom: 30,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 30,
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
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 12,
    borderTopLeftRadius: 4,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'column',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  quickRepliesContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  quickRepliesContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickReplyChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quickReplyText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    maxHeight: 100,
    marginRight: 10,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: Colors.gold,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#ccc',
  },
});
