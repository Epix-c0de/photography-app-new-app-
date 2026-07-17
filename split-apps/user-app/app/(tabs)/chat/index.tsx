import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, AppState, Keyboard } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Send, Clock, Check, CheckCheck, Paperclip, User, Sparkles, Images, CreditCard, CalendarDays, ChevronRight, ArrowLeft, Image as ImageIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useBranding } from '@/contexts/BrandingContext';
import { useAuth } from '@/contexts/AuthContext';
import { demoMessages, demoProfile } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { useAssignmentStatus } from '@/hooks/useAssignmentStatus';
import UnassignedEmptyState from '@/components/UnassignedEmptyState';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'client' | 'admin';
  timestamp: string;
  read: boolean;
  createdAt?: string;
  kind?: 'text' | 'system' | 'invoice' | 'gallery_ready' | 'booking_confirmation';
}

const quickActions = [
  { label: 'Send inquiry', icon: Sparkles, message: 'Hi, I would love to send an inquiry about a shoot.' },
  { label: 'Ask about delivery', icon: Images, message: 'Hi, can you share an update on gallery delivery timing?' },
  { label: 'Request edit', icon: CreditCard, message: 'Hi, I would like to request an edit on a delivered image.' },
];

const quickReplies = [
  'What is my delivery timeline?',
  'Can I unlock my gallery today?',
  'I want to confirm my booking details.',
  'Can you help with payment?',
];

function inferMessageKind(text: string): ChatMessage['kind'] {
  const normalized = text.toLowerCase();
  if (normalized.includes('invoice') || normalized.includes('deposit') || normalized.includes('payment link')) {
    return 'invoice';
  }
  if (normalized.includes('gallery ready') || normalized.includes('gallery is ready') || normalized.includes('photos are ready')) {
    return 'gallery_ready';
  }
  if (normalized.includes('booking confirmed') || normalized.includes('shoot booked') || normalized.includes('confirmed for')) {
    return 'booking_confirmation';
  }
  if (normalized.includes('conversation started') || normalized.includes('system update')) {
    return 'system';
  }
  return 'text';
}

