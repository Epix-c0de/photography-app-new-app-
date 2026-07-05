import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Users,
  Images,
  Calendar,
  CreditCard,
  Upload,
  Smartphone,
  TrendingUp,
  ChevronRight,
  ArrowUpRight,
  Camera,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';

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

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `KES ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `KES ${(amount / 1000).toFixed(0)}K`;
  return `KES ${amount}`;
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
      onPress={onPress}
    >
      {icon}
      <Text style={styles.actionLabel}>{label}</Text>
      <ChevronRight size={14} color="rgba(255,255,255,0.3)" />
    </Pressable>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await AdminService.getDashboardStats(user.id);
      setStats(data);
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
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.title}>{user?.user_metadata?.full_name || 'Admin'}</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: Colors.gold + '20' }]}>
            <Camera size={20} color={Colors.gold} />
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon={<Users size={20} color="#3B82F6" />}
            label="Clients"
            value={String(stats?.totalClients || 0)}
            color="#3B82F6"
          />
          <StatCard
            icon={<Images size={20} color="#8B5CF6" />}
            label="Galleries"
            value={String(stats?.totalGalleries || 0)}
            color="#8B5CF6"
          />
          <StatCard
            icon={<CreditCard size={20} color="#10B981" />}
            label="Revenue"
            value={formatCurrency(stats?.totalRevenue || 0)}
            color="#10B981"
          />
          <StatCard
            icon={<Smartphone size={20} color="#F59E0B" />}
            label="SMS Credits"
            value={String(stats?.smsBalance || 0)}
            color="#F59E0B"
          />
        </View>

        {/* Revenue Card */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <Text style={styles.revenueTitle}>This Month</Text>
            <TrendingUp size={16} color="#10B981" />
          </View>
          <Text style={styles.revenueValue}>{formatCurrency(stats?.revenueThisMonth || 0)}</Text>
          <Text style={styles.revenueSub}>Today: {formatCurrency(stats?.revenueToday || 0)}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsCard}>
            <QuickAction
              icon={<Upload size={18} color={Colors.gold} />}
              label="Upload Gallery"
              onPress={() => router.push('/(admin)/upload/new')}
            />
            <QuickAction
              icon={<Users size={18} color="#3B82F6" />}
              label="Add Client"
              onPress={() => router.push('/(admin)/clients')}
            />
            <QuickAction
              icon={<Calendar size={18} color="#8B5CF6" />}
              label="View Bookings"
              onPress={() => router.push('/(admin)/calendar')}
            />
            <QuickAction
              icon={<CreditCard size={18} color="#10B981" />}
              label="Payment Settings"
              onPress={() => router.push('/(admin)/settings/payments')}
            />
          </View>
        </View>

        {/* Recent Activity Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No recent activity</Text>
          </View>
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
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 20,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    margin: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  revenueCard: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  revenueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  revenueTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#10B981',
    marginBottom: 4,
  },
  revenueSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  actionsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  actionCardPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
});
