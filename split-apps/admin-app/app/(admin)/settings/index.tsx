import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CreditCard,
  MessageSquare,
  Palette,
  Truck,
  Package,
  Droplets,
  ChevronRight,
  LogOut,
  Shield,
  Moon,
  HelpCircle,
  Settings as SettingsIcon,
  Bell,
  Globe,
  Key,
  Receipt,
  Smartphone,
  History,
  Image as ImageIcon,
  Star,
  Gift,
  Headphones,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

type SettingsItem = {
  icon: any;
  label: string;
  subtitle?: string;
  route: string;
  color: string;
};

type SettingsGroup = {
  title: string;
  items: SettingsItem[];
};

const settingsGroups: SettingsGroup[] = [
  {
    title: 'PAYMENTS',
    items: [
      {
        icon: CreditCard,
        label: 'M-Pesa Configuration',
        subtitle: 'Paybill, Till, credentials',
        route: '/(admin)/settings/payments',
        color: '#10B981',
      },
      {
        icon: History,
        label: 'Transaction History',
        subtitle: 'View all M-Pesa payments',
        route: '/(admin)/settings/mpesa-transactions',
        color: '#3B82F6',
      },
    ],
  },
  {
    title: 'MESSAGING',
    items: [
      {
        icon: MessageSquare,
        label: 'SMS Messaging',
        subtitle: 'Templates, credits, history',
        route: '/(admin)/settings/messaging',
        color: '#8B5CF6',
      },
    ],
  },
  {
    title: 'CONTENT',
    items: [
      {
        icon: Palette,
        label: 'Branding',
        subtitle: 'Logo, colors, receipts',
        route: '/(admin)/settings/branding',
        color: Colors.gold,
      },
      {
        icon: Truck,
        label: 'Delivery Gateways',
        subtitle: 'Email, cloud storage',
        route: '/(admin)/settings/delivery',
        color: '#F59E0B',
      },
      {
        icon: Package,
        label: 'Service Packages',
        subtitle: 'Pricing, bundles',
        route: '/(admin)/settings/package-editor',
        color: '#3B82F6',
      },
      {
        icon: Droplets,
        label: 'Watermark',
        subtitle: 'Photo protection',
        route: '/(admin)/settings/watermark',
        color: '#06B6D4',
      },
      {
        icon: Receipt,
        label: 'Receipt Settings',
        subtitle: 'Payment receipts, templates',
        route: '/(admin)/settings/receipt-settings',
        color: '#EC4899',
      },
      {
        icon: Smartphone,
        label: 'USSD Settings',
        subtitle: 'Client access menu',
        route: '/(admin)/settings/ussd-settings/page',
        color: '#14B8A6',
      },
      {
        icon: ImageIcon,
        label: 'Portfolio',
        subtitle: 'Showcase your work',
        route: '/(admin)/portfolio',
        color: '#8B5CF6',
      },
      {
        icon: Star,
        label: 'Reviews',
        subtitle: 'Client feedback',
        route: '/(admin)/reviews',
        color: '#F59E0B',
      },
      {
        icon: Gift,
        label: 'Referrals',
        subtitle: 'Invite, earn credits',
        route: '/(admin)/referrals',
        color: '#EC4899',
      },
      {
        icon: Headphones,
        label: 'Support',
        subtitle: 'Chat with team',
        route: '/(admin)/support',
        color: '#10B981',
      },
    ],
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (e) {
            console.error('Sign out error:', e);
          }
        },
      },
    ]);
  }, [signOut]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(false)}
            tintColor={Colors.gold}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Configure your studio</Text>
        </View>

        {/* Settings Groups */}
        {settingsGroups.map((group, groupIndex) => (
          <View key={groupIndex} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.groupCard}>
              {group.items.map((item, itemIndex) => (
                <Pressable
                  key={itemIndex}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && styles.menuItemPressed,
                    itemIndex < group.items.length - 1 && styles.menuItemBorder,
                  ]}
                  onPress={() => router.push(item.route as any)}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
                    <item.icon size={20} color={item.color} strokeWidth={2} />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    {item.subtitle && (
                      <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                    )}
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Account */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>ACCOUNT</Text>
          <View style={styles.groupCard}>
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed, styles.menuItemBorder]}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#3B82F618' }]}>
                <Shield size={20} color="#3B82F6" strokeWidth={2} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Security</Text>
                <Text style={styles.menuSubtitle}>Password, 2FA</Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed, styles.menuItemBorder]}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#F59E0B18' }]}>
                <Bell size={20} color="#F59E0B" strokeWidth={2} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Notifications</Text>
                <Text style={styles.menuSubtitle}>Push, email alerts</Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={handleSignOut}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#EF444418' }]}>
                <LogOut size={20} color="#EF4444" strokeWidth={2} />
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Sign Out</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Studio Manager v2.0</Text>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
  },
  group: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 4,
  },
  groupCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  menuSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
});
