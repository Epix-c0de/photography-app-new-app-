import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Search, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/supabase';

type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];

export default function AnnouncementsAllScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRows = useCallback(
    async (overrideSearch?: string) => {
      setLoading(true);
      const searchValue = (overrideSearch ?? search).trim();
      const nowIso = new Date().toISOString();

      let query = supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`);

      if (profile?.client_type) {
        query = query.or(`target_audience.is.null,target_audience.cs.{${profile.client_type}}`);
      } else {
        query = query.is('target_audience', null);
      }

      if (searchValue.length > 0) query = query.ilike('title', `%${searchValue}%`);
      query = query.order('created_at', { ascending: false }).limit(80);

      const { data, error } = await query;
      if (error || !data) {
        setRows([]);
        setLoading(false);
        return;
      }

      setRows(data);
      setLoading(false);
    },
    [search, profile]
  );

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchRows(search), 260);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [fetchRows, search]);

  useEffect(() => {
    const channel = supabase
      .channel('announcements_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchRows())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRows]);

  const renderRow = useCallback(
    ({ item }: { item: AnnouncementRow }) => (
      <Pressable style={styles.card} onPress={() => router.push(`/announcements/${item.id}` as any)}>
        <Image source={{ uri: item.image_url ?? '' }} style={styles.cardImage} contentFit="cover" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.cardOverlay} />
        {item.tag && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.tag}</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.description ?? ''}
          </Text>
          <View style={styles.ctaRow}>
            <Text style={styles.ctaText}>{item.cta ?? 'View'}</Text>
            <ChevronRight size={14} color={Colors.gold} />
          </View>
        </View>
      </Pressable>
    ),
    [router]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Announcements</Text>
        <View style={{ width: 44, height: 44 }} />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchIcon}>
          <Search size={16} color={Colors.textMuted} />
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search announcements..."
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.gold} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📰</Text>
          <Text style={styles.emptyTitle}>No announcements right now.</Text>
          <Text style={styles.emptySubtitle}>Check back soon.</Text>
        </View>
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row' as const,
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center' as const,
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row' as const,
    alignItems: 'center',
    overflow: 'hidden' as const,
  },
  searchIcon: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: Colors.white,
    fontSize: 14,
    paddingRight: 12,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    height: 140,
    borderRadius: 18,
    overflow: 'hidden' as const,
    backgroundColor: Colors.card,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 86,
  },
  tag: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tagText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800' as const,
  },
  cardContent: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  cardTitle: {
    color: Colors.white,
    fontWeight: '900' as const,
    fontSize: 14,
  },
  cardDesc: {
    marginTop: 4,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  ctaRow: {
    marginTop: 8,
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
  },
  ctaText: {
    color: Colors.gold,
    fontWeight: '800' as const,
    fontSize: 12,
  },
});