function StructuredMessageCard({ message, onCtaPress }: { message: ChatMessage; onCtaPress?: () => void }) {
  const isClient = message.sender === 'client';
  const cardStyles = [styles.structuredCard, isClient ? styles.clientStructuredCard : styles.adminStructuredCard];

  if (message.kind === 'system') {
    return (
      <View style={styles.systemMessageWrap}>
        <View style={styles.systemMessagePill}>
          <Sparkles size={12} color={Colors.gold} />
          <Text style={styles.systemMessageText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  let icon = <Sparkles size={16} color={Colors.gold} />;
  let eyebrow = 'Studio update';
  let title = 'Conversation update';
  let cta = 'Review';

  if (message.kind === 'invoice') {
    icon = <CreditCard size={16} color={Colors.gold} />;
    eyebrow = 'Invoice';
    title = 'Payment details shared';
    cta = 'Review payment';
  } else if (message.kind === 'gallery_ready') {
    icon = <Images size={16} color={Colors.gold} />;
    eyebrow = 'Gallery ready';
    title = 'Your gallery is ready to view';
    cta = 'Open gallery';
  } else if (message.kind === 'booking_confirmation') {
    icon = <CalendarDays size={16} color={Colors.gold} />;
    eyebrow = 'Booking confirmed';
    title = 'Your session details are locked in';
    cta = 'See booking';
  }

  return (
    <View style={[styles.messageBubbleRow, isClient && styles.messageBubbleRowClient]}>
      <View style={cardStyles}>
        <View style={styles.structuredHeader}>
          <View style={styles.structuredIcon}>{icon}</View>
          <View style={styles.structuredHeaderCopy}>
            <Text style={styles.structuredEyebrow}>{eyebrow}</Text>
            <Text style={styles.structuredTitle}>{title}</Text>
          </View>
        </View>
        <Text style={styles.structuredBody}>{message.text}</Text>
        <View style={styles.structuredFooter}>
          <Text style={styles.structuredTime}>{message.timestamp}</Text>
          <Pressable style={styles.structuredCta} onPress={onCtaPress}>
            <Text style={styles.structuredCtaText}>{cta}</Text>
            <ChevronRight size={14} color={Colors.gold} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MessageBubble({ message, onStructuredCtaPress }: { message: ChatMessage; onStructuredCtaPress?: (kind: string) => void }) {
  if (message.kind && message.kind !== 'text') {
    return <StructuredMessageCard message={message} onCtaPress={() => onStructuredCtaPress?.(message.kind || 'text')} />;
  }

  const isClient = message.sender === 'client';

  return (
    <View style={[styles.messageBubbleRow, isClient && styles.messageBubbleRowClient]}>
      <View style={[styles.messageBubble, isClient ? styles.clientBubble : styles.photoBubble]}>
        <Text style={[styles.messageText, isClient && styles.clientMessageText]}>{message.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isClient && styles.clientMessageTime]}>{message.timestamp}</Text>
          {isClient && (
            <>
              <Text style={[styles.receiptText, message.read && styles.receiptTextRead]}>
                {message.read ? 'Read' : 'Delivered'}
              </Text>
              {message.read
                ? <CheckCheck size={12} color={Colors.gold} />
                : <Check size={12} color={Colors.textMuted} />}
            </>
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
  const { isDemoMode } = useAuth();
  const { isAssigned, loading: assignmentLoading } = useAssignmentStatus();

  // ── Multi-photographer thread list ──────────────────────────────────────────
  const [threadCheckDone, setThreadCheckDone] = useState(false);
  const [multiAdmin, setMultiAdmin] = useState(false);
  const [selectedThreadAdminId, setSelectedThreadAdminId] = useState<string | null>(null);
  const [adminThreads, setAdminThreads] = useState<Array<{
    adminId: string; adminName: string; adminAvatar: string | null;
    lastMessage: string; lastMessageAt: string; unreadCount: number;
  }>>([]);

  useEffect(() => {
    // Skip thread check entirely for unassigned users
    if (!isDemoMode && !assignmentLoading && !isAssigned) {
      setThreadCheckDone(true);
      return;
    }
    // Wait for assignment to finish loading before doing thread check
    if (assignmentLoading) return;
    if (isDemoMode) { setThreadCheckDone(true); return; }
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setThreadCheckDone(true); return; }

        const { data: clientRows } = await supabase
          .from('clients').select('id, owner_admin_id').eq('user_id', user.id);

        const adminIds = [...new Set((clientRows || []).map((c: any) => c.owner_admin_id).filter(Boolean))];
        if (adminIds.length <= 1) { setThreadCheckDone(true); return; }

        const { data: profiles } = await supabase
          .from('user_profiles').select('id, name, avatar_url').in('id', adminIds);

        const threads = await Promise.all((profiles || []).map(async (admin: any) => {
          const { data: lm } = await supabase.from('messages').select('content, created_at')
            .eq('client_id', user.id).eq('owner_admin_id', admin.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
          const { count: unread } = await supabase.from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', user.id).eq('owner_admin_id', admin.id)
            .eq('sender_role', 'admin').eq('is_read', false);
          return {
            adminId: admin.id, adminName: admin.name || 'Photographer',
            adminAvatar: admin.avatar_url,
            lastMessage: lm?.content || 'No messages yet',
            lastMessageAt: lm?.created_at || '',
            unreadCount: unread || 0,
          };
        }));

        threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
        setAdminThreads(threads);
        setMultiAdmin(true);
      } catch {}
      setThreadCheckDone(true);
    })();
  }, [isDemoMode, isAssigned, assignmentLoading]);

  // ── Show spinner while assignment status is still loading ──
  if (!isDemoMode && assignmentLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  // ── Show unassigned card — invite the photographer to the platform ──
  if (!isDemoMode && !isAssigned) {
    return <UnassignedEmptyState featureName="chat with your photographer" />;
  }

  // Loading thread check
  if (!threadCheckDone) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  if (multiAdmin && !selectedThreadAdminId) {
    const formatTime = (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      const now = new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diff === 0) return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
      if (diff === 1) return 'Yesterday';
      return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    };
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: Colors.white }}>Messages</Text>
          <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 2 }}>{adminThreads.length} photographers</Text>
        </View>
        <ScrollView>
          {adminThreads.map((t) => (
            <Pressable
              key={t.adminId}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedThreadAdminId(t.adminId); }}
            >
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', marginRight: 14, overflow: 'hidden' }}>
                {t.adminAvatar
                  ? <Image source={{ uri: t.adminAvatar }} style={{ width: 52, height: 52 }} contentFit="cover" />
                  : <User size={22} color={Colors.textMuted} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: t.unreadCount > 0 ? '800' : '600', color: Colors.white }}>{t.adminName}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>{formatTime(t.lastMessageAt)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: t.unreadCount > 0 ? Colors.textSecondary : Colors.textMuted, flex: 1 }} numberOfLines={1}>{t.lastMessage}</Text>
                  {t.unreadCount > 0 && (
                    <View style={{ backgroundColor: Colors.gold, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.background }}>{t.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
              <ChevronRight size={16} color={Colors.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }
  // ── End thread list ──────────────────────────────────────────────────────────

  // Render the actual chat — ChatBody has all its own hooks (no violation)
  return (
    <ChatBody
      initialMessage={initialMessage || ''}
      isDemoMode={isDemoMode}
      activeAdminId={selectedThreadAdminId ?? activeAdminId}
      brandName={brandName}
      onBackToThreads={multiAdmin ? () => setSelectedThreadAdminId(null) : undefined}
    />
  );
}

// ─── ChatBody: all chat hooks live here, rendered only when user is assigned ───
function ChatBody({ initialMessage, isDemoMode, activeAdminId, brandName, onBackToThreads }: {
  initialMessage: string;
  isDemoMode: boolean;
  activeAdminId: string | null;
  brandName: string;
  onBackToThreads?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>(initialMessage || '');
  const insets = useSafeAreaInsets();
  const { logoUrl } = useBranding();

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
  const [typingIndicatorVisible, setTypingIndicatorVisible] = useState(false);
  const adminLastPingRef = useRef<number>(0);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ─── INIT: resolve client row + admin ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function initChat() {
      setIsLoading(true);
      setInitError(null);

      try {
        if (isDemoMode) {
          if (!cancelled) {
            setOwnerAdminId('demo-admin');
            setClientRowId('demo-client');
            setMessageClientId('demo-client');
            setAdminName('Epix Visuals Team');
            setAdminAvatar(demoProfile.avatar_url);
            setAdminOnline(true);
            setMessages(demoMessages.map((m) => ({
              id: m.id,
              text: m.content,
              sender: m.sender_role,
              timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              read: m.is_read,
              createdAt: m.created_at,
              kind: inferMessageKind(m.content),
            })));
          }
          return;
        }

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
        // Search for messages where client_id = authUser.id (the FK target)
        // Also check clientId (clients.id) for backwards compatibility with old messages
        const messageClientCandidates = Array.from(new Set([authUser.id, clientId].filter(Boolean))) as string[];
        const { data: existingMsgs } = await supabase
          .from('messages')
          .select('*')
          .in('client_id', messageClientCandidates)
          .eq('owner_admin_id', adminId)
          .order('created_at', { ascending: true });

        // Always use authUser.id as messageClientId since messages.client_id FK
        // points to user_profiles(id), not clients(id).
        const messageClientIdToUse = authUser.id;

        if (!cancelled) {
          setOwnerAdminId(adminId);
          setClientRowId(clientId);
          setMessageClientId(messageClientIdToUse);
          setAdminName(finalAdminName);
          setAdminAvatar(finalAdminAvatar);
          setAvatarVersion((v) => v + 1);
          const loadedMessages = (existingMsgs ?? []).map((m: any) => ({
            id: m.id,
            text: m.content,
            sender: m.sender_role,
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: m.is_read,
            createdAt: m.created_at,
            kind: inferMessageKind(m.content),
          })) as ChatMessage[];

          const introMessage: ChatMessage = {
            id: 'chat-system-intro',
            text: `Conversation started with ${finalAdminName ?? brandName}.`,
            sender: 'admin',
            timestamp: 'Now',
            read: true,
            kind: 'system',
          };

          setMessages(loadedMessages.length > 0 ? [introMessage, ...loadedMessages] : [introMessage]);
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
  }, [activeAdminId, brandName, isDemoMode]);

  // ─── Real-time: new messages ────────────────────────────────────────────────
  useEffect(() => {
    if (isDemoMode) return;
    if (!messageClientId) return;

    const channel = supabase
      .channel(`chat_messages_${messageClientId}_${ownerAdminId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${messageClientId},owner_admin_id=eq.${ownerAdminId}`,
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
                createdAt: newMsg.created_at,
                kind: inferMessageKind(newMsg.content),
              },
            ];
          });
          if (newMsg.sender_role === 'admin') {
            setTypingIndicatorVisible(false);
          }
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isDemoMode, messageClientId, ownerAdminId]);

  // ─── Real-time: admin profile changes ──────────────────────────────────────
  useEffect(() => {
    if (isDemoMode) return;
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
  }, [isDemoMode, ownerAdminId]);

  // ─── Presence: admin online/offline ────────────────────────────────────────
  useEffect(() => {
    if (isDemoMode) return;
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
        if (!clientRowId) return; // Wait until clientRowId is resolved
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
  }, [clientRowId, isDemoMode, ownerAdminId]);

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
    setTypingIndicatorVisible(adminOnline);

    try {
      if (isDemoMode) {
        const createdAt = new Date().toISOString();
        setMessages((prev) => [
          ...prev,
          {
            id: `demo-${Date.now()}`,
            text: textToSend,
            sender: 'client',
            timestamp: new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: true,
            createdAt,
            kind: inferMessageKind(textToSend),
          },
        ]);
        setTimeout(() => {
          const replyTime = new Date().toISOString();
          setMessages((prev) => [
            ...prev,
            {
              id: `demo-reply-${Date.now()}`,
              text: 'Demo mode reply: thanks, your message has been captured locally for UI testing.',
              sender: 'admin',
              timestamp: new Date(replyTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              read: true,
              createdAt: replyTime,
              kind: 'system',
            },
          ]);
          setTypingIndicatorVisible(false);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
        }, 500);
        return;
      }

      // Get the current user to verify identity
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const preferredClientId = user.id;

      const { error, data } = await supabase
        .from('messages')
        .insert({
          client_id: preferredClientId,
          owner_admin_id: ownerAdminId,
          sender_role: 'client',
          content: textToSend,
          is_read: false,
        })
        .select();

      if (!error && preferredClientId !== messageClientId) {
        setMessageClientId(preferredClientId);
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
            createdAt: m.created_at,
            kind: inferMessageKind(m.content),
          },
        ]);
        if (adminOnline) {
          setTimeout(() => setTypingIndicatorVisible(false), 2500);
        }
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch (e: any) {
      console.error('[Chat] Send error:', e);
      setInputText(textToSend);
      Alert.alert('Error', `Failed to send message: ${e.message || 'Please try again.'}`);
    }
  }, [clientRowId, inputText, isDemoMode, messageClientId, ownerAdminId, sendScale, adminOnline]);

  const handleAttach = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        Alert.alert('Attachment', 'Image selected. This feature will be fully implemented soon.');
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
    }
  }, []);

  const isOfficeHours = () => {
    const hour = new Date().getHours();
    return hour >= 8 && hour < 18;
  };

  const promiseText = adminOnline
    ? 'Usually replies within a few minutes'
    : isOfficeHours()
      ? 'Replies during studio hours'
      : 'We will pick this up next business window';

  const displayMessages = useMemo(() => messages, [messages]);

  const router = useRouter();

  const handleStructuredCtaPress = useCallback((kind: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (kind) {
      case 'invoice':
        router.push('/(tabs)/profile');
        break;
      case 'gallery_ready':
        router.push('/(tabs)/gallery');
        break;
      case 'booking_confirmation':
        router.push('/(tabs)/bookings');
        break;
      default:
        break;
    }
  }, [router]);
  // composerSpacing only needs to clear the safe area bottom — the tab bar space
  // is already handled by sceneStyle.paddingBottom in the tab layout
  const composerSpacing = isKeyboardVisible
    ? Math.max(insets.bottom, 4)
    : 0;

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
        <View style={styles.headerTopRow}>
          {onBackToThreads && (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBackToThreads(); }}
              style={styles.backButton}
            >
              <ArrowLeft size={20} color={Colors.white} />
            </Pressable>
          )}
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.headerLogo} contentFit="cover" />
          ) : adminAvatar ? (
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
            <Text style={styles.headerEyebrow}>Studio chat</Text>
            <Text style={styles.headerName}>{adminName || brandName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.onlineDot, !adminOnline && styles.offlineDot]} />
              <Text style={styles.statusLabel}>{promiseText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerSupportCard}>
          <View style={styles.headerSupportBadge}>
            <Sparkles size={12} color={Colors.gold} />
            <Text style={styles.headerSupportBadgeText}>Personal support</Text>
          </View>
          <Text style={styles.headerSupportTitle}>Delivery, bookings, invoices and edits in one calm thread.</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messagesList}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: displayMessages.length > 0 ? 8 : 40 },
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {displayMessages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateBadge}>
                <Sparkles size={16} color={Colors.gold} />
                <Text style={styles.emptyStateBadgeText}>Start with a prompt</Text>
              </View>
              <Text style={styles.emptyTitle}>Your studio is one message away</Text>
              <Text style={styles.emptyText}>
                Keep questions, updates, approvals, and delivery requests in one focused thread.
              </Text>
              <View style={styles.emptyQuickActionList}>
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Pressable
                      key={action.label}
                      style={styles.emptyQuickAction}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setInputText(action.message);
                      }}
                    >
                      <View style={styles.emptyQuickActionIcon}>
                        <Icon size={16} color={Colors.gold} />
                      </View>
                      <View style={styles.emptyQuickActionCopy}>
                        <Text style={styles.emptyPromptTitle}>{action.label}</Text>
                        <Text style={styles.emptyPromptBody}>{action.message}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            displayMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onStructuredCtaPress={handleStructuredCtaPress} />
            ))
          )}
          {typingIndicatorVisible && (
            <View style={styles.typingRow}>
              <View style={styles.typingBubble}>
                <View style={styles.typingDots}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
                <Text style={styles.typingLabel}>{adminName || brandName} is typing…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.composerSection, { paddingBottom: composerSpacing }]}>
          <View style={styles.composerHandle} />
          {!isKeyboardVisible && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickReplyRow} style={styles.quickReplyWrap}>
              {quickReplies.map((reply) => (
                <Pressable
                  key={reply}
                  style={styles.quickReplyChip}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setInputText(reply);
                  }}
                >
                  <Text style={styles.quickReplyText}>{reply}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={styles.inputContainer}>
            <Pressable style={styles.attachButton} onPress={handleAttach}>
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
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerLogo: {
    width: 50,
    height: 50,
    borderRadius: 16,
    marginRight: 14,
    backgroundColor: Colors.card,
  },
  headerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
  },
  headerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerName: {
    fontSize: 18,
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
  headerSupportCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.14)',
    gap: 10,
  },
  headerSupportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,175,55,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 8,
  },
  headerSupportBadgeText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  headerSupportTitle: {
    color: Colors.white,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    gap: 16,
    flexGrow: 1,
    paddingBottom: 28,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
  receiptText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  receiptTextRead: {
    color: Colors.gold,
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
  },
  composerSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: 'rgba(10,10,10,0.96)',
  },
  composerHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 8,
  },
  quickReplyWrap: {
    maxHeight: 44,
  },
  quickReplyRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  quickReplyChip: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickReplyText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
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
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyStateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(212,175,55,0.12)',
    marginBottom: 16,
  },
  emptyStateBadgeText: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '700',
  },
  emptyTitle: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  emptyCardRow: {
    gap: 12,
  },
  emptyQuickActionList: {
    gap: 12,
  },
  emptyQuickAction: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  emptyQuickActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
    marginTop: 2,
  },
  emptyQuickActionCopy: {
    flex: 1,
    gap: 4,
  },
  emptyPromptTitle: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyPromptBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  systemMessageWrap: {
    alignItems: 'center',
  },
  systemMessagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  systemMessageText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  structuredCard: {
    maxWidth: '88%',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  adminStructuredCard: {
    backgroundColor: Colors.card,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  clientStructuredCard: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: 'rgba(212,175,55,0.28)',
  },
  structuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  structuredIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  structuredHeaderCopy: {
    flex: 1,
  },
  structuredEyebrow: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  structuredTitle: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  structuredBody: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  structuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  structuredTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  structuredCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  structuredCtaText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  typingRow: {
    marginTop: 8,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 5,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.textSecondary,
  },
  typingLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
});
