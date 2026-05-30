import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, User, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export type AdminThread = {
  adminId: string;
  adminName: string;
  adminAvatar: string | null;
  clientRowId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

interface ChatThreadListProps {
  onSelectThread: (thread: AdminThread) => void;
}

export default function ChatThreadList({ onSelectThread }: ChatThreadListProps) {
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all client rows for this user (one per photographer)
      const { data: clientRows } = await supabase
        .from('clients')
        .select('id, owner_admin_id')
        .eq('user_id', user.id);

      if (!clientRows || clientRows.length === 0) return;

      const adminIds = [...new Set(clientRows.map((c: any) => c.owner_admin_id).filter(Boolean))];

      // Fetch admin profiles
      const { data: adminProfiles } = await supabase
        .from('user_profiles')
        .select('id, name, avatar_url')
        .in('id', adminIds);

      // Build threads with last message + unread count
      const built: AdminThread[] = await Promise.all(
        (adminProfiles || []).map(async (admin: any) => {
          const clientRow = clientRows.find((c: any) => c.owner_admin_id === admin.id);

          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('client_id', clientRow?.id)
            .eq('owner_admin_id', admin.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count: unread } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientRow?.id)
            .eq('owner_admin_id', admin.id)
            .eq('sender_role', 'admin')
            .eq('is_read', false);

          return {
            adminId: admin.id,
            adminName: admin.name || 'Photographer',
            adminAvatar: admin.avatar_url,
            clientRowId: clientRow?.id || '',
            lastMessage: lastMsg?.content || 'No messages yet',
            lastMessageAt: lastMsg?.created_at || '',
            unreadCount: unread || 0,
          };
        })
      );

      // Sort by most recent message
      built.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      setThreads(built);
    } catch (e) {
      console.warn('[ChatThreadList] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-KE', { weekday: 'short' });
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  if (threads.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
        <MessageCircle size={48} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>No conversations yet</Text>
        <Text style={styles.emptyDesc}>Your photographers will appear here once you connect with them.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSub}>{threads.length} photographer{threads.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {threads.map((thread) => (
          <Pressable
            key={thread.adminId}
            style={({ pressed }) => [styles.threadRow, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectThread(thread);
            }}
          >
            <View style={styles.avatarWrap}>
              {thread.adminAvatar ? (
                <Image source={{ uri: thread.adminAvatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <User size={22} color={Colors.textMuted} />
                </View>
              )}
              {thread.unreadCount > 0 && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.threadContent}>
              <View style={styles.topRow}>
                <Text style={[styles.adminName, thread.unreadCount > 0 && styles.adminNameBold]}>
                  {thread.adminName}
                </Text>
                <Text style={styles.timeText}>{formatTime(thread.lastMessageAt)}</Text>
              </View>
              <View style={styles.bottomRow}>
                <Text
                  style={[styles.lastMsg, thread.unreadCount > 0 && styles.lastMsgBold]}
                  numberOfLines={1}
                >
                  {thread.lastMessage}
                </Text>
                {thread.unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{thread.unreadCount > 99 ? '99+' : thread.unreadCount}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  avatarFallback: {
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  adminName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  adminNameBold: {
    fontWeight: '800',
  },
  timeText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMsg: {
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
    marginRight: 8,
  },
  lastMsgBold: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: Colors.gold,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.background,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
