import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Search, Play } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type BTSPost = Database['public']['Tables']['bts_posts']['Row'];

const FILTERS = ['All', 'Wedding', 'Portrait', 'Corporate', 'Event'] as const;
type Filter = (typeof FILTERS)[number];

export default function BTSAllScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('All');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BTSPost[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPosts = useCallback(
    async (overrideSearch?: string) => {
      setLoading(true);
      const searchValue = (overrideSearch ?? search).trim();
      const nowIso = new Date().toISOString();
      let query = supabase
        .from('bts_posts')
        .select('*')
        .eq('is_active', true)
        .gt('expires_at', nowIso);

      if (filter !== 'All') query = query.eq('category', filter);
      if (searchValue.length > 0) query = query.ilike('title', `%${searchValue}%`);
      query = query.order('created_at', { ascending: sort === 'oldest' }).limit(80);

      const { data, error } = await query;

      if (error || !data) {
        setPosts([]);
        setLoading(false);
        return;
      }

      setPosts(data);
      setLoading(false);
    },
    [filter, search, sort]
  );

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchPosts(search), 260);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [fetchPosts, search]);

  useEffect(() => {
    const channel = supabase
      .channel('bts_posts_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bts_posts' }, () => fetchPosts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Behind the Scenes</Text>
        <Pressable
          style={styles.sortButton}
          onPress={() => setSort((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
        >
          <Text style={styles.sortText}>{sort === 'newest' ? 'Newest' : 'Oldest'}</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchIcon}>
          <Search size={16} color={Colors.textMuted} />
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search BTS..."
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <FlashList
        data={FILTERS as unknown as Filter[]}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setFilter(item)}
            style={[styles.filterChip, item === filter && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, item === filter && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        )}
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.gold} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📸</Text>
          <Text style={styles.emptyTitle}>No behind-the-scenes moments yet.</Text>
          <Text style={styles.emptySubtitle}>Check back soon.</Text>
        </View>
      ) : (
        <FlashList
          data={posts}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/bts/${item.id}` as any)}>
              <Image source={{ uri: item.media_url }} style={styles.cardImage} contentFit="cover" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.cardOverlay} />
              <View style={styles.cardMeta}>
                <Text style={styles.cardCategory} numberOfLines={1}>
                  {item.category ?? 'BTS'}
                </Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title ?? 'Behind the Scenes'}
                </Text>
              </View>
              {item.media_type === 'video' && (
                <View style={styles.videoBadge}>
                  <Play size={14} color={Colors.white} fill={Colors.white} />
                </View>
              )}
            </Pressable>
          )}
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
  sortButton: {
    minWidth: 72,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 14,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
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
  filters: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  filterChip: {
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: {
    borderColor: 'rgba(212,175,55,0.32)',
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.gold,
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
    paddingHorizontal: 28,
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
    textAlign: 'center' as const,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  grid: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  card: {
    flex: 1,
    margin: 6,
    height: 220,
    borderRadius: 18,
    overflow: 'hidden' as const,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardMeta: {
    position: 'absolute' as const,
    left: 12,
    right: 12,
    bottom: 12,
  },
  cardCategory: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.gold,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  videoBadge: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
  },
});
