import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  Images,
  Calendar,
  CreditCard,
  Upload,
  UserPlus,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Smartphone,
  Eye,
  Heart,
  MessageCircle,
  MousePointerClick,
  Repeat,
  Shield,
  TrendingUp,
  Database,
  Briefcase
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';

const { width } = Dimensions.get('window');

// Placeholder for chart data until we implement granular analytics
const weeklyRevenuePlaceholder = [
  { label: 'Mon', amount: 0 },
  { label: 'Tue', amount: 0 },
  { label: 'Wed', amount: 0 },
  { label: 'Thu', amount: 0 },
  { label: 'Fri', amount: 0 },
  { label: 'Sat', amount: 0 },
  { label: 'Sun', amount: 0 },
];

type DashboardStats = {
  totalClients: number;
  totalGalleries: number;
  paidGalleries: number;
  totalRevenue: number;
  revenueToday: number;
  revenueThisMonth: number;
  revenueThisWeek: number;
  smsBalance: number;
  conversionRate: number;
  repeatClientRate: number;
  engagement?: {
    views: number;
    likes: number;
    comments: number;
    clicks: number;
  };
};

function BusinessForecast() {
  const currentStorageGB = 2.4;
  const avgMonthlyGrowthGB = 13.5;
  const projectedStorage6Mo = currentStorageGB + (avgMonthlyGrowthGB * 6);
  const costPerGB = 3.5; // KES

  return (
    <View style={styles.forecastContainer}>
      {/* Storage Projection Card - PREMIUM RE-DESIGN */}
      <View style={[styles.forecastCard, { backgroundColor: '#111', borderColor: Colors.gold + '25' }]}>
        <View style={styles.forecastHeader}>
          <View style={[styles.iconBox, { backgroundColor: Colors.gold + '15' }]}>
            <Database size={16} color={Colors.gold} />
          </View>
          <Text style={styles.forecastTitle}>Intelligent Storage Projection</Text>
        </View>
        <View style={styles.storageGrid}>
          <View style={styles.storageItem}>
            <Text style={styles.storageLabel}>Current Library</Text>
            <Text style={styles.storageValue}>{currentStorageGB.toFixed(2)} GB</Text>
          </View>
          <View style={styles.storageDivider} />
          <View style={styles.storageItem}>
            <Text style={styles.storageLabel}>Velocity (+6mo)</Text>
            <Text style={[styles.storageValue, { color: Colors.warning }]}>
              +{(avgMonthlyGrowthGB * 6).toFixed(0)} GB
            </Text>
          </View>
        </View>
        <LinearGradient
          colors={[Colors.warning + '15', 'transparent']}
          style={styles.premiumAlert}
        >
          <AlertTriangle size={14} color={Colors.warning} />
          <Text style={styles.alertText}>
            {"Storage expansion recommended by Q4 2026."}
          </Text>
        </LinearGradient>
      </View>

      {/* Revenue vs Cost Card - PREMIUM RE-DESIGN */}
      <View style={[styles.forecastCard, { backgroundColor: '#111', borderColor: Colors.success + '25' }]}>
        <View style={styles.forecastHeader}>
          <View style={[styles.iconBox, { backgroundColor: Colors.success + '15' }]}>
            <TrendingUp size={16} color={Colors.success} />
          </View>
          <Text style={styles.forecastTitle}>Profitability Index</Text>
        </View>
        <View style={styles.costRow}>
          <View>
            <Text style={styles.costLabel}>Monthly Gross Forecast</Text>
            <Text style={[styles.costValue, { fontSize: 24, color: Colors.white }]}>KES 245,000</Text>
          </View>
          <View style={[styles.costBadge, { backgroundColor: Colors.success + '20' }]}>
            <ArrowUpRight size={12} color={Colors.success} />
            <Text style={[styles.costBadgeText, { color: Colors.success }]}>+18.4%</Text>
          </View>
        </View>
        <View style={styles.costRow}>
          <View>
            <Text style={styles.costLabel}>Asset Maintenance Cost</Text>
            <Text style={styles.costValue}>KES {Math.ceil(currentStorageGB * costPerGB)}</Text>
          </View>
          <Text style={[styles.costRatio, { color: Colors.success }]}>Highly Profitable</Text>
        </View>
      </View>

      {/* High-Performance Categories */}
      <View style={[styles.forecastCard, { backgroundColor: '#111', borderColor: '#6C9AED' + '25' }]}>
        <View style={styles.forecastHeader}>
          <View style={[styles.iconBox, { backgroundColor: '#6C9AED' + '15' }]}>
            <Briefcase size={16} color="#6C9AED" />
          </View>
          <Text style={styles.forecastTitle}>Category Performance</Text>
        </View>
        <View style={styles.packageList}>
          {[
            { name: 'Wedding Luxury', share: 52, color: Colors.gold, trend: '+5%' },
            { name: 'Studio Portraits', share: 28, color: Colors.success, trend: '+12%' },
            { name: 'Corporate Events', share: 20, color: '#6C9AED', trend: '-2%' },
          ].map((pkg) => (
            <View key={pkg.name} style={styles.packageItem}>
              <View style={styles.packageInfo}>
                <View>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <Text style={styles.packageShare}>{pkg.share}% share</Text>
                </View>
                <Text style={{ fontSize: 10, color: pkg.trend.startsWith('+') ? Colors.success : Colors.error, fontWeight: '700' }}>{pkg.trend}</Text>
              </View>
              <View style={styles.shareBarTrack}>
                <View style={[styles.shareBarFill, { width: `${pkg.share}%`, backgroundColor: pkg.color }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `KES ${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `KES ${(amount / 1000).toFixed(0)}K`;
  }
  return `KES ${amount}`;
}

function StatCard({ icon, label, value, subValue, color, delay }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: string;
  delay: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, delay]);

  return (
    <Animated.View style={[styles.statCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '18' }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {subValue && <Text style={styles.statSub}>{subValue}</Text>}
    </Animated.View>
  );
}

function RevenueChart({ revenue }: { revenue: number }) {
  // Use placeholder data but update total amount if available
  // In future, pass real weekly data
  const data = weeklyRevenuePlaceholder;
  const maxAmount = useMemo(() => Math.max(...data.map(d => d.amount)) || 100, [data]);
  const barAnims = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = barAnims.map((anim, index) =>
      Animated.timing(anim, { toValue: 1, duration: 600, delay: index * 80, useNativeDriver: false })
    );
    Animated.stagger(60, animations).start();
  }, [barAnims]);

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>This Week</Text>
        <View style={styles.chartBadge}>
          <ArrowUpRight size={12} color={Colors.success} />
          <Text style={styles.chartBadgeText}>+0%</Text>
        </View>
      </View>
      <Text style={styles.chartAmount}>{formatCurrency(revenue)}</Text>
      <View style={styles.chartBars}>
        {data.map((item, index) => {
          const heightPercent = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
          const animHeight = barAnims[index].interpolate({
            inputRange: [0, 1],
            outputRange: [0, heightPercent || 5], // Min height for visibility
          });
          const isToday = index === new Date().getDay() - 1;
          return (
            <View key={item.label} style={styles.chartBarColumn}>
              <View style={styles.chartBarTrack}>
                <Animated.View
                  style={[
                    styles.chartBar,
                    isToday && styles.chartBarActive,
                    {
                      height: animHeight.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.chartBarLabel, isToday && styles.chartBarLabelActive]}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function QuickActionButton({ icon, label, onPress, badgeCount }: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  badgeCount?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  }, [scaleAnim, onPress]);

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.quickAction, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.quickActionIcon}>
          {icon}
          {badgeCount !== undefined && badgeCount > 0 && (
            <View style={styles.quickActionBadge}>
              <Text style={styles.quickActionBadgeText}>{badgeCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.quickActionLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getGreeting, verifyAdminGuard } = useAuth();
  const [accessReady, setAccessReady] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'overview' | 'forecast'>('overview');

  const [stats, setStats] = useState<DashboardStats>(AdminService.cache.get('dashboard') || {
    totalClients: 0,
    totalGalleries: 0,
    paidGalleries: 0,
    totalRevenue: 0,
    revenueToday: 0,
    revenueThisMonth: 0,
    revenueThisWeek: 0,
    smsBalance: 0,
    conversionRate: 0,
    repeatClientRate: 0,
    engagement: { views: 0, likes: 0, comments: 0, clicks: 0 },
  });
  const [unpaidGalleries, setUnpaidGalleries] = useState<any[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(!AdminService.cache.get('dashboard'));

  useEffect(() => {
    (async () => {
      const ok = await verifyAdminGuard('open_dashboard');
      if (!ok) {
        router.replace('/admin-login');
        return;
      }

      try {
        const [analytics, galleries, clients] = await Promise.all([
          AdminService.dashboard.getAnalytics(),
          AdminService.gallery.list(),
          AdminService.clients.list() // Pre-fetch clients for faster upload screen
        ]);

        setStats(analytics);

        // Transform galleries for UI
        const unpaid = (galleries || [])
          .filter((g: any) => !g.is_paid)
          .map((g: any) => ({
            id: g.id,
            title: g.name,
            clientName: g.clients?.name || 'Unknown',
            price: g.price
          }));

        setUnpaidGalleries(unpaid);
        setUpcomingBookings([]);

      } catch (e) {
        console.error('Failed to load dashboard data:', e);
      } finally {
        setIsLoading(false);
        setAccessReady(true);
      }
    })();
  }, [router, verifyAdminGuard]);

  if (!accessReady || isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <LinearGradient
            colors={['rgba(212,175,55,0.1)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerGreeting}>{getGreeting()}</Text>
              <Text style={styles.headerRole}>Admin Command Center</Text>
            </View>
            <Pressable 
              style={styles.headerBadge}
              onPress={() => router.push('/(admin)/settings')}
            >
              <Shield size={18} color={Colors.gold} />
            </Pressable>
          </View>

          {/* Premium Overview Card */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tab, viewMode === 'overview' && styles.tabActive]}
              onPress={() => { setViewMode('overview'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[styles.tabText, viewMode === 'overview' && styles.tabTextActive]}>Analytics Overview</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, viewMode === 'forecast' && styles.tabActive]}
              onPress={() => { setViewMode('forecast'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <TrendingUp size={14} color={viewMode === 'forecast' ? Colors.gold : Colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabText, viewMode === 'forecast' && styles.tabTextActive]}>Business Growth</Text>
            </Pressable>
          </View>

          {viewMode === 'overview' ? (
            <LinearGradient
              colors={['#1A1A1A', '#0F0F0F']}
              style={styles.revenueSummary}
            >
              <View style={styles.revenueMain}>
                <Text style={styles.revenueLabel}>TOTAL BUSINESS REVENUE</Text>
                <Text style={styles.revenueAmount}>{formatCurrency(stats.totalRevenue)}</Text>
              </View>
              <View style={styles.revenueDivider} />
              <View style={styles.revenueSecondary}>
                <View style={[styles.revenueItem, { flex: 1 }]}>
                  <Text style={styles.revenueItemLabel}>Today</Text>
                  <Text style={[styles.revenueItemValue, { color: Colors.success }]}>+{formatCurrency(stats.revenueToday)}</Text>
                </View>
                <View style={[styles.revenueItem, { flex: 1 }]}>
                  <Text style={styles.revenueItemLabel}>This Month</Text>
                  <Text style={styles.revenueItemValue}>{formatCurrency(stats.revenueThisMonth)}</Text>
                </View>
              </View>
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={['#1A1A1A', '#0F0F0F']}
              style={styles.forecastSummary}
            >
              <View style={styles.forecastStat}>
                <Text style={styles.forecastStatLabel}>Monthly Growth</Text>
                <View style={styles.forecastStatValueRow}>
                  <TrendingUp size={16} color={Colors.success} />
                  <Text style={[styles.forecastStatValue, { color: Colors.success }]}>+12.5%</Text>
                </View>
              </View>
              <View style={styles.revenueDividerVertical} />
              <View style={styles.forecastStat}>
                <Text style={styles.forecastStatLabel}>Est. Year Revenue</Text>
                <Text style={styles.forecastStatValue}>KES 1.95M</Text>
              </View>
            </LinearGradient>
          )}
        </View>

        {viewMode === 'overview' ? (
          <>
            <View style={styles.quickActionsSection}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                <QuickActionButton
                  icon={<Upload size={20} color={Colors.gold} />}
                  label="Upload Gallery"
                  onPress={() => router.push('/(admin)/upload')}
                />
                <QuickActionButton
                  icon={<UserPlus size={20} color={Colors.success} />}
                  label="Add Client"
                  onPress={() => router.push('/(admin)/clients')}
                />
                <QuickActionButton
                  icon={<CreditCard size={20} color={Colors.warning} />}
                  label="Pending Pay"
                  onPress={() => router.push('/(admin)/clients')}
                  badgeCount={unpaidGalleries.length}
                />
                <QuickActionButton
                  icon={<Calendar size={20} color="#6C9AED" />}
                  label="Today's Shoots"
                  onPress={() => router.push('/(admin)/admin-bookings')}
                  badgeCount={upcomingBookings.length}
                />
              </View>
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                icon={<Users size={18} color={Colors.gold} />}
                label="Clients"
                value={String(stats.totalClients)}
                color={Colors.gold}
                delay={0}
              />
              <StatCard
                icon={<Images size={18} color={Colors.success} />}
                label="Galleries"
                value={String(stats.totalGalleries)}
                subValue={`${stats.paidGalleries} paid`}
                color={Colors.success}
                delay={100}
              />
              <StatCard
                icon={<Eye size={18} color="#6C9AED" />}
                label="Conversion"
                value={`${stats.conversionRate}%`}
                color="#6C9AED"
                delay={200}
              />
              <StatCard
                icon={<Repeat size={18} color="#E879A8" />}
                label="Repeat Rate"
                value={`${stats.repeatClientRate}%`}
                color="#E879A8"
                delay={300}
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Engagement Analytics</Text>
            </View>
            <View style={styles.statsGrid}>
              <StatCard
                icon={<Eye size={18} color={Colors.gold} />}
                label="Total Views"
                value={String(stats.engagement?.views || 0)}
                color={Colors.gold}
                delay={400}
              />
              <StatCard
                icon={<Heart size={18} color={Colors.error} />}
                label="Total Likes"
                value={String(stats.engagement?.likes || 0)}
                color={Colors.error}
                delay={500}
              />
              <StatCard
                icon={<MessageCircle size={18} color="#6C9AED" />}
                label="Comments"
                value={String(stats.engagement?.comments || 0)}
                color="#6C9AED"
                delay={600}
              />
              <StatCard
                icon={<MousePointerClick size={18} color={Colors.success} />}
                label="Link Clicks"
                value={String(stats.engagement?.clicks || 0)}
                color={Colors.success}
                delay={700}
              />
            </View>

            <View style={styles.section}>
              <RevenueChart revenue={stats.revenueThisWeek} />
            </View>

            <View style={styles.section}>
              <View style={styles.smsCard}>
                <LinearGradient
                  colors={['rgba(212,175,55,0.08)', 'rgba(212,175,55,0.02)']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={styles.smsCardHeader}>
                  <View style={styles.smsIconContainer}>
                    <Smartphone size={18} color={Colors.gold} />
                  </View>
                  <View style={styles.smsCardContent}>
                    <Text style={styles.smsCardTitle}>SMS Balance</Text>
                    <Text style={styles.smsCardBalance}>{stats.smsBalance} credits</Text>
                  </View>
                  <Pressable
                    style={styles.smsRefillButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/(admin)/settings');
                    }}
                  >
                    <Text style={styles.smsRefillText}>Refill</Text>
                  </Pressable>
                </View>
                <View style={styles.smsBarTrack}>
                  <View style={[styles.smsBarFill, { width: `${Math.min((stats.smsBalance / 500) * 100, 100)}%` }]} />
                </View>
              </View>
            </View>

            {unpaidGalleries.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Pending Payments</Text>
                  <Pressable onPress={() => router.push('/(admin)/clients')}>
                    <Text style={styles.seeAll}>View all</Text>
                  </Pressable>
                </View>
                {unpaidGalleries.map((gallery) => (
                  <Pressable
                    key={gallery.id}
                    style={styles.pendingItem}
                    onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                  >
                    <View style={styles.pendingItemIcon}>
                      <AlertTriangle size={16} color={Colors.warning} />
                    </View>
                    <View style={styles.pendingItemContent}>
                      <Text style={styles.pendingItemTitle}>{gallery.title}</Text>
                      <Text style={styles.pendingItemSub}>{gallery.clientName} · {formatCurrency(gallery.price)}</Text>
                    </View>
                    <ChevronRight size={16} color={Colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}

            {upcomingBookings.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Upcoming Shoots</Text>
                  <Pressable onPress={() => router.push('/(admin)/admin-bookings')}>
                    <Text style={styles.seeAll}>View all</Text>
                  </Pressable>
                </View>
                {upcomingBookings.slice(0, 3).map((booking) => (
                  <Pressable
                    key={booking.id}
                    style={styles.bookingItem}
                    onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                  >
                    <View style={[styles.bookingStatus, { backgroundColor: booking.status === 'confirmed' ? Colors.success + '25' : Colors.warning + '25' }]}>
                      <View style={[styles.bookingStatusDot, { backgroundColor: booking.status === 'confirmed' ? Colors.success : Colors.warning }]} />
                    </View>
                    <View style={styles.bookingItemContent}>
                      <Text style={styles.bookingItemTitle}>{booking.clientName}</Text>
                      <Text style={styles.bookingItemSub}>{booking.date} · {booking.time} · {booking.location}</Text>
                    </View>
                    <View style={styles.bookingTypeBadge}>
                      <Text style={styles.bookingTypeText}>{booking.type}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <BusinessForecast />
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    zIndex: 1,
  },
  headerGreeting: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.white,
    letterSpacing: -0.5,
  },
  headerRole: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  tabContainer: {
    flexDirection: 'row' as const,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
  },
  tabActive: {
    backgroundColor: 'rgba(212,175,55,0.2)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.gold,
    fontWeight: '700' as const,
  },
  revenueSummary: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
  },
  revenueMain: {
    marginBottom: 20,
  },
  revenueLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700' as const,
    marginBottom: 8,
    letterSpacing: 2,
  },
  revenueAmount: {
    fontSize: 38,
    fontWeight: '900' as const,
    color: Colors.gold,
    letterSpacing: -1,
  },
  revenueDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 20,
  },
  revenueDividerVertical: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
  },
  revenueSecondary: {
    flexDirection: 'row' as const,
  },
  revenueItem: {},
  revenueItemLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  revenueItemValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  forecastSummary: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  forecastStat: {
    flex: 1,
  },
  forecastStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600' as const,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  forecastStatValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
  },
  forecastStatValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.white,
    marginLeft: 6,
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.white,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  quickActionsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  quickAction: {
    width: (width - 52) / 2,
    backgroundColor: '#161616',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadge: {
    position: 'absolute' as const,
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#161616',
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: Colors.background,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.white,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 24,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: '#111111',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.white,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  statSub: {
    fontSize: 10,
    color: Colors.gold,
    fontWeight: '700' as const,
    marginTop: 4,
    textTransform: 'uppercase' as const,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 16,
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  chartContainer: {
    backgroundColor: '#111111',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  chartHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  chartBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: 'rgba(52,199,89,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  chartBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  chartAmount: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.white,
    marginBottom: 24,
  },
  chartBars: {
    flexDirection: 'row' as const,
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  chartBarColumn: {
    alignItems: 'center',
    width: 24,
  },
  chartBarTrack: {
    flex: 1,
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 3,
    marginBottom: 8,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
  },
  chartBarActive: {
    backgroundColor: Colors.gold,
  },
  chartBarLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600' as const,
  },
  chartBarLabelActive: {
    color: Colors.gold,
    fontWeight: '800' as const,
  },
  smsCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: '#111111',
  },
  smsCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  smsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
  },
  smsCardContent: {
    flex: 1,
  },
  smsCardTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  smsCardBalance: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  smsRefillButton: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  smsRefillText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  smsBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    width: '100%',
  },
  smsBarFill: {
    height: '100%',
    backgroundColor: Colors.gold,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.gold,
  },
  pendingItem: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 14,
  },
  pendingItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,159,10,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingItemContent: {
    flex: 1,
  },
  pendingItemTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  pendingItemSub: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  bookingItem: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 14,
  },
  bookingStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bookingItemContent: {
    flex: 1,
  },
  bookingItemTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  bookingItemSub: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  bookingTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bookingTypeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
  },
  forecastContainer: {
    padding: 20,
    gap: 20,
  },
  forecastCard: {
    backgroundColor: '#111111',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  forecastHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    marginBottom: 24,
  },
  forecastTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.white,
    marginLeft: 12,
    letterSpacing: -0.3,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  storageGrid: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    marginBottom: 24,
  },
  storageItem: {
    flex: 1,
  },
  storageLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  storageValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  storageDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 20,
  },
  alertText: {
    fontSize: 12,
    color: Colors.warning,
    flex: 1,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  costRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  costLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  costValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  costBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: 'rgba(52,199,89,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  costBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  costRatio: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600' as const,
  },
  packageList: {
    gap: 20,
  },
  packageItem: {},
  packageInfo: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  packageName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  packageShare: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600' as const,
  },
  shareBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  shareBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});

