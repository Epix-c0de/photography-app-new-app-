import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Share2,
  Image,
  MessageCircle,
  Shield,
  Users,
  CreditCard,
  Settings,
  Headphones,
  Smartphone,
  Camera,
  Package,
  Lock,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

interface MenuItem {
  label: string;
  route: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  color: string;
  bg: string;
  superAdminOnly?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Settings',
    route: '/(admin)/settings',
    icon: Settings,
    color: '#D4AF37',
    bg: 'rgba(212,175,55,0.1)',
  },
  {
    label: 'BTS Upload',
    route: '/(admin)/bts-announcements',
    icon: Camera,
    color: '#F472B6',
    bg: 'rgba(244,114,182,0.1)',
  },
  {
    label: 'Packages',
    route: '/(admin)/settings/package-editor',
    icon: Package,
    color: '#2DD4BF',
    bg: 'rgba(45,212,191,0.1)',
  },
  {
    label: 'Account & Security',
    route: '/(admin)/settings/security',
    icon: Lock,
    color: '#F43F5E',
    bg: 'rgba(244,63,94,0.1)',
  },
  {
    label: 'Social',
    route: '/(admin)/social',
    icon: Share2,
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.1)',
  },
  {
    label: 'Announcements',
    route: '/(admin)/bts-announcements',
    icon: Image,
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.1)',
  },
  {
    label: 'Support',
    route: '/(admin)/support',
    icon: Headphones,
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
  },
  {
    label: 'Referrals',
    route: '/(admin)/referrals',
    icon: Users,
    color: '#F97316',
    bg: 'rgba(249,115,22,0.1)',
  },
  {
    label: 'SMS History',
    route: '/(admin)/sms-history',
    icon: MessageCircle,
    color: '#06B6D4',
    bg: 'rgba(6,182,212,0.1)',
  },
  {
    label: 'Transactions',
    route: '/(admin)/settings/mpesa-transactions',
    icon: CreditCard,
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.1)',
  },
  {
    label: 'SMS Gateway',
    route: '/(admin)/settings/messaging',
    icon: Smartphone,
    color: '#14B8A6',
    bg: 'rgba(20,184,166,0.1)',
  },
  {
    label: 'Admin Management',
    route: '/(admin)/admin-management',
    icon: Shield,
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.1)',
    superAdminOnly: true,
  },
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const visibleItems = MENU_ITEMS.filter((item) => !item.superAdminOnly || isSuperAdmin);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>More</Text>
          <Text style={styles.headerSubtitle}>Tools, settings & management</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile?.role === 'super_admin' ? 'Super' : 'Admin'}</Text>
            <Text style={styles.statLabel}>Account Type</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>v2.0</Text>
            <Text style={styles.statLabel}>App Version</Text>
          </View>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {visibleItems.map((item) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.cardIcon, { backgroundColor: item.bg }]}>
                <item.icon size={24} color={item.color} strokeWidth={1.8} />
              </View>
              <Text style={styles.cardLabel} numberOfLines={2}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Studio Manager</Text>
          <Text style={styles.footerVersion}>Version 2.0</Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gold,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPressed: {
    backgroundColor: Colors.cardHover,
    borderColor: Colors.gold + '40',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 14,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  footerVersion: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
