import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MessageSquare, HardDrive, CreditCard, Zap, Shield,
  RefreshCw, Clock, Package, Star, Check, AlertCircle, Send
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface SmsPackage {
  id: string;
  name: string;
  sms_count: number;
  price: number;
  description: string | null;
  is_active: boolean;
  is_featured: boolean;
}

interface StorageTier {
  id: string;
  name: string;
  storage_mb: number;
  price_kes: number;
  is_active: boolean;
  display_order: number;
}

interface StorageInfo {
  base_mb: number;
  extra_mb: number;
  total_mb: number;
  used_mb: number;
}

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function CreditsStorageScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const [smsBalance, setSmsBalance] = useState(0);
  const [smsPackages, setSmsPackages] = useState<SmsPackage[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [storageTiers, setStorageTiers] = useState<StorageTier[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [smsHistory, setSmsHistory] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [
        { data: packages },
        { data: tiers },
        { data: credits },
        { data: storageAlloc },
        { data: storageUsage },
        { data: txns },
        { data: smsLogs },
      ] = await Promise.all([
        supabase.from('sms_credit_packages').select('*').eq('is_active', true).order('price'),
        supabase.from('storage_tiers').select('*').eq('is_active', true).order('display_order'),
        supabase.from('sms_credits').select('balance').eq('admin_id', user?.id).single(),
        supabase.from('admin_storage_allocations').select('*').eq('admin_id', user?.id).single(),
        supabase.from('admin_storage_usage').select('used_bytes').eq('admin_id', user?.id).single(),
        supabase.from('sms_purchase_transactions').select('*').eq('admin_id', user?.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('delivery_logs').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      setSmsPackages((packages || []) as SmsPackage[]);
      setStorageTiers((tiers || []) as StorageTier[]);
      setSmsBalance(credits?.balance || 0);

      if (storageAlloc) {
        const usedBytes = storageUsage?.used_bytes || 0;
        setStorageInfo({
          base_mb: storageAlloc.base_storage_mb || 10240,
          extra_mb: storageAlloc.extra_storage_mb || 0,
          total_mb: (storageAlloc.base_storage_mb || 10240) + (storageAlloc.extra_storage_mb || 0),
          used_mb: Math.round(usedBytes / 1048576 * 10) / 10,
        });
      }

      setRecentActivity(txns || []);
      setSmsHistory(smsLogs || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBuySms = async (pkg: SmsPackage) => {
    Alert.alert(
      'Buy SMS Credits',
      `${pkg.name} — ${pkg.sms_count} SMS for KES ${pkg.price.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Pay KES ${pkg.price.toLocaleString()}`,
          onPress: async () => {
            try {
              setPurchasing(pkg.id);

              // Record the purchase via RPC
              const { data, error } = await supabase.rpc('complete_sms_purchase' as any, {
                p_admin_id: user?.id,
                p_package_id: pkg.id,
                p_sms_count: pkg.sms_count,
                p_amount: pkg.price,
                p_receipt: null,
                p_phone: null,
              });

              if (error) {
                // Fallback: directly insert and update
                await supabase.from('sms_purchase_transactions').insert({
                  admin_id: user?.id,
                  package_id: pkg.id,
                  sms_count: pkg.sms_count,
                  amount: pkg.price,
                  status: 'completed',
                });

                const { data: current } = await supabase
                  .from('sms_credits')
                  .select('balance, total_purchased')
                  .eq('admin_id', user?.id)
                  .single();

                if (current) {
                  await supabase.from('sms_credits').update({
                    balance: current.balance + pkg.sms_count,
                    total_purchased: current.total_purchased + pkg.sms_count,
                    updated_at: new Date().toISOString(),
                  }).eq('admin_id', user?.id);
                } else {
                  await supabase.from('sms_credits').insert({
                    admin_id: user?.id,
                    balance: pkg.sms_count,
                    total_purchased: pkg.sms_count,
                  });
                }
              }

              setSmsBalance(prev => prev + pkg.sms_count);
              Alert.alert('Success', `${pkg.sms_count} SMS credits added!`);
              loadData();
            } catch (error: any) {
              Alert.alert('Failed', error.message || 'Could not complete purchase.');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  };

  const handleBuyStorage = async (tier: StorageTier) => {
    const sizeLabel = formatMB(tier.storage_mb);
    Alert.alert(
      'Buy Storage',
      `${tier.name} — ${sizeLabel} for KES ${tier.price_kes.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Pay KES ${tier.price_kes.toLocaleString()}`,
          onPress: async () => {
            try {
              setPurchasing(tier.id);

              const { error } = await supabase.rpc('record_storage_purchase' as any, {
                p_admin_id: user?.id,
                p_tier_id: tier.id,
                p_storage_mb: tier.storage_mb,
                p_amount_kes: tier.price_kes,
              });

              if (error) {
                // Fallback: direct upsert
                await supabase.from('storage_purchases').insert({
                  admin_id: user?.id,
                  tier_id: tier.id,
                  storage_mb: tier.storage_mb,
                  amount_kes: tier.price_kes,
                  status: 'completed',
                });

                const { data: alloc } = await supabase
                  .from('admin_storage_allocations')
                  .select('extra_storage_mb')
                  .eq('admin_id', user?.id)
                  .single();

                if (alloc) {
                  await supabase.from('admin_storage_allocations').update({
                    extra_storage_mb: alloc.extra_storage_mb + tier.storage_mb,
                    updated_at: new Date().toISOString(),
                  }).eq('admin_id', user?.id);
                } else {
                  await supabase.from('admin_storage_allocations').insert({
                    admin_id: user?.id,
                    extra_storage_mb: tier.storage_mb,
                  });
                }
              }

              setStorageInfo(prev => prev ? {
                ...prev,
                extra_mb: prev.extra_mb + tier.storage_mb,
                total_mb: prev.total_mb + tier.storage_mb,
              } : null);
              Alert.alert('Success', `${sizeLabel} of storage added!`);
              loadData();
            } catch (error: any) {
              Alert.alert('Failed', error.message || 'Could not complete purchase.');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  };

  const storageUsagePercent = storageInfo && storageInfo.total_mb > 0
    ? Math.min((storageInfo.used_mb / storageInfo.total_mb) * 100, 100)
    : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Credits & Storage',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          headerRight: () => (
            <TouchableOpacity onPress={loadData} style={{ marginRight: 4 }}>
              <RefreshCw size={18} color={Colors.gold} />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── SMS Credits ── */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <MessageSquare size={16} color={Colors.gold} />
            </View>
            <Text style={styles.sectionTitle}>SMS Credits</Text>
          </View>

          <View style={styles.balanceCard}>
            <View style={styles.balanceTop}>
              <View>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceValue}>{smsBalance}</Text>
              </View>
              <View style={styles.balanceIconWrap}>
                <CreditCard size={24} color={Colors.gold} />
              </View>
            </View>
          </View>

          {smsPackages.length > 0 && (
            <>
              <Text style={styles.packagesLabel}>Buy Credits</Text>
              <View style={styles.packagesGrid}>
                {smsPackages.map(pkg => {
                  const isActive = purchasing === pkg.id;
                  const perSms = pkg.sms_count > 0 ? (pkg.price / pkg.sms_count).toFixed(1) : '0';
                  return (
                    <TouchableOpacity
                      key={pkg.id}
                      style={[styles.packageCard, pkg.is_featured && styles.packageCardPopular]}
                      onPress={() => handleBuySms(pkg)}
                      disabled={purchasing !== null}
                    >
                      {pkg.is_featured && (
                        <View style={styles.popularBadge}>
                          <Star size={8} color="#000" />
                          <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                        </View>
                      )}
                      <Text style={styles.packageValue}>{pkg.sms_count.toLocaleString()}</Text>
                      <Text style={styles.packageUnit}>SMS</Text>
                      <View style={styles.packageDivider} />
                      <Text style={styles.packagePrice}>KES {pkg.price.toLocaleString()}</Text>
                      <Text style={styles.packageSub}>KES {perSms}/SMS</Text>
                      {isActive ? (
                        <ActivityIndicator size="small" color={Colors.gold} style={{ marginTop: 8 }} />
                      ) : (
                        <View style={styles.buyBtn}>
                          <Zap size={10} color="#000" />
                          <Text style={styles.buyBtnText}>Buy Now</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {smsPackages.length === 0 && (
            <View style={styles.emptyCard}>
              <MessageSquare size={20} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No SMS packages available yet</Text>
              <Text style={styles.emptyHint}>Packages are set by the platform admin</Text>
            </View>
          )}

          {/* ── Cloud Storage ── */}
          <View style={[styles.sectionHeader, { marginTop: 28 }]}>
            <View style={styles.sectionIconWrap}>
              <HardDrive size={16} color={Colors.gold} />
            </View>
            <Text style={styles.sectionTitle}>Cloud Storage</Text>
          </View>

          {storageInfo && (
            <View style={styles.balanceCard}>
              <View style={styles.balanceTop}>
                <View>
                  <Text style={styles.balanceLabel}>Storage Used</Text>
                  <Text style={styles.balanceValue}>{formatMB(storageInfo.used_mb)}</Text>
                </View>
                <View style={styles.balanceIconWrap}>
                  <Package size={24} color={Colors.gold} />
                </View>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${storageUsagePercent}%` }]} />
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceSub}>{formatMB(storageInfo.total_mb)} total</Text>
                <Text style={styles.balanceSub}>{(100 - storageUsagePercent).toFixed(0)}% free</Text>
              </View>
            </View>
          )}

          {storageTiers.length > 0 && (
            <>
              <Text style={styles.packagesLabel}>Buy More Storage</Text>
              <View style={styles.packagesGrid}>
                {storageTiers.map(tier => {
                  const isActive = purchasing === tier.id;
                  return (
                    <TouchableOpacity
                      key={tier.id}
                      style={[styles.packageCard, tier.display_order === 2 && styles.packageCardPopular]}
                      onPress={() => handleBuyStorage(tier)}
                      disabled={purchasing !== null}
                    >
                      {tier.display_order === 2 && (
                        <View style={styles.popularBadge}>
                          <Star size={8} color="#000" />
                          <Text style={styles.popularBadgeText}>POPULAR</Text>
                        </View>
                      )}
                      <Text style={styles.packageValue}>{formatMB(tier.storage_mb)}</Text>
                      <Text style={styles.packageUnit}>extra</Text>
                      <View style={styles.packageDivider} />
                      <Text style={styles.packagePrice}>KES {tier.price_kes.toLocaleString()}</Text>
                      <Text style={styles.packageSub}>{tier.name}</Text>
                      {isActive ? (
                        <ActivityIndicator size="small" color={Colors.gold} style={{ marginTop: 8 }} />
                      ) : (
                        <View style={styles.buyBtn}>
                          <Zap size={10} color="#000" />
                          <Text style={styles.buyBtnText}>Buy Now</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {storageTiers.length === 0 && (
            <View style={styles.emptyCard}>
              <HardDrive size={20} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No storage packages available yet</Text>
              <Text style={styles.emptyHint}>Packages are set by the platform admin</Text>
            </View>
          )}

          {/* ── Recent Purchases ── */}
          {recentActivity.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 28 }]}>
                <View style={styles.sectionIconWrap}>
                  <Clock size={16} color={Colors.gold} />
                </View>
                <Text style={styles.sectionTitle}>Recent Purchases</Text>
              </View>
              {recentActivity.map((tx: any, i: number) => (
                <View key={tx.id || i} style={styles.activityRow}>
                  <View style={styles.activityIcon}>
                    <Check size={14} color={Colors.success} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityType}>
                      {tx.sms_count || tx.amount || 0} {tx.sms_count ? 'SMS' : 'KES'}
                    </Text>
                    <Text style={styles.activityDate}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.activityBadge}>
                    <Text style={styles.activityBadgeText}>{tx.status}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── SMS History ── */}
          {smsHistory.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 28 }]}>
                <View style={styles.sectionIconWrap}>
                  <Send size={16} color={Colors.gold} />
                </View>
                <Text style={styles.sectionTitle}>SMS History</Text>
              </View>
              {smsHistory.map((log: any, i: number) => (
                <View key={log.id || i} style={styles.activityRow}>
                  <View style={styles.activityIcon}>
                    {log.status === 'sent' || log.status === 'delivered' ? (
                      <Check size={14} color={Colors.success} />
                    ) : (
                      <AlertCircle size={14} color={Colors.error} />
                    )}
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityType} numberOfLines={1}>
                      {log.recipient || 'Unknown'}
                    </Text>
                    <Text style={styles.activityDate}>
                      {log.message_type || 'sms'} · {new Date(log.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.activityBadge, {
                    backgroundColor: log.status === 'sent' || log.status === 'delivered'
                      ? 'rgba(52,199,89,0.12)'
                      : 'rgba(255,59,48,0.12)'
                  }]}>
                    <Text style={[styles.activityBadgeText, {
                      color: log.status === 'sent' || log.status === 'delivered'
                        ? Colors.success || '#34C759'
                        : Colors.error || '#FF3B30'
                    }]}>
                      {log.status}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Tip */}
          <View style={styles.tipCard}>
            <Shield size={16} color={Colors.gold} />
            <Text style={styles.tipText}>
              Credits and storage are managed by the platform. Contact support if you need assistance with a purchase.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16 },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(212,175,55,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  balanceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.cardHover || Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Packages
  packagesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  packageCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    position: 'relative',
  },
  packageCardPopular: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,175,55,0.04)',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.5,
  },
  packageValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  packageUnit: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  packageDivider: {
    width: 24,
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  packagePrice: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.gold,
  },
  packageSub: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 8,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },

  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: { flex: 1 },
  activityType: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  activityDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  activityBadge: {
    backgroundColor: 'rgba(52,199,89,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success || '#34C759',
    textTransform: 'uppercase',
  },

  // Empty
  emptyCard: {
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    gap: 6,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  emptyHint: {
    fontSize: 11,
    color: Colors.textMuted,
    opacity: 0.6,
  },

  // Tip
  tipCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderRadius: 12,
    padding: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
