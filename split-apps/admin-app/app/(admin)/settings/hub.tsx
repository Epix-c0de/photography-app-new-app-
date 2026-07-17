import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Lock,
  CreditCard,
  Droplets,
  Share2,
  Bell,
  Shield,
  Database,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');

type SettingGroup = {
  title: string;
  icon: any;
  color: string;
  items: SettingItem[];
};

type SettingItem = {
  label: string;
  description: string;
  route: string;
  badge?: string | number;
};

export default function SettingsHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [pendingPayments, setPendingPayments] = useState(0);

  useEffect(() => {
    loadPendingPayments();
  }, []);

  const loadPendingPayments = async () => {
    if (!user?.id) return;
    try {
      const { count } = await supabase
        .from('manual_payment_verifications')
        .select('*', { count: 'exact', head: true })
        .eq('admin_id', user.id)
        .eq('status', 'pending');
      setPendingPayments(count || 0);
    } catch {}
  };

  const settingsGroups: SettingGroup[] = [
    {
      title: 'Account',
      icon: User,
      color: Colors.gold,
      items: [
        { label: 'Profile', description: 'Edit your information', route: '/(admin)/settings' },
        { label: 'Security', description: 'Password & login options', route: '/(admin)/settings' },
      ],
    },
    {
      title: 'Business',
      icon: CreditCard,
      color: '#10B981',
      items: [
        { label: 'Payment Setup', description: 'M-Pesa & billing', route: '/(admin)/settings/payments', badge: 'Required' },
        { label: 'Manual Payments', description: 'Review client submissions', route: '/(admin)/settings/manual-payments', badge: pendingPayments > 0 ? pendingPayments : undefined },
        { label: 'Packages', description: 'Pricing tiers', route: '/(admin)/settings/package-editor' },
        { label: 'Delivery', description: 'SMS & download settings', route: '/(admin)/settings/delivery' },
      ],
    },
    {
      title: 'Sharing',
      icon: Share2,
      color: '#8B5CF6',
      items: [
        { label: 'Links & QR Codes', description: 'Your photographer code', route: '/(admin)/settings/links' },
        { label: 'Watermark', description: 'Brand protection', route: '/(admin)/settings' },
      ],
    },
    {
      title: 'Notifications',
      icon: Bell,
      color: '#F59E0B',
      items: [
        { label: 'SMS Management', description: 'Auto-send access codes', route: '/(admin)/settings/messaging' },
        { label: 'Message Templates', description: 'Customize notifications', route: '/(admin)/settings/messaging' },
      ],
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Configure your studio</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        
        {settingsGroups.map((group, groupIndex) => (
          <View key={groupIndex} style={styles.group}>
            {/* Group Header */}
            <View style={styles.groupHeader}>
              <View style={[styles.groupIconContainer, { backgroundColor: `${group.color}15` }]}>
                <group.icon size={20} color={group.color} strokeWidth={2.5} />
              </View>
              <Text style={styles.groupTitle}>{group.title}</Text>
            </View>

            {/* Group Items */}
            <View style={styles.groupItems}>
              {group.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    styles.settingRow,
                    itemIndex === 0 && styles.settingRowFirst,
                    itemIndex === group.items.length - 1 && styles.settingRowLast,
                  ]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    <Text style={styles.settingDescription}>{item.description}</Text>
                  </View>

                  <View style={styles.settingRight}>
                    {item.badge && (
                      <View style={[styles.badge, { backgroundColor: group.color }]}>
                        <Text style={styles.badgeText}>
                          {typeof item.badge === 'number' ? item.badge : item.badge}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => {
              // Handle logout
            }}>
            <Lock size={16} color="#EF4444" />
            <Text style={styles.dangerButtonText}>Sign Out</Text>
          </TouchableOpacity>
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
  header: {
    paddingHorizontal: 24,
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  group: {
    marginBottom: 32,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupItems: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  settingRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  settingRowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chevron: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '300',
  },
  dangerZone: {
    marginTop: 24,
    padding: 20,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
