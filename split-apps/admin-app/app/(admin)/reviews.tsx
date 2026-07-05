import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
  ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, Search, MessageSquare } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  review_source: string | null;
  is_verified: boolean;
  created_at: string;
  clients: { name: string } | null;
  galleries: { name: string } | null;
};

type Stats = {
  average: number;
  total: number;
  distribution: number[];
};

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats>({ average: 0, total: 0, distribution: [0, 0, 0, 0, 0] });

  const loadReviews = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, clients(name), galleries(name)')
        .eq('photographer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const reviewsData = (data || []) as Review[];
      setReviews(reviewsData);

      // Calculate stats
      const total = reviewsData.length;
      const avg = total > 0 ? reviewsData.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      const dist = [0, 0, 0, 0, 0];
      reviewsData.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
      setStats({ average: avg, total, distribution: dist });
    } catch (e) {
      console.warn('Reviews load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReviews();
  }, [loadReviews]);

  const filtered = filter !== null ? reviews.filter((r) => r.rating === filter) : reviews;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Reviews</Text>
        <Text style={styles.subtitle}>{stats.total} reviews</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.average.toFixed(1)}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={12} color={s <= Math.round(stats.average) ? '#F59E0B' : 'rgba(255,255,255,0.2)'} fill={s <= Math.round(stats.average) ? '#F59E0B' : 'transparent'} />
            ))}
          </View>
          <Text style={styles.statLabel}>Average</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.distribution[4]}</Text>
          <Text style={styles.statLabel}>5-Star</Text>
        </View>
      </View>

      {/* Distribution */}
      <View style={styles.distribution}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = stats.distribution[star - 1];
          const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
          return (
            <Pressable key={star} style={styles.distRow} onPress={() => setFilter(filter === star - 1 ? null : star - 1)}>
              <Text style={styles.distLabel}>{star}</Text>
              <Star size={12} color="#F59E0B" fill="#F59E0B" />
              <View style={styles.distBar}>
                <View style={[styles.distFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.distCount}>{count}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Filter chips */}
      <View style={styles.filters}>
        <Pressable style={[styles.filterChip, filter === null && styles.filterChipActive]} onPress={() => setFilter(null)}>
          <Text style={[styles.filterText, filter === null && styles.filterTextActive]}>All</Text>
        </Pressable>
        {[5, 4, 3, 2, 1].map((star) => (
          <Pressable key={star} style={[styles.filterChip, filter === star - 1 && styles.filterChipActive]} onPress={() => setFilter(filter === star - 1 ? null : star - 1)}>
            <Text style={[styles.filterText, filter === star - 1 && styles.filterTextActive]}>{star}★</Text>
          </Pressable>
        ))}
      </View>

      {/* Reviews List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <MessageSquare size={48} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View>
                <Text style={styles.reviewClient}>{item.clients?.name || 'Anonymous'}</Text>
                <Text style={styles.reviewGallery}>{item.galleries?.name || ''}</Text>
              </View>
              <View style={styles.reviewStars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={12} color={s <= item.rating ? '#F59E0B' : 'rgba(255,255,255,0.2)'} fill={s <= item.rating ? '#F59E0B' : 'transparent'} />
                ))}
              </View>
            </View>
            {item.review_text && <Text style={styles.reviewText}>{item.review_text}</Text>}
            <View style={styles.reviewMeta}>
              <Text style={styles.reviewDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              {item.is_verified && <Text style={styles.reviewVerified}>Verified</Text>}
              {item.review_source && <Text style={styles.reviewSource}>{item.review_source}</Text>}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8,
  },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  starsRow: { flexDirection: 'row', gap: 2, marginVertical: 4 },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  distribution: {
    paddingHorizontal: 20, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 14, marginHorizontal: 20,
  },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  distLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 12 },
  distBar: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3 },
  distFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 3 },
  distCount: { fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 20, textAlign: 'right' },
  filters: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: { backgroundColor: Colors.gold },
  filterText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  filterTextActive: { color: '#080810' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, color: 'rgba(255,255,255,0.4)', marginTop: 12 },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  reviewHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8,
  },
  reviewClient: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  reviewGallery: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20, marginBottom: 8 },
  reviewMeta: { flexDirection: 'row', gap: 12 },
  reviewDate: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  reviewVerified: { fontSize: 11, color: '#10B981' },
  reviewSource: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
});
