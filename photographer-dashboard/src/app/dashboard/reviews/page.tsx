'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Star, MessageSquare, Send, Loader2, CheckCircle, TrendingUp, Filter } from 'lucide-react';

type Review = {
  id: string;
  rating: number;
  review_text: string | null;
  review_source: string;
  is_public: boolean;
  is_verified: boolean;
  helpful_count: number;
  created_at: string;
  clientName: string;
  galleryName: string;
};

type ReviewStats = {
  total_reviews: number;
  average_rating: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [toast, setToast] = useState('');
  const [sendingReview, setSendingReview] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

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

    setReviews((reviewsData || []).map((r: any) => ({
      ...r,
      clientName: clientMap.get(r.client_id) || 'Anonymous',
      galleryName: galleryMap.get(r.gallery_id) || 'Unknown Gallery',
    })));

    // Load stats
    const { data: statsData } = await supabase.rpc('get_review_stats', {
      p_photographer_id: user.id,
    });

    if (statsData && statsData.length > 0) {
      setStats(statsData[0]);
    }

    setLoading(false);
  };

  const sendReviewRequest = async (galleryId: string, clientId: string, method: 'sms' | 'whatsapp') => {
    setSendingReview(`${galleryId}-${clientId}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-review-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            gallery_id: galleryId,
            client_id: clientId,
            method,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        showToast(`Review request sent via ${method.toUpperCase()}`);
      } else {
        showToast(result.message || 'Failed to send');
      }
    } catch (error) {
      showToast('Failed to send review request');
    } finally {
      setSendingReview(null);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (filter === 'all') return true;
    return r.rating === parseInt(filter);
  });

  const renderStars = (rating: number) => {
    return (
      <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            color={star <= rating ? '#D4AF37' : 'rgba(255,255,255,0.2)'}
            fill={star <= rating ? '#D4AF37' : 'transparent'}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: 'rgba(255,255,255,0.5)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /> Loading reviews...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, background: 'rgba(13,13,25,0.95)',
          border: '1px solid rgba(212,175,55,0.3)', borderRadius: 14, padding: '12px 20px',
          color: '#D4AF37', fontWeight: 600, fontSize: 14, zIndex: 100, backdropFilter: 'blur(20px)',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 8 }}>Reviews</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          Client feedback and ratings for your work
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <div style={{
          background: 'rgba(212,175,55,0.05)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Average Rating</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#D4AF37' }}>
            {stats?.average_rating?.toFixed(1) || '0.0'}
          </div>
          <div style={{ marginTop: 4 }}>{renderStars(Math.round(stats?.average_rating || 0))}</div>
        </div>
        
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Total Reviews</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: 'white' }}>
            {stats?.total_reviews || 0}
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>5-Star Reviews</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#34C759' }}>
            {stats?.five_star_count || 0}
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Rating Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats?.[`${['one', 'two', 'three', 'four', 'five'][star - 1]}_star_count`] || 0;
              const total = stats?.total_reviews || 1;
              const percentage = (count / total) * 100;
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', width: 12 }}>{star}</span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                    <div style={{ width: `${percentage}%`, height: '100%', background: '#D4AF37', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', width: 20 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['all', '5', '4', '3', '2', '1'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: filter === f ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
              background: filter === f ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
              color: filter === f ? '#D4AF37' : 'rgba(255,255,255,0.5)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'All' : `${f}★`}
          </button>
        ))}
      </div>

      {/* Reviews List */}
      {filteredReviews.length === 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 48,
          textAlign: 'center',
        }}>
          <MessageSquare size={48} color="rgba(255,255,255,0.2)" style={{ marginBottom: 16 }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>
            {filter === 'all' ? 'No reviews yet' : `No ${filter}-star reviews`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredReviews.map((review) => (
            <div
              key={review.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'white', fontSize: 15, marginBottom: 4 }}>
                    {review.clientName}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {review.galleryName}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {renderStars(review.rating)}
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    {new Date(review.created_at).toLocaleDateString('en-KE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
              
              {review.review_text && (
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                  {review.review_text}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {review.is_verified && (
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'rgba(52,199,89,0.15)',
                    color: '#34C759',
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    ✓ Verified
                  </span>
                )}
                <span style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                }}>
                  via {review.review_source}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request Reviews Section */}
      <div style={{
        background: 'rgba(212,175,55,0.05)',
        border: '1px solid rgba(212,175,55,0.2)',
        borderRadius: 16,
        padding: 24,
        marginTop: 32,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#D4AF37', marginBottom: 12 }}>
          Request Reviews
        </h3>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
          Send review requests to clients who haven't left feedback yet
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          Go to Galleries → Select a gallery → Send review request via SMS or WhatsApp
        </p>
      </div>
    </div>
  );
}
