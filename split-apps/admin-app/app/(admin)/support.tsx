import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl,
  Modal, ScrollView, Image, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Send, MessageCircle, Phone, Search, X, ChevronDown, CheckCheck,
  Check, Camera, Paperclip, Image as ImageIcon, FileText, Zap,
  AlertCircle, AlertTriangle, CircleDot,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Message = {
  id: string;
  content: string;
  sender_role: 'admin' | 'super_admin' | 'master_admin';
  is_read: boolean;
  created_at: string;
  message_type?: 'text' | 'image' | 'file';
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  media_url?: string;
  file_name?: string;
};

const ISSUE_CATEGORIES = [
  { label: 'General', value: 'general', icon: MessageCircle },
  { label: 'Billing', value: 'billing', icon: FileText },
  { label: 'Technical', value: 'technical', icon: AlertCircle },
  { label: 'Feature Request', value: 'feature_request', icon: Zap },
  { label: 'Bug Report', value: 'bug_report', icon: AlertTriangle },
];

const PRIORITY_LEVELS = [
  { label: 'Low', value: 'low', color: '#2ECC71' },
  { label: 'Medium', value: 'medium', color: '#F39C12' },
  { label: 'High', value: 'high', color: '#E67E22' },
  { label: 'Urgent', value: 'urgent', color: '#E74C3C' },
];

