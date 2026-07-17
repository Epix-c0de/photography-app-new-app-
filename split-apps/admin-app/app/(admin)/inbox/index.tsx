import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  Send,
  X,
  MessageSquare,
  Phone,
  Plus,
  ChevronRight,
  Camera,
  User,
  CheckCheck,
  ArrowLeft,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { AdminService } from '@/services/admin';

const { width } = Dimensions.get('window');

export type AdminChatThread = {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  lastMessage: string;
  unread: number;
  timestamp: string;
  isOnline: boolean;
  clientPhone: string | null;
};

const adminQuickReplies = [
  "Your photos are ready!",
  "Thanks for booking with us.",
  "Can you confirm the date?",
  "Please complete the payment.",
  "We'll get back to you shortly.",
  "Thank you for your patience!",
];

function formatThreadTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function ThreadItem({ thread, isSelected, onPress, onLongPress }: {
  thread: AdminChatThread;
  isSelected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <Animated.View style={[styles.threadItem, isSelected && styles.threadItemSelected, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.threadAvatarContainer}>
          {thread.clientAvatar ? (
            <Image source={{ uri: thread.clientAvatar }} style={styles.threadAvatar} />
          ) : (
            <LinearGradient colors={[Colors.gold, '#B8860B']} style={styles.threadAvatarFallback}>
              <Text style={styles.threadAvatarInitial}>{thread.clientName.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          )}
          {thread.isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.threadContent}>
          <View style={styles.threadNameRow}>
            <Text style={[styles.threadName, thread.unread > 0 && styles.threadNameUnread]} numberOfLines={1}>
              {thread.clientName}
            </Text>
            <Text style={[styles.threadTimestamp, thread.unread > 0 && styles.threadTimestampUnread]}>
              {formatThreadTime(thread.timestamp)}
            </Text>
          </View>
          <View style={styles.threadMessageRow}>
            <Text style={[styles.threadMessage, thread.unread > 0 && styles.threadMessageUnread]} numberOfLines={1}>
              {thread.lastMessage || 'Start a conversation'}
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

function ChatView({ thread, onBack }: { thread: AdminChatThread; onBack: () => void }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<{
    id: string;
    text: string;
    sender: 'admin' | 'client';
    createdAt: string;
    pending?: boolean;
    read?: boolean;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [isClientOnline, setIsClientOnline] = useState(false);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const clientLastPingRef = useRef<number>(0);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

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
          createdAt: m.created_at,
          read: m.is_read,
        })));
        if (thread.unread > 0) {
          await AdminService.chat.markAsRead(thread.clientId);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      }
    };

    loadMessages();

    unsubscribe = AdminService.chat.subscribeToMessages(thread.clientId, (payload) => {
      if (payload.eventType === 'INSERT') {
        const newMsg = payload.new;
        setMessages(prev => {
          if (prev.some(p => p.id === newMsg.id)) return prev;
          const idx = prev.findIndex(p => p.sender === 'admin' && p.pending && p.text === newMsg.content);
          const mapped = {
            id: newMsg.id,
            text: newMsg.content,
            sender: newMsg.sender_role,
            createdAt: newMsg.created_at,
            read: newMsg.is_read,
          };
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = mapped;
            return next;
          }
          return [...prev, mapped];
        });
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [thread.clientId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let mounted = true;
    async function setupPresence() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      const channel = supabase
        .channel(`presence_admin_${user.id}`)
        .on('broadcast', { event: 'status' }, (msg: any) => {
          const payload = msg?.payload || {};
          if (payload.role === 'client' && payload.clientId === thread.clientId) {
            clientLastPingRef.current = Date.now();
            setIsClientOnline(true);
            if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
            offlineTimerRef.current = setTimeout(() => {
              if (Date.now() - clientLastPingRef.current >= 30000) setIsClientOnline(false);
            }, 32000);
          }
        })
        .subscribe();
      presenceChannelRef.current = channel;
      const sendPing = () => {
        channel.send({
          type: 'broadcast',
          event: 'status',
          payload: { role: 'admin', userId: user.id, ts: Date.now() }
        } as any);
      };
      sendPing();
      interval = setInterval(sendPing, 15000);
    }
    setupPresence();
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [thread.clientId]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = message.trim();
    const localId = 'local-' + Date.now();
    const now = new Date().toISOString();
    setMessages(prev => [...prev, { id: localId, text, sender: 'admin', createdAt: now, pending: true }]);
    setMessage('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
    try {
      await AdminService.chat.sendMessage(thread.clientId, text);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => !m.pending));
      Alert.alert('Error', 'Failed to send message');
    }
  }, [message, sending, thread.clientId]);

  const handleQuickReply = useCallback(async (reply: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const localId = 'reply-' + Date.now();
    const now = new Date().toISOString();

    let messageText = reply;

    // If the quick reply is "Your photos are ready!", fetch the latest gallery access code
    if (reply === 'Your photos are ready!') {
      try {
        // thread.clientId is user_profiles.id; find the client row for this user
        const { data: clientRow } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', thread.clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (clientRow) {
          const { data: gallery } = await supabase
            .from('galleries')
            .select('access_code, name')
            .eq('client_id', clientRow.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (gallery?.access_code) {
            const galleryLabel = gallery.name ? ` for ${gallery.name}` : '';
            messageText = `Your photos are ready${galleryLabel}!\n\nUse code: ${gallery.access_code} to unlock.`;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch gallery access code:', e);
        // Fall back to the plain reply
      }
    }

    setMessages(prev => [...prev, { id: localId, text: messageText, sender: 'admin', createdAt: now, pending: true }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
    try {
      await AdminService.chat.sendMessage(thread.clientId, messageText);
    } catch (error) {
      setMessages(prev => prev.filter(m => !m.pending));
    }
  }, [thread.clientId]);

  const handlePhonePress = useCallback(() => {
    if (thread.clientPhone) {
      Linking.openURL(`tel:${thread.clientPhone}`);
    } else {
      Alert.alert('No Phone', 'Client phone number not available');
    }
  }, [thread.clientPhone]);

  // Group messages by date for separators
  const groupedMessages = useMemo(() => {
    const groups: { date: string; items: typeof messages }[] = [];
    let currentDate = '';
    messages.forEach(msg => {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.createdAt, items: [] });
      }
      groups[groups.length - 1].items.push(msg);
    });
    return groups;
  }, [messages]);

  return (
    <View style={styles.chatContainer}>
      {/* Chat Header */}
      <View style={[styles.chatHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} style={styles.chatBackBtn}>
          <ArrowLeft size={20} color={Colors.white} />
        </Pressable>
        {thread.clientAvatar ? (
          <Image source={{ uri: thread.clientAvatar }} style={styles.chatHeaderAvatar} />
        ) : (
          <LinearGradient colors={[Colors.gold, '#B8860B']} style={styles.chatHeaderAvatarFallback}>
            <Text style={styles.chatHeaderAvatarText}>{thread.clientName.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        )}
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName} numberOfLines={1}>{thread.clientName}</Text>
          <View style={styles.chatHeaderStatusRow}>
            <View style={[styles.statusDot, { backgroundColor: isClientOnline ? '#22C55E' : Colors.textMuted }]} />
            <Text style={[styles.chatHeaderText, { color: isClientOnline ? '#22C55E' : Colors.textMuted }]}>
              {isClientOnline ? 'Online now' : 'Offline'}
            </Text>
          </View>
        </View>
        <Pressable style={styles.chatActionBtn} onPress={() => router.push(`/(admin)/upload?userId=${thread.clientId}` as any)}>
          <Camera size={18} color={Colors.gold} />
        </Pressable>
        <Pressable style={styles.chatActionBtn} onPress={handlePhonePress}>
          <Phone size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={[styles.messagesContent, { paddingBottom: 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingMessages}>
            <ActivityIndicator size="small" color={Colors.gold} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <View style={styles.emptyChatIcon}>
              <MessageSquare size={32} color={Colors.gold} />
            </View>
            <Text style={styles.emptyChatTitle}>Start the conversation</Text>
            <Text style={styles.emptyChatSubtitle}>Send a message to {thread.clientName}</Text>
          </View>
        ) : (
          groupedMessages.map((group, gi) => (
            <View key={gi}>
              {/* Date separator */}
              <View style={styles.dateSeparator}>
                <View style={styles.dateSeparatorLine} />
                <Text style={styles.dateSeparatorText}>{formatDateSeparator(group.date)}</Text>
                <View style={styles.dateSeparatorLine} />
              </View>
              {group.items.map((msg) => (
                <View key={msg.id} style={[styles.messageRow, msg.sender === 'admin' && styles.messageRowAdmin]}>
                  <View style={[styles.messageBubble, msg.sender === 'admin' ? styles.adminBubble : styles.clientBubble]}>
                    <Text style={[styles.messageText, msg.sender === 'admin' && styles.adminMessageText]}>
                      {msg.text}
                    </Text>
                    <View style={[styles.messageMeta, msg.sender === 'admin' && styles.messageMetaAdmin]}>
                      <Text style={[styles.messageTime, msg.sender === 'admin' && styles.adminMessageTime]}>
                        {formatMessageTime(msg.createdAt)}
                      </Text>
                      {msg.sender === 'admin' && (
                        <CheckCheck size={14} color={msg.read ? '#22C55E' : 'rgba(255,255,255,0.4)'} />
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Quick Replies */}
      <View style={styles.quickRepliesBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesContent}>
          {adminQuickReplies.map((reply, index) => (
            <Pressable key={index} style={styles.quickReplyPill} onPress={() => handleQuickReply(reply)}>
              <Text style={styles.quickReplyPillText} numberOfLines={1}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Input Bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.chatInput}
            placeholder={`Message ${thread.clientName}...`}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!message.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.background} />
            ) : (
              <Send size={18} color={message.trim() ? Colors.background : Colors.textMuted} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function NewChatModal({ visible, onClose, clients, onSelectClient }: {
  visible: boolean;
  onClose: () => void;
  clients: any[];
  onSelectClient: (client: any) => void;
}) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q));
  }, [clients, searchQuery]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New Message</Text>
          <Pressable onPress={onClose} style={styles.modalCloseBtn}>
            <X size={22} color={Colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.modalSearch}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.modalSearchInput}
            placeholder="Search clients..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
        <ScrollView contentContainerStyle={styles.clientList} showsVerticalScrollIndicator={false}>
          {filteredClients.map(client => (
            <Pressable key={client.id} style={styles.clientListItem} onPress={() => onSelectClient(client)}>
              {client.user_profiles?.avatar_url ? (
                <Image source={{ uri: client.user_profiles.avatar_url }} style={styles.clientListAvatar} />
              ) : (
                <LinearGradient colors={[Colors.gold, '#B8860B']} style={styles.clientListAvatarFallback}>
                  <Text style={styles.clientListAvatarText}>{(client.name || '?').charAt(0).toUpperCase()}</Text>
                </LinearGradient>
              )}
              <View style={styles.clientListInfo}>
                <Text style={styles.clientListName}>{client.name || 'Unknown'}</Text>
                {client.phone && <Text style={styles.clientListPhone}>{client.phone}</Text>}
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </Pressable>
          ))}
          {filteredClients.length === 0 && (
            <View style={styles.modalEmpty}>
              <User size={40} color="rgba(255,255,255,0.15)" />
              <Text style={styles.modalEmptyText}>No clients found</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function AdminInboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminAvatar, setAdminAvatar] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThread, setSelectedThread] = useState<AdminChatThread | null>(null);
  const [threads, setThreads] = useState<AdminChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const loadClientsAndThreads = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('name, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) {
          setAdminName(profile.name ?? null);
          setAdminAvatar(profile.avatar_url ?? null);
          setAvatarVersion(v => v + 1);
        }
      }
      const clientsList = await AdminService.clients.listAll();
      setClients(clientsList || []);
      const data = await AdminService.chat.listThreads();
      setThreads(data);
    } catch (error) {
      console.error('Error loading threads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadClientsAndThreads();

    let profileUnsub: (() => void) | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const channel = supabase
          .channel(`admin_profile_header_${user.id}`)
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
            (payload) => {
              const updated = payload.new as any;
              setAdminName(updated?.name ?? null);
              setAdminAvatar(updated?.avatar_url ?? null);
              setAvatarVersion(v => v + 1);
            }
          )
          .subscribe();
        profileUnsub = () => supabase.removeChannel(channel);
      }
    })();

    const unsubscribe = AdminService.chat.subscribeToThreads(() => {
      loadClientsAndThreads(true);
    });

    return () => {
      unsubscribe();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter(t => t.clientName.toLowerCase().includes(q) || t.clientPhone?.includes(q));
  }, [searchQuery, threads]);

  const totalUnread = useMemo(() => threads.reduce((sum, t) => sum + t.unread, 0), [threads]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await AdminService.chat.markAllRead();
      setThreads(prev => prev.map(t => ({ ...t, unread: 0 })));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, []);

  // Chat view
  if (selectedThread) {
    return (
      <View style={[styles.container, { paddingTop: 0 }]}>
        <ChatView
          thread={selectedThread}
          onBack={() => {
            setSelectedThread(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            loadClientsAndThreads(true);
          }}
        />
      </View>
    );
  }

  // Thread list
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Inbox</Text>
            <Text style={styles.headerSub}>
              {totalUnread > 0 ? `${totalUnread} unread` : 'All caught up'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {totalUnread > 0 && (
              <Pressable style={styles.headerActionBtn} onPress={handleMarkAllRead}>
                <CheckCheck size={18} color={Colors.gold} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={14} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.threadList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadClientsAndThreads(true)}
            tintColor={Colors.gold}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
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
            <View style={styles.emptyIconContainer}>
              <MessageSquare size={40} color={Colors.gold} />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matches found' : 'No conversations yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search' : 'Messages from clients will appear here'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setShowNewChatModal(true);
        }}
      >
        <LinearGradient colors={[Colors.gold, '#B8860B']} style={styles.fabGradient}>
          <Plus size={24} color={Colors.background} strokeWidth={2.5} />
        </LinearGradient>
      </Pressable>

      <NewChatModal
        visible={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        clients={clients}
        onSelectClient={(client) => {
          setShowNewChatModal(false);
          const existingThread = threads.find(t => t.clientId === client.id);
          if (existingThread) {
            setSelectedThread(existingThread);
          } else {
            setSelectedThread({
              id: 'temp-' + client.id,
              clientId: client.id,
              clientName: client.name || 'Unknown',
              clientAvatar: client.user_profiles?.avatar_url || null,
              clientPhone: client.phone,
              lastMessage: '',
              unread: 0,
              timestamp: new Date().toISOString(),
              isOnline: false,
            });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerLeft: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.white, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, paddingHorizontal: 14, height: 44, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.white },

  // Thread List
  threadList: { paddingTop: 4, paddingBottom: 100 },
  threadItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    gap: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  threadItemSelected: { backgroundColor: 'rgba(212,175,55,0.04)' },
  threadAvatarContainer: { position: 'relative' },
  threadAvatar: { width: 52, height: 52, borderRadius: 16 },
  threadAvatarFallback: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  threadAvatarInitial: { fontSize: 20, fontWeight: '700', color: Colors.background },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22C55E', borderWidth: 2.5, borderColor: Colors.background,
  },
  threadContent: { flex: 1 },
  threadNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  threadName: { fontSize: 15, fontWeight: '600', color: Colors.white, flex: 1, marginRight: 8 },
  threadNameUnread: { fontWeight: '700' },
  threadTimestamp: { fontSize: 11, color: Colors.textMuted },
  threadTimestampUnread: { color: Colors.gold, fontWeight: '600' },
  threadMessageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  threadMessage: { flex: 1, fontSize: 13, color: Colors.textMuted },
  threadMessageUnread: { color: Colors.textSecondary, fontWeight: '500' },
  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.background },

  // Chat
  chatContainer: { flex: 1, backgroundColor: Colors.background },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(8,8,16,0.95)',
  },
  chatBackBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  chatHeaderAvatar: { width: 42, height: 42, borderRadius: 14 },
  chatHeaderAvatarFallback: {
    width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  chatHeaderAvatarText: { fontSize: 16, fontWeight: '700', color: Colors.background },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { fontSize: 16, fontWeight: '700', color: Colors.white },
  chatHeaderStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  chatHeaderText: { fontSize: 11, fontWeight: '500' },
  chatActionBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Messages
  messagesScroll: { flex: 1 },
  messagesContent: { padding: 16, gap: 4 },
  loadingMessages: { alignItems: 'center', paddingTop: 40, gap: 8 },
  loadingText: { fontSize: 13, color: Colors.textMuted },
  emptyChat: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyChatIcon: {
    width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyChatTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  emptyChatSubtitle: { fontSize: 14, color: Colors.textMuted },

  // Date Separator
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12 },
  dateSeparatorLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  dateSeparatorText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Message Bubbles
  messageRow: { marginBottom: 4, alignItems: 'flex-start' },
  messageRowAdmin: { alignItems: 'flex-end' },
  messageBubble: {
    maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18,
  },
  clientBubble: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  adminBubble: {
    backgroundColor: Colors.gold, borderBottomRightRadius: 6,
  },
  messageText: { fontSize: 14, color: Colors.white, lineHeight: 20 },
  adminMessageText: { color: Colors.background },
  messageMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-end' },
  messageMetaAdmin: {},
  messageTime: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  adminMessageTime: { color: 'rgba(8,8,16,0.5)' },

  // Quick Replies
  quickRepliesBar: {
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', paddingVertical: 10,
    backgroundColor: 'rgba(8,8,16,0.5)',
  },
  quickRepliesContent: { paddingHorizontal: 16, gap: 8 },
  quickReplyPill: {
    backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  quickReplyPillText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },

  // Input Bar
  inputBar: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(8,8,16,0.8)' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  chatInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22,
    paddingHorizontal: 18, paddingVertical: 12, fontSize: 15, color: Colors.white,
    maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },

  // FAB
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28 },
  fabGradient: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },

  // Empty State
  loadingContainer: { alignItems: 'center', paddingTop: 60 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIconContainer: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  modalCloseBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalSearch: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 12, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 14, height: 44, gap: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  modalSearchInput: { flex: 1, fontSize: 14, color: Colors.white },
  clientList: { paddingHorizontal: 20, paddingBottom: 40 },
  clientListItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 14,
  },
  clientListAvatar: { width: 46, height: 46, borderRadius: 14 },
  clientListAvatarFallback: {
    width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  clientListAvatarText: { fontSize: 18, fontWeight: '700', color: Colors.background },
  clientListInfo: { flex: 1 },
  clientListName: { fontSize: 15, fontWeight: '600', color: Colors.white },
  clientListPhone: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  modalEmpty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  modalEmptyText: { fontSize: 14, color: Colors.textMuted },
});
