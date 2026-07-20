import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  Images,
  Calendar,
  CreditCard,
  Upload,
  Smartphone,
  TrendingUp,
  ChevronRight,
  MessageSquare,
  Star,
  Clock,
  ArrowUpRight,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

type DashboardStats = {
  totalClients: number;
  totalGalleries: number;
  paidGalleries: number;
  totalRevenue: number;
  revenueToday: number;
  revenueThisMonth: number;
  smsBalance: number;
};

type ActivityItem = {
  id: string;
  type: 'upload' | 'booking' | 'message' | 'payment' | 'review';
  title: string;
  subtitle: string;
  time: string;
  icon: React.ReactNode;
  color: string;
};

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `KES ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `KES ${(amount / 1000).toFixed(0)}K`;
  return `KES ${amount}`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await AdminService.getDashboardStats(user.id);
      setStats(data);

      // Fetch admin's client user_ids for bookings filter
      const { data: adminClients } = await supabase
        .from('clients')
        .select('user_id')
        .eq('owner_admin_id', user.id);
      const adminUserIds = (adminClients || []).map(c => c.user_id).filter(Boolean);

      // Fetch recent activity in parallel — scoped to this admin
      const [galleriesRes, bookingsRes, messagesRes, reviewsRes] = await Promise.allSettled([
        supabase.from('galleries').select('id, name, created_at, client_id').eq('owner_admin_id', user.id).order('created_at', { ascending: false }).limit(3),
        adminUserIds.length > 0
          ? supabase.from('bookings').select('id, title, event_date, created_at, status').in('user_id', adminUserIds).order('created_at', { ascending: false }).limit(3)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('messages').select('id, content, created_at, sender_role, client_id, is_read').eq('owner_admin_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('reviews').select('id, rating, review_text, created_at, clients(name)').eq('photographer_id', user.id).order('created_at', { ascending: false }).limit(3),
      ]);

      // Count unread messages
      const msgs = messagesRes.status === 'fulfilled' ? messagesRes.value.data || [] : [];
      const unread = msgs.filter((m: any) => m.sender_role === 'client' && !m.is_read).length;
      setUnreadMessages(unread);

      // Build activity feed
      const activities: ActivityItem[] = [];

      if (galleriesRes.status === 'fulfilled') {
        (galleriesRes.value.data || []).forEach((g: any) => {
          activities.push({
            id: `gallery-${g.id}`,
            type: 'upload',
            title: `Gallery "${g.name || 'Untitled'}" created`,
            subtitle: formatTimeAgo(g.created_at),
            time: g.created_at,
            icon: <Images size={16} color="#8B5CF6" />,
            color: '#8B5CF6',
          });
        });
      }

      if (bookingsRes.status === 'fulfilled') {
        (bookingsRes.value.data || []).forEach((b: any) => {
          activities.push({
            id: `booking-${b.id}`,
            type: 'booking',
            title: b.title || 'New booking',
            subtitle: `${b.status || 'pending'} · ${b.event_date ? new Date(b.event_date).toLocaleDateString() : ''}`,
            time: b.created_at,
            icon: <Calendar size={16} color="#3B82F6" />,
            color: '#3B82F6',
          });
        });
      }

      if (messagesRes.status === 'fulfilled') {
        msgs.slice(0, 2).forEach((m: any) => {
          activities.push({
            id: `msg-${m.id}`,
            type: 'message',
            title: m.sender_role === 'client' ? 'New message from client' : 'Message sent',
            subtitle: m.content?.substring(0, 50) + (m.content?.length > 50 ? '...' : ''),
            time: m.created_at,
            icon: <MessageSquare size={16} color={Colors.gold} />,
            color: Colors.gold,
          });
        });
      }

      if (reviewsRes.status === 'fulfilled') {
        (reviewsRes.value.data || []).forEach((r: any) => {
          activities.push({
            id: `review-${r.id}`,
            type: 'review',
            title: `${r.rating}-star review from ${r.clients?.name || 'Anonymous'}`,
            subtitle: r.review_text?.substring(0, 50) + (r.review_text?.length > 50 ? '...' : ''),
            time: r.created_at,
            icon: <Star size={16} color="#F59E0B" />,
            color: '#F59E0B',
          });
        });
      }

      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivity(activities.slice(0, 6));
    } catch (e) {
      console.warn('Failed to load stats:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Dashboard</Text>
            <Text style={styles.title}>{user?.user_metadata?.full_name || 'Studio'}</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.notifButton}
              onPress={() => router.push('/(admin)/inbox')}
            >
              <MessageSquare size={20} color={Colors.white} />
              {unreadMessages > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadMessages}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Pressable style={styles.statCard} onPress={() => router.push('/(admin)/clients')}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Users size={18} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{stats?.totalClients || 0}</Text>
            <Text style={styles.statLabel}>Clients</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => router.push('/(admin)/upload')}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
              <Images size={18} color="#8B5CF6" />
            </View>
            <Text style={styles.statValue}>{stats?.totalGalleries || 0}</Text>
            <Text style={styles.statLabel}>Galleries</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => router.push('/(admin)/calendar')}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <CreditCard size={18} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{formatCurrency(stats?.totalRevenue || 0)}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => router.push('/(admin)/settings/messaging')}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Smartphone size={18} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{stats?.smsBalance || 0}</Text>
            <Text style={styles.statLabel}>SMS Credits</Text>
          </Pressable>
        </View>

        {/* Revenue Card */}
        <View style={styles.revenueCard}>
          <LinearGradient
            colors={['rgba(16,185,129,0.12)', 'rgba(16,185,129,0.04)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.revenueHeader}>
            <Text style={styles.revenueTitle}>Revenue Overview</Text>
            <TrendingUp size={16} color="#10B981" />
          </View>
          <View style={styles.revenueStats}>
            <View style={styles.revenueStat}>
              <Text style={styles.revenueStatLabel}>This Month</Text>
              <Text style={styles.revenueStatValue}>{formatCurrency(stats?.revenueThisMonth || 0)}</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={styles.revenueStat}>
              <Text style={styles.revenueStatLabel}>Today</Text>
              <Text style={styles.revenueStatValue}>{formatCurrency(stats?.revenueToday || 0)}</Text>
            </View>
          </View>
          {stats?.paidGalleries !== undefined && stats.paidGalleries > 0 && (
            <Text style={styles.revenueSub}>{stats.paidGalleries} paid gallery{stats.paidGalleries !== 1 ? 's' : ''}</Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <Pressable style={styles.actionItem} onPress={() => router.push('/(admin)/upload/new')}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
                <Upload size={20} color={Colors.gold} />
              </View>
              <Text style={styles.actionLabel}>Upload</Text>
            </Pressable>
            <Pressable style={styles.actionItem} onPress={() => router.push('/(admin)/clients')}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                <Users size={20} color="#3B82F6" />
              </View>
              <Text style={styles.actionLabel}>Clients</Text>
            </Pressable>
            <Pressable style={styles.actionItem} onPress={() => router.push('/(admin)/inbox')}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                <MessageSquare size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.actionLabel}>Inbox</Text>
            </Pressable>
            <Pressable style={styles.actionItem} onPress={() => router.push('/(admin)/calendar')}>
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                <Calendar size={20} color="#10B981" />
              </View>
              <Text style={styles.actionLabel}>Calendar</Text>
            </Pressable>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentActivity.length > 0 && (
              <Pressable onPress={() => router.push('/(admin)/inbox')}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            )}
          </View>
          {recentActivity.length > 0 ? (
            <View style={styles.activityCard}>
              {recentActivity.map((item, index) => (
                <View key={item.id} style={[styles.activityItem, index < recentActivity.length - 1 && styles.activityItemBorder]}>
                  <View style={[styles.activityIcon, { backgroundColor: item.color + '18' }]}>
                    {item.icon}
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.activitySubtitle} numberOfLines={1}>{item.subtitle}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Clock size={32} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyText}>No recent activity yet</Text>
              <Text style={styles.emptySubtext}>Activity will appear here as things happen</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'white',
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 20,
  },
  statCard: {
    width: (width - 56) / 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    margin: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  revenueCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    overflow: 'hidden',
  },
  revenueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  revenueTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  revenueStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revenueStat: {
    flex: 1,
  },
  revenueStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
  },
  revenueStatValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#10B981',
  },
  revenueDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
  revenueSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionItem: {
    alignItems: 'center',
    width: (width - 80) / 4,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  activityCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  activityItemBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  emptySubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.25)',
  },
});