const QUICK_REPLIES = [
  "I need help with my subscription",
  "There's a billing issue on my account",
  "I found a bug in the app",
  "I'd like to request a new feature",
  "My photos aren't uploading",
  "I need help with client delivery",
  "Can you check my payment status?",
  "I have a question about my package",
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Category & Priority
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  // Quick replies
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  // Typing indicator
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Read receipts
  const [readReceipts, setReadReceipts] = useState<Record<string, boolean>>({});

  // Unread count for badge
  const [unreadCount, setUnreadCount] = useState(0);

  // Image/file preview
  const [previewItem, setPreviewItem] = useState<Message | null>(null);

  // Filtered messages for search
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(
      m =>
        m.content.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('photographer_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const msgs = (data || []) as Message[];
      setMessages(msgs);

      // Count unread from support team
      const unread = msgs.filter(
        (m: any) => m.sender_role !== 'admin' && !m.is_read
      );
      setUnreadCount(unread.length);

      // Build read receipt map
      const receipts: Record<string, boolean> = {};
      msgs.forEach((m: any) => {
        receipts[m.id] = m.is_read;
      });
      setReadReceipts(receipts);

      // Mark support team messages as read
      const unreadMsgs = msgs.filter(
        (m: any) => m.sender_role !== 'admin' && !m.is_read
      );
      if (unreadMsgs.length > 0) {
        await supabase
          .from('support_messages')
          .update({ is_read: true })
          .in('id', unreadMsgs.map((m: any) => m.id));
        unreadMsgs.forEach((m: any) => {
          receipts[m.id] = true;
        });
        setReadReceipts({ ...receipts });
        setUnreadCount(0);
      }
    } catch (e) {
      console.warn('Support messages error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('admin-support-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `photographer_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          setReadReceipts((prev) => ({ ...prev, [newMsg.id]: false }));

          if (newMsg.sender_role !== 'admin') {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_messages',
          filter: `photographer_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
          if (updated.is_read) {
            setReadReceipts((prev) => ({ ...prev, [updated.id]: true }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Typing indicator - broadcast via presence (simulated with a lightweight channel)
  useEffect(() => {
    if (!user?.id) return;

    const typingChannel = supabase.channel(`typing-${user.id}`);

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.user_id !== user.id) {
          setIsOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsOtherTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(typingChannel);
    };
  }, [user?.id]);

  const broadcastTyping = useCallback(() => {
    if (!user?.id) return;
    supabase.channel(`typing-${user.id}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id },
    });
  }, [user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMessages();
  }, [loadMessages]);

  // Pick image
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      await sendMediaMessage(result.assets[0].uri, 'image');
    }
  };

  // Take photo
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      await sendMediaMessage(result.assets[0].uri, 'image');
    }
  };

  // Pick document
  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      await sendMediaMessage(result.assets[0].uri, 'file', result.assets[0].name);
    }
  };

  // Upload media to Supabase storage and send message
  const sendMediaMessage = async (uri: string, type: 'image' | 'file', fileName?: string) => {
    if (!user?.id) return;
    setSending(true);

    try {
      const ext = uri.split('.').pop() || 'jpg';
      const filePath = `support/${user.id}/${Date.now()}.${ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('support-media')
        .upload(filePath, blob, {
          contentType: type === 'image' ? 'image/jpeg' : 'application/octet-stream',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('support-media').getPublicUrl(filePath);

      const content = type === 'image' ? '[Image]' : `[File: ${fileName || 'attachment'}]`;

      const { error } = await supabase.from('support_messages').insert({
        photographer_id: user.id,
        content,
        sender_role: 'admin',
        is_read: false,
        message_type: type,
        media_url: urlData?.publicUrl,
        file_name: fileName,
        category: selectedCategory,
        priority: selectedPriority,
      });

      if (error) throw error;
    } catch (e) {
      console.warn('Send media failed:', e);
      Alert.alert('Error', 'Failed to send attachment. Please try again.');
    }
    setSending(false);
  };

  // Send text message
  const handleSend = async () => {
    if (!newMessage.trim() || !user?.id || sending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const { error } = await supabase.from('support_messages').insert({
        photographer_id: user.id,
        content,
        sender_role: 'admin',
        is_read: false,
        message_type: 'text',
        category: selectedCategory,
        priority: selectedPriority,
      });
      if (error) throw error;
    } catch (e) {
      console.warn('Send failed:', e);
      setNewMessage(content);
    }
    setSending(false);
  };

  // WhatsApp fallback
  const openWhatsApp = async () => {
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_whatsapp_number')
      .single();
    if (data?.value) {
      const phone = data.value.replace(/[^0-9]/g, '');
      const msg = encodeURIComponent(
        'Hello, I need support with my Epix Visuals account.'
      );
      const link = `https://wa.me/${phone}?text=${msg}`;
      const { Linking } = require('react-native');
      Linking.openURL(link);
    }
  };

  // Send quick reply
  const sendQuickReply = (text: string) => {
    setNewMessage(text);
    setShowQuickReplies(false);
  };

  // Get category info
  const getCategoryInfo = (value: string) =>
    ISSUE_CATEGORIES.find((c) => c.value === value) || ISSUE_CATEGORIES[0];

  // Get priority info
  const getPriorityInfo = (value: string | null) =>
    PRIORITY_LEVELS.find((p) => p.value === value);

  // Render message
  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_role === 'admin';
    const categoryInfo = item.category ? getCategoryInfo(item.category) : null;
    const priorityInfo = item.priority ? getPriorityInfo(item.priority) : null;
    const isRead = readReceipts[item.id] ?? item.is_read;

    return (
      <View style={[styles.messageWrapper, isMine ? styles.myWrapper : styles.theirWrapper]}>
        {/* Category & Priority badges (only on first message or when changed) */}
        {(categoryInfo?.value !== 'general' || priorityInfo) && (
          <View style={styles.messageMeta}>
            {categoryInfo && categoryInfo.value !== 'general' && (
              <View style={styles.categoryBadge}>
                <categoryInfo.icon size={10} color={Colors.gold} />
                <Text style={styles.categoryBadgeText}>{categoryInfo.label}</Text>
              </View>
            )}
            {priorityInfo && (
              <View style={[styles.priorityBadge, { backgroundColor: `${priorityInfo.color}20` }]}>
                <CircleDot size={10} color={priorityInfo.color} />
                <Text style={[styles.priorityBadgeText, { color: priorityInfo.color }]}>
                  {priorityInfo.label}
                </Text>
              </View>
            )}
          </View>
        )}

        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myMessage : styles.theirMessage,
            item.message_type === 'image' && styles.imageBubble,
          ]}
        >
          {/* Image message */}
          {item.message_type === 'image' && item.media_url && (
            <Pressable onPress={() => setPreviewItem(item)}>
              <Image
                source={{ uri: item.media_url }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </Pressable>
          )}

          {/* File message */}
          {item.message_type === 'file' && (
            <Pressable
              style={styles.fileAttachment}
              onPress={() => setPreviewItem(item)}
            >
              <FileText size={20} color={isMine ? '#080810' : Colors.gold} />
              <Text
                style={[styles.fileName, isMine && styles.fileNameMine]}
                numberOfLines={1}
              >
                {item.file_name || 'Attachment'}
              </Text>
            </Pressable>
          )}

          {/* Text content */}
          {item.message_type !== 'image' && (
            <Text style={[styles.messageText, isMine && styles.myMessageText]}>
              {item.content}
            </Text>
          )}

          {/* Time & read receipt */}
          <View style={[styles.messageFooter, isMine && styles.myMessageFooter]}>
            <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
              {new Date(item.created_at).toLocaleTimeString('en-KE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {isMine && (
              <View style={styles.readReceipt}>
                {isRead ? (
                  <CheckCheck size={14} color={Colors.goldLight} />
                ) : (
                  <Check size={14} color={isMine ? 'rgba(8,8,16,0.4)' : 'rgba(255,255,255,0.3)'} />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Render image preview modal
  const renderPreviewModal = () => (
    <Modal visible={!!previewItem} transparent animationType="fade">
      <View style={styles.previewOverlay}>
        <Pressable style={styles.previewClose} onPress={() => setPreviewItem(null)}>
          <X size={24} color="#FFFFFF" />
        </Pressable>
        {previewItem?.message_type === 'image' && previewItem.media_url ? (
          <Image
            source={{ uri: previewItem.media_url }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.previewFileBox}>
            <FileText size={48} color={Colors.gold} />
            <Text style={styles.previewFileName}>{previewItem?.file_name || 'File'}</Text>
          </View>
        )}
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <MessageCircle size={18} color={Colors.gold} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Support</Text>
            <Text style={styles.headerSub}>Epix Visuals Team</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search size={16} color={isSearchOpen ? Colors.gold : 'rgba(255,255,255,0.5)'} />
          </Pressable>
          <Pressable style={styles.whatsappBtn} onPress={openWhatsApp}>
            <Phone size={16} color="#25D366" />
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      {isSearchOpen && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Search size={14} color="rgba(255,255,255,0.3)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search messages..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={14} color="rgba(255,255,255,0.3)" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Category & Priority Selectors */}
      {!isSearchOpen && (
        <View style={styles.selectorsRow}>
          <Pressable
            style={styles.selectorBtn}
            onPress={() => {
              setShowCategoryPicker(!showCategoryPicker);
              setShowPriorityPicker(false);
            }}
          >
            {(() => {
              const cat = getCategoryInfo(selectedCategory);
              return (
                <>
                  <cat.icon size={12} color={Colors.gold} />
                  <Text style={styles.selectorText}>{cat.label}</Text>
                  <ChevronDown size={12} color="rgba(255,255,255,0.4)" />
                </>
              );
            })()}
          </Pressable>

          {selectedPriority && (
            <View style={[styles.priorityIndicator, { backgroundColor: `${getPriorityInfo(selectedPriority)?.color}20` }]}>
              <CircleDot size={10} color={getPriorityInfo(selectedPriority)?.color} />
              <Text style={[styles.priorityIndicatorText, { color: getPriorityInfo(selectedPriority)?.color }]}>
                {getPriorityInfo(selectedPriority)?.label}
              </Text>
              <Pressable onPress={() => setSelectedPriority(null)}>
                <X size={10} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>
          )}

          <Pressable
            style={styles.selectorBtn}
            onPress={() => {
              setShowPriorityPicker(!showPriorityPicker);
              setShowCategoryPicker(false);
            }}
          >
            <AlertTriangle size={12} color="rgba(255,255,255,0.4)" />
            <Text style={[styles.selectorText, { color: 'rgba(255,255,255,0.4)' }]}>Priority</Text>
            <ChevronDown size={12} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>
      )}

      {/* Category Picker Dropdown */}
      {showCategoryPicker && !isSearchOpen && (
        <View style={styles.dropdown}>
          {ISSUE_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.value}
              style={[
                styles.dropdownItem,
                selectedCategory === cat.value && styles.dropdownItemActive,
              ]}
              onPress={() => {
                setSelectedCategory(cat.value);
                setShowCategoryPicker(false);
              }}
            >
              <cat.icon
                size={14}
                color={selectedCategory === cat.value ? Colors.gold : 'rgba(255,255,255,0.5)'}
              />
              <Text
                style={[
                  styles.dropdownText,
                  selectedCategory === cat.value && styles.dropdownTextActive,
                ]}
              >
                {cat.label}
              </Text>
              {selectedCategory === cat.value && (
                <CheckCheck size={14} color={Colors.gold} />
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Priority Picker Dropdown */}
      {showPriorityPicker && !isSearchOpen && (
        <View style={styles.dropdown}>
          {PRIORITY_LEVELS.map((p) => (
            <Pressable
              key={p.value}
              style={[
                styles.dropdownItem,
                selectedPriority === p.value && styles.dropdownItemActive,
              ]}
              onPress={() => {
                setSelectedPriority(selectedPriority === p.value ? null : p.value);
                setShowPriorityPicker(false);
              }}
            >
              <CircleDot size={14} color={p.color} />
              <Text style={[styles.dropdownText, { color: p.color }]}>{p.label}</Text>
              {selectedPriority === p.value && (
                <CheckCheck size={14} color={Colors.gold} />
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={filteredMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.gold}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              size="large"
              color={Colors.gold}
              style={{ marginTop: 60 }}
            />
          ) : (
            <View style={styles.empty}>
              <MessageCircle size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyTitle}>Start a conversation</Text>
              <Text style={styles.emptySub}>
                Send a message to get help from our team
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isOtherTyping ? (
            <View style={styles.typingIndicator}>
              <View style={styles.typingDots}>
                <View style={[styles.typingDot, styles.typingDot1]} />
                <View style={[styles.typingDot, styles.typingDot2]} />
                <View style={[styles.typingDot, styles.typingDot3]} />
              </View>
              <Text style={styles.typingText}>Support team is typing...</Text>
            </View>
          ) : null
        }
        renderItem={renderMessage}
      />

      {/* Quick Replies */}
      {showQuickReplies && (
        <View style={styles.quickRepliesContainer}>
          <View style={styles.quickRepliesHeader}>
            <Zap size={14} color={Colors.gold} />
            <Text style={styles.quickRepliesTitle}>Quick Replies</Text>
            <Pressable onPress={() => setShowQuickReplies(false)}>
              <X size={14} color="rgba(255,255,255,0.4)" />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRepliesScroll}
          >
            {QUICK_REPLIES.map((reply, index) => (
              <Pressable
                key={index}
                style={styles.quickReplyChip}
                onPress={() => sendQuickReply(reply)}
              >
                <Text style={styles.quickReplyText}>{reply}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        {/* Attachment buttons */}
        <View style={styles.attachmentRow}>
          <Pressable style={styles.attachBtn} onPress={pickImage}>
            <ImageIcon size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
          <Pressable style={styles.attachBtn} onPress={takePhoto}>
            <Camera size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
          <Pressable style={styles.attachBtn} onPress={pickDocument}>
            <Paperclip size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
          <Pressable
            style={styles.attachBtn}
            onPress={() => setShowQuickReplies(!showQuickReplies)}
          >
            <Zap
              size={18}
              color={showQuickReplies ? Colors.gold : 'rgba(255,255,255,0.5)'}
            />
          </Pressable>
        </View>

        {/* Text input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={newMessage}
            onChangeText={(text) => {
              setNewMessage(text);
              broadcastTyping();
            }}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[
              styles.sendBtn,
              (!newMessage.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size={16} color="#080810" />
            ) : (
              <Send
                size={18}
                color={newMessage.trim() ? '#080810' : 'rgba(255,255,255,0.3)'}
              />
            )}
          </Pressable>
        </View>
      </View>

      {/* Image/File Preview Modal */}
      {renderPreviewModal()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212,175,55,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(37,211,102,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Selectors
  selectorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectorText: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '600',
  },
  priorityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priorityIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Dropdown
  dropdown: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  dropdownText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  dropdownTextActive: {
    color: Colors.gold,
  },

  // Messages
  messagesList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  messageWrapper: {
    marginBottom: 4,
  },
  myWrapper: {
    alignItems: 'flex-end',
  },
  theirWrapper: {
    alignItems: 'flex-start',
  },
  messageMeta: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: Colors.gold,
    fontWeight: '600',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  myMessage: {
    backgroundColor: Colors.gold,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderBottomLeftRadius: 4,
  },
  imageBubble: {
    padding: 4,
    overflow: 'hidden',
  },
  messageImage: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.4,
    borderRadius: 12,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  fileName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
  },
  fileNameMine: {
    color: '#080810',
  },
  messageText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  myMessageText: {
    color: '#080810',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  myMessageFooter: {},
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },
  myMessageTime: {
    color: 'rgba(8,8,16,0.5)',
  },
  readReceipt: {
    marginLeft: 2,
  },

  // Typing indicator
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  typingText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
  },

  // Quick Replies
  quickRepliesContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: Colors.cardDark,
  },
  quickRepliesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  quickRepliesTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gold,
  },
  quickRepliesScroll: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
  },
  quickReplyChip: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  quickReplyText: {
    fontSize: 12,
    color: Colors.goldLight,
    fontWeight: '500',
  },

  // Input
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: Colors.cardDark,
  },
  attachmentRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 4,
  },
  attachBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#FFFFFF',
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Preview Modal
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  previewImage: {
    width: SCREEN_WIDTH - 40,
    height: (SCREEN_WIDTH - 40) * 0.75,
  },
  previewFileBox: {
    alignItems: 'center',
    gap: 12,
  },
  previewFileName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
