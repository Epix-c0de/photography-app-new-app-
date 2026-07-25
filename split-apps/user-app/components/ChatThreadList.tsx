import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Settings } from 'lucide-react-native';
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

          // messages.client_id FK references user_profiles(id), NOT clients(id)
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
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSub}>{threads.length} Photographer{threads.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable style={styles.headerBtn}>
          <Settings size={16} color={Colors.white} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Search size={14} color={Colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
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

        <View style={styles.threadList}>
          {filteredThreads.map((thread) => (
            <Pressable
              key={thread.adminId}
              style={({ pressed }) => [
                styles.threadRow,
                pressed && { backgroundColor: 'rgba(255,255,255,0.04)' },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectThread(thread);
              }}
            >
              <View style={styles.threadAvatarWrap}>
                {thread.adminAvatar ? (
                  <Image source={{ uri: thread.adminAvatar }} style={styles.threadAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.threadAvatar, styles.threadAvatarFallback]}>
                    <Text style={styles.threadAvatarText}>{getInitials(thread.adminName)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.threadContent}>
                <View style={styles.threadTopRow}>
                  <Text
                    style={[styles.threadName, thread.unreadCount > 0 && { fontWeight: '700', color: Colors.white }]}
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
                    style={[styles.threadPreview, thread.unreadCount > 0 && { color: Colors.textSecondary, fontWeight: '500' }]}
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
            <Search size={28} color={Colors.textMuted} />
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
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.6,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.white,
    paddingVertical: 0,
  },

  quickSection: {
    marginBottom: 14,
  },
  quickRow: {
    paddingHorizontal: 16,
    gap: 14,
  },
  quickItem: {
    alignItems: 'center',
    width: 56,
  },
  quickAvatarWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  quickAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  quickAvatarFallback: {
    backgroundColor: '#1E1E2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.goldMuted,
  },
  quickAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  quickBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.gold,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  quickBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.background,
  },
  quickName: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  threadList: {
    paddingHorizontal: 16,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  threadAvatarWrap: {
    marginRight: 12,
  },
  threadAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  threadAvatarFallback: {
    backgroundColor: '#1E1E2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  threadContent: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 10,
  },
  threadTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  threadName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  threadTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  threadBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  threadPreview: {
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: Colors.gold,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.background,
  },

  emptySearch: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptySearchText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 10,
  },
});
