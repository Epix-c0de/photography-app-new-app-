import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Star, Search, MessageSquare, Pin, PinOff, Trash2, Reply,
  X, Send, Eye, TrendingUp, Award, ChevronDown,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  review_source: string | null;
  is_verified: boolean;
  is_featured: boolean;
  response: string | null;
  response_at: string | null;
  quality_rating: number | null;
  speed_rating: number | null;
  professionalism_rating: number | null;
  communication_rating: number | null;
  created_at: string;
  clients: { name: string; email?: string } | null;
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
  const [filter, setFilter] = useState<number | 'featured' | null>(null);
  const [stats, setStats] = useState<Stats>({ average: 0, total: 0, distribution: [0, 0, 0, 0, 0] });
  const [replyModal, setReplyModal] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const loadReviews = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, clients(name, email), galleries(name)')
        .eq('photographer_id', user.id)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      const reviewsData = (data || []) as Review[];
      setReviews(reviewsData);

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

  const toggleFeatured = async (review: Review) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ is_featured: !review.is_featured })
        .eq('id', review.id);
      if (error) throw error;
      setReviews((prev) =>
        prev.map((r) => r.id === review.id ? { ...r, is_featured: !r.is_featured } : r)
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to update review');
    }
  };

  const deleteReview = (review: Review) => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('reviews')
                .delete()
                .eq('id', review.id);
              if (error) throw error;
              setReviews((prev) => prev.filter((r) => r.id !== review.id));
            } catch (e) {
              Alert.alert('Error', 'Failed to delete review');
            }
          },
        },
      ]
    );
  };

  const submitReply = async () => {
    if (!replyText.trim() || !replyModal) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          response: replyText.trim(),
          response_at: new Date().toISOString(),
        })
        .eq('id', replyModal.id);
      if (error) throw error;
      setReviews((prev) =>
        prev.map((r) =>
          r.id === replyModal.id
            ? { ...r, response: replyText.trim(), response_at: new Date().toISOString() }
            : r
        )
      );
      setReplyModal(null);
      setReplyText('');
    } catch (e) {
      Alert.alert('Error', 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = (() => {
    if (filter === 'featured') return reviews.filter((r) => r.is_featured);
    if (filter !== null) return reviews.filter((r) => r.rating === filter);
    return reviews;
  })();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderStatBar = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statsMain}>
        <View style={styles.statBigCard}>
          <Text style={styles.statBigValue}>{stats.average.toFixed(1)}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={14}
                color={s <= Math.round(stats.average) ? '#F59E0B' : 'rgba(255,255,255,0.15)'}
                fill={s <= Math.round(stats.average) ? '#F59E0B' : 'transparent'}
              />
            ))}
          </View>
          <Text style={styles.statLabel}>Average Rating</Text>
        </View>
        <View style={styles.statSmallRow}>
          <View style={styles.statSmallCard}>
            <View style={styles.statSmallIcon}>
              <Eye size={14} color={Colors.gold} />
            </View>
            <Text style={styles.statSmallValue}>{stats.total}</Text>
            <Text style={styles.statSmallLabel}>Total</Text>
          </View>
          <View style={styles.statSmallCard}>
            <View style={styles.statSmallIcon}>
              <Award size={14} color="#F59E0B" />
            </View>
            <Text style={styles.statSmallValue}>{stats.distribution[4]}</Text>
            <Text style={styles.statSmallLabel}>5-Star</Text>
          </View>
          <View style={styles.statSmallCard}>
            <View style={styles.statSmallIcon}>
              <TrendingUp size={14} color="#10B981" />
            </View>
            <Text style={styles.statSmallValue}>
              {stats.total > 0 ? Math.round((stats.distribution[4] / stats.total) * 100) : 0}%
            </Text>
            <Text style={styles.statSmallLabel}>Excellent</Text>
          </View>
        </View>
      </View>

      <View style={styles.distributionCard}>
        <Text style={styles.distributionTitle}>Rating Distribution</Text>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = stats.distribution[star - 1];
          const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
          return (
            <Pressable
              key={star}
              style={styles.distRow}
              onPress={() => setFilter(filter === star - 1 ? null : star - 1)}
            >
              <Text style={styles.distLabel}>{star}</Text>
              <Star size={10} color="#F59E0B" fill="#F59E0B" />
              <View style={styles.distBar}>
                <View style={[styles.distFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.distCount}>{count}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Reviews</Text>
          <Text style={styles.subtitle}>Client feedback & ratings</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{stats.total}</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        ListHeaderComponent={
          <>
            {renderStatBar()}
            <View style={styles.filterSection}>
              <Pressable
                style={styles.filterToggle}
                onPress={() => setShowFilters(!showFilters)}
              >
                <Text style={styles.filterToggleText}>Filter Reviews</Text>
                <ChevronDown
                  size={14}
                  color="rgba(255,255,255,0.5)"
                  style={{ transform: [{ rotate: showFilters ? '180deg' : '0deg' }] }}
                />
              </Pressable>
              {showFilters && (
                <View style={styles.filters}>
                  <Pressable
                    style={[styles.filterChip, filter === null && styles.filterChipActive]}
                    onPress={() => setFilter(null)}
                  >
                    <Text style={[styles.filterText, filter === null && styles.filterTextActive]}>All</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, filter === 'featured' && styles.filterChipFeatured]}
                    onPress={() => setFilter(filter === 'featured' ? null : 'featured')}
                  >
                    <Pin size={10} color={filter === 'featured' ? '#080810' : Colors.gold} />
                    <Text style={[styles.filterText, filter === 'featured' && styles.filterTextActive]}>
                      Featured
                    </Text>
                  </Pressable>
                  {[5, 4, 3, 2, 1].map((star) => (
                    <Pressable
                      key={star}
                      style={[styles.filterChip, filter === star - 1 && styles.filterChipActive]}
                      onPress={() => setFilter(filter === star - 1 ? null : star - 1)}
                    >
                      <Text style={[styles.filterText, filter === star - 1 && styles.filterTextActive]}>
                        {star}★
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <MessageSquare size={40} color="rgba(212,175,55,0.3)" />
              </View>
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptySubtitle}>
                Share your galleries with clients{'\n'}to start collecting reviews
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.reviewCard, item.is_featured && styles.reviewCardFeatured]}>
            <View style={styles.reviewTopRow}>
              <View style={styles.reviewAvatar}>
                <Text style={styles.reviewAvatarText}>
                  {(item.clients?.name || 'A').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.reviewInfo}>
                <View style={styles.reviewNameRow}>
                  <Text style={styles.reviewClient}>{item.clients?.name || 'Anonymous'}</Text>
                  {item.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedText}>✓</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.reviewGallery}>{item.galleries?.name || 'Unknown Gallery'}</Text>
              </View>
              <View style={styles.reviewRatingBadge}>
                <Text style={styles.reviewRatingText}>{item.rating}</Text>
                <Star size={10} color="#F59E0B" fill="#F59E0B" />
              </View>
            </View>

            <View style={styles.reviewStarsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={14}
                  color={s <= item.rating ? '#F59E0B' : 'rgba(255,255,255,0.1)'}
                  fill={s <= item.rating ? '#F59E0B' : 'transparent'}
                />
              ))}
            </View>

            {item.review_text && (
              <Text style={styles.reviewText}>{item.review_text}</Text>
            )}

            {(item.quality_rating || item.speed_rating || item.professionalism_rating || item.communication_rating) && (
              <View style={styles.categoryRatings}>
                {item.quality_rating && (
                  <View style={styles.categoryRow}>
                    <Text style={styles.categoryLabel}>Quality</Text>
                    <View style={styles.categoryStars}>
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={10} color={s <= item.quality_rating! ? '#F59E0B' : 'rgba(255,255,255,0.1)'} fill={s <= item.quality_rating! ? '#F59E0B' : 'transparent'} />
                      ))}
                    </View>
                  </View>
                )}
                {item.speed_rating && (
                  <View style={styles.categoryRow}>
                    <Text style={styles.categoryLabel}>Speed</Text>
                    <View style={styles.categoryStars}>
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={10} color={s <= item.speed_rating! ? '#F59E0B' : 'rgba(255,255,255,0.1)'} fill={s <= item.speed_rating! ? '#F59E0B' : 'transparent'} />
                      ))}
                    </View>
                  </View>
                )}
                {item.professionalism_rating && (
                  <View style={styles.categoryRow}>
                    <Text style={styles.categoryLabel}>Professionalism</Text>
                    <View style={styles.categoryStars}>
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={10} color={s <= item.professionalism_rating! ? '#F59E0B' : 'rgba(255,255,255,0.1)'} fill={s <= item.professionalism_rating! ? '#F59E0B' : 'transparent'} />
                      ))}
                    </View>
                  </View>
                )}
                {item.communication_rating && (
                  <View style={styles.categoryRow}>
                    <Text style={styles.categoryLabel}>Communication</Text>
                    <View style={styles.categoryStars}>
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={10} color={s <= item.communication_rating! ? '#F59E0B' : 'rgba(255,255,255,0.1)'} fill={s <= item.communication_rating! ? '#F59E0B' : 'transparent'} />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {item.response && (
              <View style={styles.responseBlock}>
                <View style={styles.responseHeader}>
                  <Reply size={12} color={Colors.gold} />
                  <Text style={styles.responseLabel}>Your Reply</Text>
                </View>
                <Text style={styles.responseText}>{item.response}</Text>
              </View>
            )}

            <View style={styles.reviewFooter}>
              <Text style={styles.reviewDate}>{formatDate(item.created_at)}</Text>
              {item.review_source && (
                <View style={styles.sourceTag}>
                  <Text style={styles.sourceTagText}>{item.review_source}</Text>
                </View>
              )}
            </View>

            <View style={styles.reviewActions}>
              <Pressable
                style={[styles.actionBtn, item.is_featured && styles.actionBtnActive]}
                onPress={() => toggleFeatured(item)}
              >
                {item.is_featured ? (
                  <PinOff size={13} color="#080810" />
                ) : (
                  <Pin size={13} color="rgba(255,255,255,0.5)" />
                )}
                <Text style={[styles.actionBtnText, item.is_featured && styles.actionBtnTextActive]}>
                  {item.is_featured ? 'Unfeature' : 'Feature'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() => { setReplyModal(item); setReplyText(item.response || ''); }}
              >
                <Reply size={13} color="rgba(255,255,255,0.5)" />
                <Text style={styles.actionBtnText}>{item.response ? 'Edit Reply' : 'Reply'}</Text>
              </Pressable>
              <Pressable style={styles.actionBtnDanger} onPress={() => deleteReview(item)}>
                <Trash2 size={13} color={Colors.error} />
                <Text style={styles.actionBtnTextDanger}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <Modal
        visible={!!replyModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setReplyModal(null); setReplyText(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Reply to Review</Text>
                <Text style={styles.modalSubtitle}>
                  {replyModal?.clients?.name || 'Anonymous'} · {replyModal?.rating}★
                </Text>
              </View>
              <Pressable
                style={styles.modalClose}
                onPress={() => { setReplyModal(null); setReplyText(''); }}
              >
                <X size={20} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>

            {replyModal?.review_text && (
              <View style={styles.modalReviewPreview}>
                <Text style={styles.modalReviewText}>"{replyModal.review_text}"</Text>
              </View>
            )}

            <TextInput
              style={styles.replyInput}
              placeholder="Write your reply..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>{replyText.length}/500</Text>

            <Pressable
              style={[styles.sendBtn, (!replyText.trim() || submitting) && styles.sendBtnDisabled]}
              onPress={submitReply}
              disabled={!replyText.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#080810" />
              ) : (
                <>
                  <Send size={16} color="#080810" />
                  <Text style={styles.sendBtnText}>
                    {replyModal?.response ? 'Update Reply' : 'Send Reply'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.white },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  headerBadge: {
    backgroundColor: Colors.goldMuted, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  headerBadgeText: { fontSize: 14, fontWeight: '700', color: Colors.gold },

  statsContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  statsMain: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statBigCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1,
    borderColor: Colors.border,
  },
  statBigValue: { fontSize: 32, fontWeight: '900', color: Colors.gold },
  starsRow: { flexDirection: 'row', gap: 2, marginVertical: 4 },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  statSmallRow: { flex: 1, gap: 8 },
  statSmallCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 12,
    padding: 10, flexDirection: 'row', alignItems: 'center',
    gap: 8, borderWidth: 1, borderColor: Colors.border,
  },
  statSmallIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.goldMuted, alignItems: 'center', justifyContent: 'center',
  },
  statSmallValue: { fontSize: 16, fontWeight: '800', color: Colors.white },
  statSmallLabel: { fontSize: 10, color: Colors.textMuted },

  distributionCard: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  distributionTitle: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 10 },
  distRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6,
  },
  distLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 10 },
  distBar: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3 },
  distFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 3 },
  distCount: { fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 20, textAlign: 'right' },

  filterSection: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  filterToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterToggleText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filterChipFeatured: {
    backgroundColor: 'rgba(212,175,55,0.1)', borderColor: 'rgba(212,175,55,0.3)',
  },
  filterText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  filterTextActive: { color: '#080810' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.goldMuted,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.white, marginBottom: 6 },
  emptySubtitle: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18,
  },

  reviewCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  reviewCardFeatured: {
    borderColor: 'rgba(212,175,55,0.3)', backgroundColor: 'rgba(212,175,55,0.04)',
  },
  reviewTopRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.goldMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  reviewAvatarText: { fontSize: 15, fontWeight: '800', color: Colors.gold },
  reviewInfo: { flex: 1 },
  reviewNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewClient: { fontSize: 14, fontWeight: '700', color: Colors.white },
  verifiedBadge: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#10B981',
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF' },
  reviewGallery: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  reviewRatingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  reviewRatingText: { fontSize: 13, fontWeight: '800', color: '#F59E0B' },
  reviewStarsRow: { flexDirection: 'row', gap: 2, marginBottom: 8 },
  reviewText: {
    fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 21,
    marginBottom: 10,
  },
  categoryRatings: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8,
    padding: 10, marginBottom: 10, gap: 6,
  },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  categoryLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600',
  },
  categoryStars: {
    flexDirection: 'row', gap: 2,
  },

  responseBlock: {
    backgroundColor: 'rgba(212,175,55,0.06)', borderRadius: 10,
    padding: 12, marginBottom: 10, borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
  },
  responseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  responseLabel: { fontSize: 11, fontWeight: '700', color: Colors.gold },
  responseText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },

  reviewFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  reviewDate: { fontSize: 11, color: Colors.textMuted },
  sourceTag: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  sourceTagText: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' },

  reviewActions: {
    flexDirection: 'row', gap: 8, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  actionBtnTextActive: { color: '#080810' },
  actionBtnDanger: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(231,76,60,0.08)', borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.15)',
  },
  actionBtnTextDanger: { fontSize: 11, fontWeight: '600', color: Colors.error },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  modalSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  modalClose: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalReviewPreview: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    padding: 12, marginBottom: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modalReviewText: {
    fontSize: 13, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic',
    lineHeight: 18,
  },
  replyInput: {
    backgroundColor: Colors.inputBg, borderRadius: 12, padding: 14,
    color: Colors.white, fontSize: 14, minHeight: 120,
    borderWidth: 1, borderColor: Colors.inputBorder, lineHeight: 20,
  },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 6, marginBottom: 12 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.gold, borderRadius: 12, padding: 14,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 14, fontWeight: '700', color: '#080810' },
});
