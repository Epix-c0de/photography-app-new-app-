import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, AppState } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Send, Clock, Check, CheckCheck, Paperclip, User } from 'lucide-react-native';
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
  const [messageClientId, setMessageClientId] = useState<string | null>(null);
  const [ownerAdminId, setOwnerAdminId] = useState<string | null>(null);
  const [adminAvatar, setAdminAvatar] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [adminOnline, setAdminOnline] = useState<boolean>(false);
  const adminLastPingRef = useRef<number>(0);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

        // Fetch all available admins first
        const { data: allAdmins, error: adminError } = await supabase
          .from('user_profiles')
          .select('id, name, avatar_url, updated_at')
          .in('role', ['admin', 'super_admin'])
          .order('created_at', { ascending: true });

        if (adminError) {
          console.error('[Chat] Error fetching admins:', adminError);
        }

        const admins = allAdmins || [];

        const chooseBestAdmin = (candidates: any[]) => {
          if (!candidates || candidates.length === 0) return null;
          const scored = [...candidates].sort((a, b) => {
            const aHasAvatar = !!a?.avatar_url;
            const bHasAvatar = !!b?.avatar_url;
            if (aHasAvatar !== bHasAvatar) return aHasAvatar ? -1 : 1;

            const aName = String(a?.name ?? '');
            const bName = String(b?.name ?? '');
            const aLooksLikeEmail = aName.includes('@');
            const bLooksLikeEmail = bName.includes('@');
            if (aLooksLikeEmail !== bLooksLikeEmail) return aLooksLikeEmail ? 1 : -1;

            const aUpdated = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
            const bUpdated = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
            return bUpdated - aUpdated;
          });
          return scored[0] ?? null;
        };

        // If we have an adminId but that admin looks like a fresh/unconfigured account
        // (email as name + no avatar), prefer the best-looking admin from the list.
        if (adminId && admins.length > 0) {
          const selected = admins.find((a) => a.id === adminId);
          const selectedName = String(selected?.name ?? '');
          const selectedLooksLikeEmail = selectedName.includes('@');
          const selectedHasAvatar = !!selected?.avatar_url;

          if (selectedLooksLikeEmail && !selectedHasAvatar) {
            const best = chooseBestAdmin(admins);
            if (best?.id) {
              adminId = best.id;
            }
          }
        }

        if (!adminId) {
          // Check if user already has a linked client record with ANY admin
          const { data: existingClients } = await supabase
            .from('clients')
            .select('id, owner_admin_id')
            .eq('user_id', authUser.id);

          // If we have existing client records, choose the BEST admin among the linked ones
          if (existingClients && existingClients.length > 0) {
            const linkedAdminIds = Array.from(
              new Set((existingClients || []).map((c: any) => c.owner_admin_id).filter(Boolean))
            ) as string[];
            const linkedAdmins = admins.filter((a) => linkedAdminIds.includes(a.id));
            const bestLinked = chooseBestAdmin(linkedAdmins);
            if (bestLinked?.id) {
              adminId = bestLinked.id;
            }
          }
        }

        if (!adminId && admins.length > 0) {
          // Fallback: pick the best available admin
          adminId = chooseBestAdmin(admins)?.id ?? admins[0].id;
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
        // First, try to use the admin data we already fetched from allAdmins
        const adminFromList = admins.find(a => a.id === adminId);
        let adminProfileName = adminFromList?.name ?? null;
        let adminProfileAvatar = adminFromList?.avatar_url ?? null;
        
        // Also fetch fresh data from user_profiles to ensure it's up to date
        const { data: adminProfile } = await supabase
          .from('user_profiles')
          .select('id, name, avatar_url, updated_at')
          .eq('id', adminId)
          .maybeSingle();
        
        // Use fresh data if available, otherwise fallback to list data
        const finalAdminName = adminProfile?.name ?? adminProfileName;
        const finalAdminAvatar = adminProfile?.avatar_url ?? adminProfileAvatar;
        
        console.log('[Chat] Admin profile loaded:', { 
          adminId, 
          finalAdminName, 
          finalAdminAvatar,
          fromList: adminFromList?.name,
          fromDb: adminProfile?.name 
        });

        // ── Step 4: Fetch existing messages ──
        const messageClientCandidates = Array.from(new Set([clientId, authUser.id].filter(Boolean))) as string[];
        const { data: existingMsgs } = await supabase
          .from('messages')
          .select('*')
          .in('client_id', messageClientCandidates)
          .order('created_at', { ascending: true });

        const preferredMessageClientId =
          (existingMsgs ?? []).some((m: any) => m.client_id === authUser.id)
            ? authUser.id
            : clientId;

        if (!cancelled) {
          setOwnerAdminId(adminId);
          setClientRowId(clientId);
          setMessageClientId(preferredMessageClientId);
          setAdminName(finalAdminName);
          setAdminAvatar(finalAdminAvatar);
          setAvatarVersion((v) => v + 1);
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
    if (!messageClientId) return;

    const channel = supabase
      .channel(`chat_messages_${messageClientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${messageClientId}`,
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
  }, [messageClientId]);

  // ─── Real-time: admin profile changes ──────────────────────────────────────
  useEffect(() => {
    if (!ownerAdminId) return;

    // Poll admin profile every 5 seconds for faster updates
    const fetchAdminProfile = async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('name, avatar_url, updated_at')
          .eq('id', ownerAdminId)
          .maybeSingle();
        if (data) {
          setAdminName(data.name ?? null);
          setAdminAvatar(data.avatar_url ?? null);
          setAvatarVersion((v) => v + 1);
        }
      } catch (error) {
        console.error('[Chat] Error fetching admin profile:', error);
      }
    };

    // Initial fetch
    fetchAdminProfile();

    // Poll every 5 seconds
    const pollInterval = setInterval(fetchAdminProfile, 5000);

    // Refetch when app comes to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchAdminProfile();
    });

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
          setAvatarVersion((v) => v + 1);
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      sub.remove();
      supabase.removeChannel(channel);
    };
  }, [ownerAdminId]);

  // ─── Presence: admin online/offline ────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let mounted = true;
    async function setupPresence() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !ownerAdminId || !user) return;
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      const channel = supabase
        .channel(`presence_admin_${ownerAdminId}`)
        .on('broadcast', { event: 'status' }, (msg: any) => {
          try {
            const payload = msg?.payload || {};
            if (payload.role === 'admin' && payload.userId === ownerAdminId) {
              adminLastPingRef.current = Date.now();
              setAdminOnline(true);
              if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
              offlineTimerRef.current = setTimeout(() => {
                if (Date.now() - adminLastPingRef.current >= 60000) {
                  setAdminOnline(false);
                }
              }, 62000);
            }
          } catch {}
        })
        .subscribe();
      presenceChannelRef.current = channel;
      const sendPing = () => {
        channel.send({
          type: 'broadcast',
          event: 'status',
          payload: { role: 'client', clientId: clientRowId, userId: user.id, ts: Date.now() }
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
  }, [ownerAdminId, clientRowId]);

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
      // Get the current user to verify identity
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const preferredClientId = messageClientId ?? clientRowId;

      let { error, data } = await supabase
        .from('messages')
        .insert({
          client_id: preferredClientId,
          owner_admin_id: ownerAdminId,
          sender_role: 'client',
          content: textToSend,
          is_read: false,
        })
        .select();

      if (error && error.message?.includes('messages_client_id_fkey') && preferredClientId !== user.id) {
        const retry = await supabase
          .from('messages')
          .insert({
            client_id: user.id,
            owner_admin_id: ownerAdminId,
            sender_role: 'client',
            content: textToSend,
            is_read: false,
          })
          .select();
        error = retry.error;
        data = retry.data;
        if (!error) {
          setMessageClientId(user.id);
        }
      }

      if (error) throw error;
      if (data && data[0]) {
        const m = data[0] as any;
        setMessages((prev) => [
          ...prev,
          {
            id: m.id,
            text: m.content,
            sender: m.sender_role,
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: m.is_read,
          },
        ]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch (e: any) {
      console.error('[Chat] Send error:', e);
      setInputText(textToSend);
      Alert.alert('Error', `Failed to send message: ${e.message || 'Please try again.'}`);
    }
  }, [inputText, sendScale, clientRowId, messageClientId, ownerAdminId]);

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
        {adminAvatar ? (
          <Image
            source={{
              uri: `${adminAvatar}${adminAvatar.includes('?') ? '&' : '?'}v=${avatarVersion}`
            }}
            style={styles.headerAvatar}
            contentFit="cover"
          />
        ) : (
          <View style={styles.headerAvatarPlaceholder}>
            <User size={20} color={Colors.gold} />
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{adminName || brandName}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.onlineDot, !adminOnline && styles.offlineDot]} />
            <Text style={styles.statusLabel}>
              {adminOnline ? 'Online • Usually replies instantly' : 'Offline • Typically responds within office hours'}
            </Text>
          </View>
        </View>
      </View>

      {!adminOnline && (
        <View style={styles.officeHoursBanner}>
          <Clock size={14} color={Colors.gold} />
          <Text style={styles.officeHoursText}>
            We&apos;re currently offline. We&apos;ll respond as soon as we&apos;re back online.
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
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
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
