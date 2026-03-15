import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Animated, ActivityIndicator, Alert, Modal, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  Search,
  Send,
  X,
  Circle,
  MessageSquare,
  Phone,
  Plus,
  ChevronRight,
  Camera,
  User,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';

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
  const [messages, setMessages] = useState<{ id: string; text: string; sender: 'admin' | 'client'; time: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const loadMessages = async () => {
      try {
        setLoading(true);
        const data = await AdminService.chat.getMessages(thread.clientId);
        setMessages(data.map((m: any) => ({
          id: m.id,
          text: m.content,
          sender: m.sender_role,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })));
      } catch (error) {
        console.error('Error loading messages:', error);
        Alert.alert('Error', 'Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    unsubscribe = AdminService.chat.subscribeToMessages(thread.clientId, (payload) => {
      if (payload.eventType === 'INSERT') {
        const newMsg = payload.new;
        setMessages(prev => [...prev, {
          id: newMsg.id,
          text: newMsg.content,
          sender: newMsg.sender_role,
          time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [thread.clientId]);

  const handleSend = useCallback(async () => {
    if (!message.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await AdminService.chat.sendMessage(thread.clientId, message.trim());
      setMessage('');
      // Message will be added via subscription
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  }, [message, thread.clientId]);

  const handleQuickReply = useCallback(async (reply: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Optimistic update
      setMessages(prev => [...prev, {
        id: 'reply-' + Date.now(),
        text: reply,
        sender: 'admin',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      await AdminService.chat.sendMessage(thread.clientId, reply);
      console.log('[AdminChat] Quick reply to', thread.clientName);
    } catch (error) {
      console.error('Error sending quick reply:', error);
      Alert.alert('Error', 'Failed to send quick reply');
    }
  }, [thread.clientId, thread.clientName]);

  const handlePhonePress = useCallback(() => {
    if (thread.clientPhone) {
      Linking.openURL(`tel:${thread.clientPhone}`);
    } else {
      Alert.alert('Error', 'Client phone number not available');
    }
  }, [thread.clientPhone]);

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
        <Pressable 
          style={styles.chatHeaderAction} 
          onPress={() => router.push(`/(admin)/upload?userId=${thread.clientId}`)}
        >
          <Camera size={18} color={Colors.gold} />
        </Pressable>
        <Pressable style={styles.chatHeaderAction} onPress={handlePhonePress}>
          <Phone size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.gold} style={{ marginTop: 20 }} />
        ) : messages.length === 0 ? (
          <Text style={{ color: Colors.textMuted, textAlign: 'center', marginTop: 20 }}>No messages yet</Text>
        ) : (
          messages.map((msg) => (
            <View key={msg.id} style={[styles.messageBubble, msg.sender === 'admin' ? styles.adminBubble : styles.clientBubble]}>
              <Text style={[styles.messageText, msg.sender === 'admin' && styles.adminMessageText]}>{msg.text}</Text>
              <Text style={[styles.messageTime, msg.sender === 'admin' && styles.adminMessageTime]}>{msg.time}</Text>
            </View>
          ))
        )}
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

function NewChatModal({ visible, onClose, clients, onSelectClient }: { visible: boolean; onClose: () => void; clients: any[]; onSelectClient: (client: any) => void }) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || c.phone?.includes(q));
  }, [clients, searchQuery]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { paddingTop: 20 }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New Message</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>

        <ScrollView contentContainerStyle={styles.clientList}>
          {filteredClients.map(client => (
            <Pressable
              key={client.id}
              style={styles.clientItem}
              onPress={() => onSelectClient(client)}
            >
              <Image source={{ uri: client.user_profiles?.avatar_url || 'https://via.placeholder.com/150' }} style={styles.clientAvatar} />
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Text style={styles.clientPhone}>{client.phone}</Text>
              </View>
              <ChevronRight size={20} color={Colors.textMuted} />
            </Pressable>
          ))}
          {filteredClients.length === 0 && (
            <Text style={styles.emptyText}>No clients found</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function AdminProfileModal({ visible, onClose, onUpdate }: { visible: boolean; onClose: () => void; onUpdate: () => void }) {
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    if (visible) {
      AdminService.profile.get().then(p => {
        setName(p.name || '');
        setAvatarUrl(p.avatar_url || '');
      });
    }
  }, [visible]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0].uri) {
        setIsPicking(true);
        const publicUrl = await AdminService.profile.uploadAvatar(result.assets[0].uri);
        setAvatarUrl(publicUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error picking avatar:', error);
      Alert.alert('Error', 'Failed to upload avatar');
    } finally {
      setIsPicking(false);
    }
  };

  const handleUpdate = async () => {
    if (!name.trim()) return;
    try {
      setLoading(true);
      await AdminService.profile.update({ name: name.trim(), avatar_url: avatarUrl.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating admin profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: 20 }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Admin Profile</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={styles.profileAvatarContainer}>
            <View style={styles.avatarWrapper}>
              <Image 
                source={{ uri: avatarUrl || 'https://via.placeholder.com/150' }} 
                style={styles.profileAvatarLarge} 
              />
              {isPicking && (
                <View style={[StyleSheet.absoluteFill, styles.avatarLoading]}>
                  <ActivityIndicator color={Colors.white} />
                </View>
              )}
            </View>
            <Pressable style={styles.profileAvatarEdit} onPress={handlePickImage} disabled={isPicking}>
              <Camera size={16} color={Colors.white} />
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Admin Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Avatar URL (Manual Override)</Text>
            <TextInput
              style={styles.modalInput}
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              placeholder="https://example.com/avatar.jpg"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <Pressable 
            style={[styles.saveButton, loading && { opacity: 0.7 }]} 
            onPress={handleUpdate}
            disabled={loading || isPicking}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function AdminInboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedThread, setSelectedThread] = useState<AdminChatThread | null>(null);
  const [threads, setThreads] = useState<AdminChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const classifyError = useCallback((error: any) => {
    const message =
      error?.message ||
      error?.details ||
      error?.hint ||
      String(error || '');
    const lowerMessage = message.toLowerCase();
    const status = error?.status || error?.code;
    if (
      lowerMessage.includes('not authenticated') ||
      lowerMessage.includes('auth session missing') ||
      lowerMessage.includes('jwt') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('permission') ||
      lowerMessage.includes('row level security') ||
      status === 401 ||
      status === 403
    ) {
      return { title: 'Session Expired', body: 'Please log in again to load inbox messages.', type: 'auth' };
    }
    if (
      (lowerMessage.includes('table') && lowerMessage.includes('not found')) ||
      lowerMessage.includes('schema cache') ||
      lowerMessage.includes('relation') && lowerMessage.includes('does not exist')
    ) {
      return { title: 'Database Setup Required', body: `Missing required table: ${message}. Please apply all Supabase migrations.`, type: 'schema' };
    }
    return { title: 'Connection Error', body: 'Failed to load threads. Please check your connection and try again.', type: 'generic' };
  }, []);

  useEffect(() => {
    const loadClientsAndThreads = async () => {
      try {
        setLoading(true);
        // Fetch clients from database (all clients)
        const clientsList = await AdminService.clients.listAll();
        setClients(clientsList || []);
        
        // Fetch chat threads
        const data = await AdminService.chat.listThreads();
        setThreads(data);
      } catch (error) {
        console.error('Error loading threads and clients:', error);
        const info = classifyError(error);
        if (info.type === 'auth') {
          Alert.alert(info.title, info.body, [{ text: 'Login', onPress: () => router.replace('/admin-login') }]);
        } else if (info.type === 'schema') {
          Alert.alert(info.title, info.body, [{ text: 'OK' }]);
        } else {
          Alert.alert(info.title, info.body, [{ text: 'Retry', onPress: () => loadClientsAndThreads() }]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadClientsAndThreads();

    const unsubscribe = AdminService.chat.subscribeToThreads(() => {
      loadClientsAndThreads();
    });

    return () => {
      unsubscribe();
    }
  }, []);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter(
      t => t.clientName.toLowerCase().includes(q) || t.clientPhone?.includes(q)
    );
  }, [searchQuery, threads]);

  const totalUnread = useMemo(() => threads.reduce((sum, t) => sum + t.unread, 0), [threads]);

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
          <Pressable 
            style={styles.profileHeaderButton} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowProfileModal(true);
            }}
          >
            <User size={20} color={Colors.gold} />
          </Pressable>
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
        {loading ? (
          <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 40 }} />
        ) : filteredThreads.length > 0 ? (
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

      <Pressable
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setShowNewChatModal(true);
        }}
      >
        <Plus size={24} color={Colors.white} />
      </Pressable>

      <NewChatModal
        visible={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        clients={clients}
        onSelectClient={(client) => {
          setShowNewChatModal(false);
          // Check if thread exists
          const existingThread = threads.find(t => t.clientId === client.id);
          if (existingThread) {
            setSelectedThread(existingThread);
          } else {
            // Create temporary thread object
            setSelectedThread({
              id: 'temp-' + client.id,
              clientId: client.id,
              clientName: client.name,
              clientAvatar: client.user_profiles?.avatar_url || 'https://via.placeholder.com/150',
              clientPhone: client.phone,
              lastMessage: '',
              unread: 0,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isOnline: false,
            });
          }
        }}
      />

      <AdminProfileModal 
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onUpdate={() => {
          // Re-load threads to see changes? 
          // Actually, thread avatars are client avatars, not admin avatars.
          // Admin avatar is used in ChatView and client-side chat screen.
        }}
      />
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
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  closeButton: {
    padding: 5,
  },
  clientList: {
    padding: 20,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  clientPhone: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    marginTop: 20,
  },
  profileHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileAvatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
    position: 'relative',
  },
  profileAvatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  avatarWrapper: {
    position: 'relative',
    borderRadius: 50,
    overflow: 'hidden',
  },
  avatarLoading: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: Colors.gold,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
    marginLeft: 4,
  },
  modalInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  saveButton: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
