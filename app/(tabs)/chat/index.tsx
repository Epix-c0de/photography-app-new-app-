import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Send, Clock, Check, CheckCheck, Paperclip } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useBranding } from '@/contexts/BrandingContext';
import { supabase } from '@/lib/supabase';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'client' | 'admin';
  timestamp: string;
  read: boolean;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isClient = message.sender === 'client';

  return (
    <View style={[styles.messageBubbleRow, isClient && styles.messageBubbleRowClient]}>
      <View style={[styles.messageBubble, isClient ? styles.clientBubble : styles.photoBubble]}>
        <Text style={[styles.messageText, isClient && styles.clientMessageText]}>{message.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isClient && styles.clientMessageTime]}>{message.timestamp}</Text>
          {isClient && (
            message.read
              ? <CheckCheck size={12} color={Colors.gold} />
              : <Check size={12} color={Colors.textMuted} />
          )}
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { initialMessage } = useLocalSearchParams<{ initialMessage: string }>();
  const insets = useSafeAreaInsets();
  const { brandName, logoUrl, activeAdminId } = useBranding();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>(initialMessage || '');

  // clientRowId = the ID from the "clients" table (not auth user id)
  const [clientRowId, setClientRowId] = useState<string | null>(null);
  const [ownerAdminId, setOwnerAdminId] = useState<string | null>(null);
  const [adminAvatar, setAdminAvatar] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  // ─── INIT: resolve client row + admin ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function initChat() {
      setIsLoading(true);
      setInitError(null);

      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          if (!cancelled) setInitError('Not signed in. Please log in and try again.');
          return;
        }

        // ── Step 1: Find or pick the admin to chat with ──
        let adminId: string | null = activeAdminId ?? null;

        if (!adminId) {
          // Check if user already has a linked client record with an admin
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id, owner_admin_id')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (existingClient?.owner_admin_id) {
            adminId = existingClient.owner_admin_id;
          }
        }

        if (!adminId) {
          // Last resort: pick first admin/super_admin alphabetically
          const { data: firstAdmin } = await supabase
            .from('user_profiles')
            .select('id')
            .in('role', ['admin', 'super_admin'])
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          adminId = firstAdmin?.id ?? null;
        }

        if (!adminId) {
          if (!cancelled) setInitError('No admin found. Please contact support.');
          return;
        }

        // ── Step 2: Ensure a client row exists for this user + admin ──
        let clientId: string | null = null;

        const { data: existingRow } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('owner_admin_id', adminId)
          .maybeSingle();

        if (existingRow?.id) {
          clientId = existingRow.id;
        } else {
          // Create the client row
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('name, phone, email')
            .eq('id', authUser.id)
            .maybeSingle();

          const { data: newRow, error: insertError } = await supabase
            .from('clients')
            .insert({
              owner_admin_id: adminId,
              user_id: authUser.id,
              name: profile?.name ?? authUser.email ?? 'Client',
              phone: profile?.phone ?? null,
              email: profile?.email ?? authUser.email ?? null,
            })
            .select('id')
            .single();

          if (insertError) {
            // Could already exist due to a race condition — try fetching again
            const { data: retryRow } = await supabase
              .from('clients')
              .select('id')
              .eq('user_id', authUser.id)
              .eq('owner_admin_id', adminId)
              .maybeSingle();
            clientId = retryRow?.id ?? null;
          } else {
            clientId = newRow?.id ?? null;
          }
        }

        if (!clientId) {
          if (!cancelled) setInitError('Could not set up your chat profile. Please try again.');
          return;
        }

        // ── Step 3: Fetch admin profile ──
        const { data: adminProfile } = await supabase
          .from('user_profiles')
          .select('id, name, avatar_url')
          .eq('id', adminId)
          .maybeSingle();

        // ── Step 4: Fetch existing messages ──
        const { data: existingMsgs } = await supabase
          .from('messages')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: true });

        if (!cancelled) {
          setOwnerAdminId(adminId);
          setClientRowId(clientId);
          setAdminName(adminProfile?.name ?? null);
          setAdminAvatar(adminProfile?.avatar_url ?? null);
          setMessages(
            (existingMsgs ?? []).map((m: any) => ({
              id: m.id,
              text: m.content,
              sender: m.sender_role,
              timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              read: m.is_read,
            }))
          );
        }
      } catch (e: any) {
        console.error('[Chat] Init error:', e);
        if (!cancelled) setInitError('Failed to load chat. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    initChat();
    return () => { cancelled = true; };
  }, [activeAdminId]);

  // ─── Real-time: new messages ────────────────────────────────────────────────
  useEffect(() => {
    if (!clientRowId) return;

    const channel = supabase
      .channel(`chat_messages_${clientRowId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${clientRowId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              {
                id: newMsg.id,
                text: newMsg.content,
                sender: newMsg.sender_role,
                timestamp: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                read: newMsg.is_read,
              },
            ];
          });
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientRowId]);

  // ─── Real-time: admin profile changes ──────────────────────────────────────
  useEffect(() => {
    if (!ownerAdminId) return;

    // Poll admin profile every 30 seconds as a reliable fallback
    // (realtime filter on non-primary-key columns needs Supabase Row Level Security setup)
    const fetchAdminProfile = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('name, avatar_url')
        .eq('id', ownerAdminId)
        .maybeSingle();
      if (data) {
        setAdminName(data.name ?? null);
        setAdminAvatar(data.avatar_url ?? null);
      }
    };

    // Also subscribe to realtime updates
    const channel = supabase
      .channel(`admin_profile_${ownerAdminId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${ownerAdminId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setAdminName(updated.name ?? null);
          setAdminAvatar(updated.avatar_url ?? null);
        }
      )
      .subscribe();

    // Poll every 30s as backup if realtime filter isn't configured
    const pollInterval = setInterval(fetchAdminProfile, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [ownerAdminId]);

  // ─── SEND ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;

    if (!clientRowId || !ownerAdminId) {
      Alert.alert(
        'Chat Not Ready',
        'The chat is still initializing. Please wait a moment and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    const textToSend = inputText.trim();
    setInputText('');

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          client_id: clientRowId,
          owner_admin_id: ownerAdminId,
          sender_role: 'client',
          content: textToSend,
          is_read: false,
        });

      if (error) throw error;
    } catch (e: any) {
      console.error('[Chat] Send error:', e);
      setInputText(textToSend);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  }, [inputText, sendScale, clientRowId, ownerAdminId]);

  const isOfficeHours = () => {
    const hour = new Date().getHours();
    return hour >= 8 && hour < 18;
  };

  // ─── LOADING ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={{ color: Colors.textSecondary, marginTop: 16 }}>Setting up chat...</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
        <Text style={{ color: Colors.textMuted, textAlign: 'center', marginBottom: 20 }}>{initError}</Text>
        <Pressable
          onPress={() => {
            setIsLoading(true);
            setInitError(null);
          }}
          style={{ backgroundColor: Colors.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: Colors.background, fontWeight: '600' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Image
          source={{ uri: adminAvatar || logoUrl || 'https://images.unsplash.com/photo-1552642986-ccb41e7059e7?w=100&h=100&fit=crop' }}
          style={styles.headerAvatar}
          contentFit="cover"
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{adminName || brandName}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.onlineDot, !isOfficeHours() && styles.offlineDot]} />
            <Text style={styles.statusLabel}>
              {isOfficeHours() ? 'Online • Usually replies instantly' : 'Office hours: 8AM - 6PM'}
            </Text>
          </View>
        </View>
      </View>

      {!isOfficeHours() && (
        <View style={styles.officeHoursBanner}>
          <Clock size={14} color={Colors.gold} />
          <Text style={styles.officeHoursText}>
            We&apos;re currently outside office hours. We&apos;ll respond first thing in the morning.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No messages yet. Start a conversation!</Text>
            </View>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable style={styles.attachButton} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
            <Paperclip size={20} color={Colors.textSecondary} />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <Pressable onPress={handleSend} disabled={!inputText.trim()}>
            <Animated.View style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled, { transform: [{ scale: sendScale }] }]}>
              <Send size={20} color={Colors.white} />
            </Animated.View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  offlineDot: {
    backgroundColor: Colors.textMuted,
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  officeHoursBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  officeHoursText: {
    flex: 1,
    fontSize: 12,
    color: Colors.gold,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    gap: 16,
    flexGrow: 1,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  messageBubbleRowClient: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  photoBubble: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 4,
  },
  clientBubble: {
    backgroundColor: Colors.gold,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: Colors.white,
    lineHeight: 22,
  },
  clientMessageText: {
    color: Colors.background,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  clientMessageTime: {
    color: 'rgba(0,0,0,0.5)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 12,
  },
  attachButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    color: Colors.white,
    fontSize: 15,
    maxHeight: 100,
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
    backgroundColor: Colors.card,
    opacity: 0.5,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
