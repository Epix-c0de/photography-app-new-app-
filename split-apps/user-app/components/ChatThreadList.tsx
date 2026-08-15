import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Settings, MessageCircle } from 'lucide-react-native';
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
  const [search, setSearch] = useState('');

  const loadThreads = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientRows } = await supabase
        .from('clients')
        .select('id, owner_admin_id')
        .eq('user_id', user.id);

      if (!clientRows || clientRows.length === 0) return;

      const adminIds = [...new Set(clientRows.map((c: any) => c.owner_admin_id).filter(Boolean))];

      const { data: adminProfiles } = await supabase
        .from('user_profiles')
        .select('id, name, avatar_url')
        .in('id', adminIds);

      const built: AdminThread[] = await Promise.all(
        (adminProfiles || []).map(async (admin: any) => {
          const clientRow = clientRows.find((c: any) => c.owner_admin_id === admin.id);
          const messageClientId = user.id;

          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('client_id', messageClientId)
            .eq('owner_admin_id', admin.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count: unread } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', messageClientId)
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

      built.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      setThreads(built);
    } catch (e) {
      console.warn('[ChatThreadList] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return 'Yday';
    if (diffDays < 7) return d.toLocaleDateString('en-KE', { weekday: 'short' });
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(t =>
      t.adminName.toLowerCase().includes(q) ||
      t.lastMessage.toLowerCase().includes(q)
    );
  }, [threads, search]);

  const quickAccessThreads = threads.slice(0, 8);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.loadingDot} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSub}>{threads.length} Photographer{threads.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable style={styles.headerBtn}>
          <Settings size={16} color={Colors.white} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={15} color="rgba(255,255,255,0.3)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Quick access avatars */}
        {quickAccessThreads.length > 0 && (
          <View style={styles.quickSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
              {quickAccessThreads.map((thread) => (
                <Pressable
                  key={thread.adminId}
                  style={styles.quickItem}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectThread(thread);
                  }}
                >
                  <View style={styles.quickAvatarWrap}>
                    {thread.adminAvatar ? (
                      <Image source={{ uri: thread.adminAvatar }} style={styles.quickAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.quickAvatar, styles.quickAvatarFallback]}>
                        <Text style={styles.quickAvatarText}>{getInitials(thread.adminName)}</Text>
                      </View>
                    )}
                    {thread.unreadCount > 0 && (
                      <View style={styles.quickBadge}>
                        <Text style={styles.quickBadgeText}>{thread.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.quickName} numberOfLines={1}>
                    {thread.adminName.split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Thread list */}
        <View style={styles.threadList}>
          {filteredThreads.map((thread) => (
            <Pressable
              key={thread.adminId}
              style={({ pressed }) => [
                styles.threadRow,
                thread.unreadCount > 0 && styles.threadRowUnread,
                pressed && { backgroundColor: 'rgba(255,255,255,0.04)' },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectThread(thread);
              }}
            >
              {/* Avatar */}
              <View style={styles.threadAvatarWrap}>
                {thread.adminAvatar ? (
                  <Image source={{ uri: thread.adminAvatar }} style={styles.threadAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.threadAvatar, styles.threadAvatarFallback]}>
                    <Text style={styles.threadAvatarText}>{getInitials(thread.adminName)}</Text>
                  </View>
                )}
                {thread.unreadCount > 0 && <View style={styles.onlineDot} />}
              </View>

              {/* Content */}
              <View style={styles.threadContent}>
                <View style={styles.threadTopRow}>
                  <Text
                    style={[styles.threadName, thread.unreadCount > 0 && styles.threadNameUnread]}
                    numberOfLines={1}
                  >
                    {thread.adminName}
                  </Text>
                  <Text style={[styles.threadTime, thread.unreadCount > 0 && { color: Colors.gold }]}>
                    {formatTime(thread.lastMessageAt)}
                  </Text>
                </View>

                <View style={styles.threadBottomRow}>
                  <Text
                    style={[styles.threadPreview, thread.unreadCount > 0 && styles.threadPreviewUnread]}
                    numberOfLines={1}
                  >
                    {thread.lastMessage}
                  </Text>
                  {thread.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{thread.unreadCount > 99 ? '99+' : thread.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {search.trim() && filteredThreads.length === 0 && (
          <View style={styles.emptySearch}>
            <MessageCircle size={28} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptySearchText}>No matching conversations</Text>
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
  loadingDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.goldMuted,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.7,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
    fontWeight: '500',
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 40,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.white,
    paddingVertical: 0,
  },

  quickSection: {
    marginBottom: 16,
  },
  quickRow: {
    paddingHorizontal: 20,
    gap: 16,
  },
  quickItem: {
    alignItems: 'center',
    width: 58,
  },
  quickAvatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  quickAvatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
  },
  quickAvatarFallback: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.25)',
  },
  quickAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gold,
  },
  quickBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: Colors.gold,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  quickBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.background,
  },
  quickName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    fontWeight: '500',
  },

  threadList: {
    paddingHorizontal: 20,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    marginBottom: 2,
  },
  threadRowUnread: {
    backgroundColor: 'rgba(212,175,55,0.04)',
  },
  threadAvatarWrap: {
    marginRight: 14,
    position: 'relative',
  },
  threadAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  threadAvatarFallback: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  threadAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gold,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  threadContent: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 12,
  },
  threadTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  threadName: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
    marginRight: 8,
  },
  threadNameUnread: {
    fontWeight: '700',
    color: Colors.white,
  },
  threadTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '500',
  },
  threadBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  threadPreview: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    flex: 1,
    marginRight: 8,
    lineHeight: 18,
  },
  threadPreviewUnread: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: Colors.gold,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.background,
  },

  emptySearch: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 10,
  },
  emptySearchText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
});
