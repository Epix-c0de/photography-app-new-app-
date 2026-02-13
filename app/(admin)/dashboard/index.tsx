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
      {/* Storage Projection Card */}
      <View style={styles.forecastCard}>
        <View style={styles.forecastHeader}>
          <Database size={18} color={Colors.gold} />
          <Text style={styles.forecastTitle}>Storage Projection</Text>
        </View>
        <View style={styles.storageGrid}>
          <View style={styles.storageItem}>
            <Text style={styles.storageLabel}>Current</Text>
            <Text style={styles.storageValue}>{currentStorageGB} GB</Text>
          </View>
          <View style={styles.storageDivider} />
          <View style={styles.storageItem}>
            <Text style={styles.storageLabel}>In 6 Months</Text>
            <Text style={[styles.storageValue, { color: Colors.warning }]}>
              ~{projectedStorage6Mo.toFixed(0)} GB
            </Text>
          </View>
        </View>
        <View style={styles.alertBox}>
          <AlertTriangle size={14} color={Colors.warning} />
          <Text style={styles.alertText}>
            {"You'll need +100GB in approx. 8 months at current growth."}
          </Text>
        </View>
      </View>

      {/* Revenue vs Cost Card */}
      <View style={styles.forecastCard}>
        <View style={styles.forecastHeader}>
          <TrendingUp size={18} color={Colors.success} />
          <Text style={styles.forecastTitle}>Revenue vs Storage Cost</Text>
        </View>
        <View style={styles.costRow}>
          <View>
            <Text style={styles.costLabel}>Est. Monthly Revenue</Text>
            <Text style={styles.costValue}>KES 160,000</Text>
          </View>
          <View style={styles.costBadge}>
            <ArrowUpRight size={12} color={Colors.success} />
            <Text style={styles.costBadgeText}>Healthy</Text>
          </View>
        </View>
        <View style={styles.costRow}>
          <View>
            <Text style={styles.costLabel}>Est. Storage Cost</Text>
            <Text style={styles.costValue}>KES {Math.ceil(currentStorageGB * costPerGB)}</Text>
          </View>
          <Text style={styles.costRatio}>&lt; 0.1% of revenue</Text>
        </View>
      </View>

      {/* Package Performance */}
      <View style={styles.forecastCard}>
        <View style={styles.forecastHeader}>
          <Briefcase size={18} color="#6C9AED" />
          <Text style={styles.forecastTitle}>Top Packages</Text>
        </View>
        <View style={styles.packageList}>
          {[
            { name: 'Portrait Gold', share: 45, color: Colors.gold },
            { name: 'Mini Shoot', share: 30, color: Colors.success },
            { name: 'Event Standard', share: 25, color: '#6C9AED' },
          ].map((pkg) => (
            <View key={pkg.name} style={styles.packageItem}>
              <View style={styles.packageInfo}>
                <Text style={styles.packageName}>{pkg.name}</Text>
                <Text style={styles.packageShare}>{pkg.share}% of bookings</Text>
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
  
  const [stats, setStats] = useState<DashboardStats>({
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ok = await verifyAdminGuard('open_dashboard');
      if (!ok) {
        router.replace('/admin-login');
        return;
      }
      
      try {
        const [analytics, galleries] = await Promise.all([
          AdminService.dashboard.getAnalytics(),
          AdminService.gallery.list()
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
        
        // TODO: Fetch bookings from DB when table exists
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
            colors={['rgba(212,175,55,0.06)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerGreeting}>{getGreeting()}</Text>
              <Text style={styles.headerRole}>Admin Command Center</Text>
            </View>
            <View style={styles.headerBadge}>
              <Shield size={16} color={Colors.gold} />
            </View>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <Pressable 
              style={[styles.tab, viewMode === 'overview' && styles.tabActive]} 
              onPress={() => { setViewMode('overview'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[styles.tabText, viewMode === 'overview' && styles.tabTextActive]}>Overview</Text>
            </Pressable>
            <Pressable 
              style={[styles.tab, viewMode === 'forecast' && styles.tabActive]} 
              onPress={() => { setViewMode('forecast'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <TrendingUp size={14} color={viewMode === 'forecast' ? Colors.gold : Colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabText, viewMode === 'forecast' && styles.tabTextActive]}>Business Forecast</Text>
            </Pressable>
          </View>

          {viewMode === 'overview' ? (
            <View style={styles.revenueSummary}>
              <View style={styles.revenueMain}>
                <Text style={styles.revenueLabel}>Total Revenue</Text>
                <Text style={styles.revenueAmount}>{formatCurrency(stats.totalRevenue)}</Text>
              </View>
              <View style={styles.revenueDivider} />
              <View style={styles.revenueSecondary}>
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueItemLabel}>Today</Text>
                  <Text style={styles.revenueItemValue}>{formatCurrency(stats.revenueToday)}</Text>
                </View>
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueItemLabel}>This Month</Text>
                  <Text style={styles.revenueItemValue}>{formatCurrency(stats.revenueThisMonth)}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.forecastSummary}>
              <View style={styles.forecastStat}>
                <Text style={styles.forecastStatLabel}>Monthly Growth</Text>
                <View style={styles.forecastStatValueRow}>
                  <ArrowUpRight size={14} color={Colors.success} />
                  <Text style={styles.forecastStatValue}>+12.5%</Text>
                </View>
              </View>
              <View style={styles.revenueDivider} />
              <View style={styles.forecastStat}>
                <Text style={styles.forecastStatLabel}>Est. Year Revenue</Text>
                <Text style={styles.forecastStatValue}>KES 1.9M</Text>
              </View>
            </View>
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
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerGreeting: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  headerRole: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  revenueSummary: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
  },
  revenueMain: {
    marginBottom: 14,
  },
  revenueLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  revenueAmount: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.gold,
  },
  revenueDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 14,
  },
  revenueSecondary: {
    flexDirection: 'row' as const,
    gap: 24,
  },
  revenueItem: {},
  revenueItemLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  revenueItemValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  tabContainer: {
    flexDirection: 'row' as const,
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.gold,
  },
  forecastSummary: {
    flexDirection: 'row' as const,
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  forecastStat: {
    flex: 1,
  },
  forecastStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  forecastStatValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
  },
  forecastStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
    marginLeft: 4,
  },
  forecastContainer: {
    padding: 20,
  },
  forecastCard: {
    backgroundColor: '#141414',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  forecastHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center', 
    marginBottom: 16,
  },
  forecastTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
    marginLeft: 10,
  },
  storageGrid: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    marginBottom: 16,
  },
  storageItem: {
    flex: 1,
  },
  storageLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  storageValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  storageDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  alertBox: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: 'rgba(255,153,0,0.08)',
    padding: 10,
    borderRadius: 8,
  },
  alertText: {
    fontSize: 11,
    color: Colors.warning,
    marginLeft: 8,
    flex: 1,
  },
  costRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  costLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  costValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  costBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: 'rgba(46,204,113,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  costBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.success,
    marginLeft: 4,
  },
  costRatio: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600' as const,
  },
  packageList: {
    marginTop: 8,
  },
  packageItem: {
    marginBottom: 16,
  },
  packageInfo: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  packageName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  packageShare: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  shareBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  shareBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  quickActionsGrid: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  quickActionLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  statsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: (width - 50) / 2,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  statSub: {
    fontSize: 11,
    color: Colors.success,
    marginTop: 2,
    fontWeight: '500' as const,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '500' as const,
    marginBottom: 12,
  },
  chartContainer: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  chartTitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  chartBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(46,204,113,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chartBadgeText: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '600' as const,
  },
  chartAmount: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.white,
    marginBottom: 18,
  },
  chartBars: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    gap: 6,
  },
  chartBarColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarTrack: {
    width: '100%',
    height: 80,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'flex-end',
    overflow: 'hidden' as const,
  },
  chartBar: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(212,175,55,0.35)',
  },
  chartBarActive: {
    backgroundColor: Colors.gold,
  },
  chartBarLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 6,
    fontWeight: '500' as const,
  },
  chartBarLabelActive: {
    color: Colors.gold,
    fontWeight: '700' as const,
  },
  smsCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
  },
  smsCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  smsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smsCardContent: {
    flex: 1,
  },
  smsCardTitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  smsCardBalance: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  smsRefillButton: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  smsRefillText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  smsBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  smsBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
  pendingItem: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: '#141414',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pendingItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,153,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pendingItemContent: {
    flex: 1,
  },
  pendingItemTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  pendingItemSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bookingItem: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: '#141414',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bookingStatus: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bookingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bookingItemContent: {
    flex: 1,
  },
  bookingItemTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  bookingItemSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bookingTypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bookingTypeText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
