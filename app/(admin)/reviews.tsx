import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, MessageSquare, Send, Loader2, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import SettingsHeader from '@/components/SettingsHeader';

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  review_source: string;
  is_verified: boolean;
  created_at: string;
  clientName: string;
  galleryName: string;
};

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load reviews
    const { data: reviewsData } = await supabase
      .from('reviews')
      .select('*')
      .eq('photographer_id', user.id)
      .order('created_at', { ascending: false });

    // Get client and gallery names
    const clientIds = [...new Set((reviewsData || []).map((r: any) => r.client_id).filter(Boolean))];
    const galleryIds = [...new Set((reviewsData || []).map((r: any) => r.gallery_id).filter(Boolean))];

    let clientMap = new Map<string, string>();
    let galleryMap = new Map<string, string>();

    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
      (clients || []).forEach((c: any) => clientMap.set(c.id, c.name));
    }

    if (galleryIds.length > 0) {
      const { data: galleries } = await supabase.from('galleries').select('id, name').in('id', galleryIds);
      (galleries || []).forEach((g: any) => galleryMap.set(g.id, g.name));
    }

    const transformedReviews = (reviewsData || []).map((r: any) => ({
      ...r,
      clientName: clientMap.get(r.client_id) || 'Anonymous',
      galleryName: galleryMap.get(r.gallery_id) || 'Unknown Gallery',
    }));

    setReviews(transformedReviews);
    setTotalReviews(transformedReviews.length);
    
    if (transformedReviews.length > 0) {
      const avg = transformedReviews.reduce((sum, r) => sum + r.rating, 0) / transformedReviews.length;
      setAverageRating(avg);
    }

    setLoading(false);
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            color={star <= rating ? Colors.gold : 'rgba(255,255,255,0.2)'}
            fill={star <= rating ? Colors.gold : 'transparent'}
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SettingsHeader title="Reviews" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Average Rating</Text>
            {renderStars(Math.round(averageRating))}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalReviews}</Text>
            <Text style={styles.statLabel}>Total Reviews</Text>
          </View>
        </View>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <View style={styles.emptyCard}>
            <MessageSquare size={40} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>No reviews yet</Text>
          </View>
        ) : (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View>
                  <Text style={styles.clientName}>{review.clientName}</Text>
                  <Text style={styles.galleryName}>{review.galleryName}</Text>
                </View>
                <View style={styles.reviewRight}>
                  {renderStars(review.rating)}
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('en-KE', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
              </View>
              
              {review.review_text && (
                <Text style={styles.reviewText}>{review.review_text}</Text>
              )}

              <View style={styles.reviewFooter}>
                {review.is_verified && (
                  <View style={styles.verifiedBadge}>
                    <CheckCircle size={12} color={Colors.success} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
                <Text style={styles.sourceText}>via {review.review_source}</Text>
              </View>
            </View>
          ))
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.gold,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 12,
  },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  galleryName: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  reviewRight: {
    alignItems: 'flex-end',
  },
  reviewDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  reviewText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 12,
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,199,89,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
  },
  sourceText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
