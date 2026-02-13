import { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  Search,
  Send,
  X,
  Circle,
  MessageSquare,
  Phone,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

// Temporary mock data until ChatService is implemented
export type AdminChatThread = {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  lastMessage: string;
  unread: number;
  timestamp: string;
  isOnline: boolean;
  clientPhone: string;
};

const adminChatThreads: AdminChatThread[] = [
  {
    id: '1',
    clientId: 'c1',
    clientName: 'Sarah Jenkins',
    clientAvatar: 'https://i.pravatar.cc/150?u=sarah',
    lastMessage: 'Hi! When will the photos be ready?',
    unread: 2,
    timestamp: '10:30 AM',
    isOnline: true,
    clientPhone: '+254712345678'
  },
  {
    id: '2',
    clientId: 'c2',
    clientName: 'Mike Ross',
    clientAvatar: 'https://i.pravatar.cc/150?u=mike',
    lastMessage: 'Thanks for the great shoot!',
    unread: 0,
    timestamp: 'Yesterday',
    isOnline: false,
    clientPhone: '+254787654321'
  }
];

const adminQuickReplies = [
  "Your photos are ready!",
  "Thanks for booking with us.",
  "Can you confirm the date?",
  "Please complete the payment."
];

function ThreadItem({ thread, isSelected, onPress }: { thread: AdminChatThread; isSelected: boolean; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
      onPress={onPress}
    >
      <Animated.View style={[styles.threadItem, isSelected && styles.threadItemSelected, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: thread.clientAvatar }} style={styles.threadAvatar} />
          {thread.isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.threadContent}>
          <View style={styles.threadNameRow}>
            <Text style={[styles.threadName, thread.unread > 0 && styles.threadNameUnread]}>{thread.clientName}</Text>
            <Text style={styles.threadTimestamp}>{thread.timestamp}</Text>
          </View>
          <View style={styles.threadMessageRow}>
            <Text style={[styles.threadMessage, thread.unread > 0 && styles.threadMessageUnread]} numberOfLines={1}>
              {thread.lastMessage}
            </Text>
            {thread.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{thread.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function ChatView({ thread }: { thread: AdminChatThread }) {
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<{ id: string; text: string; sender: 'admin' | 'client'; time: string }[]>([
    { id: '1', text: thread.lastMessage, sender: 'client', time: thread.timestamp },
  ]);

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMsg = {
      id: Date.now().toString(),
      text: message.trim(),
      sender: 'admin' as const,
      time: 'Just now',
    };
    setMessages(prev => [...prev, newMsg]);
    setMessage('');
    console.log('[AdminChat] Sent message to', thread.clientName, ':', message.trim());
  }, [message, thread.clientName]);

  const handleQuickReply = useCallback((reply: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMsg = {
      id: Date.now().toString(),
      text: reply,
      sender: 'admin' as const,
      time: 'Just now',
    };
    setMessages(prev => [...prev, newMsg]);
    console.log('[AdminChat] Quick reply to', thread.clientName);
  }, [thread.clientName]);

  return (
    <View style={styles.chatView}>
      <View style={styles.chatHeader}>
        <Image source={{ uri: thread.clientAvatar }} style={styles.chatHeaderAvatar} />
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName}>{thread.clientName}</Text>
          <View style={styles.chatHeaderStatus}>
            <Circle size={7} color={thread.isOnline ? Colors.success : Colors.textMuted} fill={thread.isOnline ? Colors.success : Colors.textMuted} />
            <Text style={[styles.chatHeaderStatusText, { color: thread.isOnline ? Colors.success : Colors.textMuted }]}>
              {thread.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        <Pressable style={styles.chatHeaderAction}>
          <Phone size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
        {messages.map((msg) => (
          <View key={msg.id} style={[styles.messageBubble, msg.sender === 'admin' ? styles.adminBubble : styles.clientBubble]}>
            <Text style={[styles.messageText, msg.sender === 'admin' && styles.adminMessageText]}>{msg.text}</Text>
            <Text style={[styles.messageTime, msg.sender === 'admin' && styles.adminMessageTime]}>{msg.time}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.quickRepliesSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesContainer}>
          {adminQuickReplies.map((reply, index) => (
            <Pressable key={index} style={styles.quickReplyChip} onPress={() => handleQuickReply(reply)}>
              <Text style={styles.quickReplyText} numberOfLines={1}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textMuted}
          value={message}
          onChangeText={setMessage}
          multiline
          testID="admin-chat-input"
        />
        <Pressable
          style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!message.trim()}
        >
          <Send size={18} color={message.trim() ? Colors.background : Colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminInboxScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedThread, setSelectedThread] = useState<AdminChatThread | null>(null);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return adminChatThreads;
    const q = searchQuery.toLowerCase();
    return adminChatThreads.filter(
      t => t.clientName.toLowerCase().includes(q) || t.clientPhone.includes(q)
    );
  }, [searchQuery]);

  const totalUnread = useMemo(() => adminChatThreads.reduce((sum, t) => sum + t.unread, 0), []);

  if (selectedThread) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => { setSelectedThread(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <Text style={styles.backText}>← Inbox</Text>
        </Pressable>
        <ChatView thread={selectedThread} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Inbox</Text>
            <Text style={styles.headerSub}>{totalUnread} unread messages</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="admin-inbox-search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={14} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {filteredThreads.length > 0 ? (
          filteredThreads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isSelected={false}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedThread(thread);
              }}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <MessageSquare size={48} color={Colors.textMuted} />
            <Text style={styles.emptyStateTitle}>No conversations</Text>
            <Text style={styles.emptyStateText}>Messages from clients will appear here</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  searchBox: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.white,
  },
  scrollContent: {
    paddingTop: 6,
    paddingBottom: 30,
  },
  threadItem: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  threadItemSelected: {
    backgroundColor: 'rgba(212,175,55,0.05)',
  },
  avatarContainer: {
    position: 'relative' as const,
  },
  threadAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
  },
  onlineDot: {
    position: 'absolute' as const,
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  threadContent: {
    flex: 1,
  },
  threadNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  threadName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.white,
  },
  threadNameUnread: {
    fontWeight: '700' as const,
  },
  threadTimestamp: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  threadMessageRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
  },
  threadMessage: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
  },
  threadMessageUnread: {
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: Colors.background,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  chatView: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: '#111111',
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  chatHeaderStatus: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  chatHeaderStatusText: {
    fontSize: 11,
  },
  chatHeaderAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    gap: 10,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  clientBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E1E1E',
    borderBottomLeftRadius: 4,
  },
  adminBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.gold,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    color: Colors.white,
    lineHeight: 20,
  },
  adminMessageText: {
    color: Colors.background,
  },
  messageTime: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  adminMessageTime: {
    color: 'rgba(0,0,0,0.5)',
  },
  quickRepliesSection: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingVertical: 8,
  },
  quickRepliesContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickReplyChip: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 220,
  },
  quickReplyText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  inputBar: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 20,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: '#0D0D0D',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.white,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#1E1E1E',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
