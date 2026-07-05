import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, Share2, Gift, Users, Award, TrendingUp } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type ReferralStats = {
  total_referrals: number;
  completed_referrals: number;
  credits_earned: number;
  credit_balance: number;
  referral_code: string;
};

const TIERS = [
  { name: 'Bronze', min: 1, max: 5, color: '#CD7F32' },
  { name: 'Silver', min: 6, max: 15, color: '#C0C0C0' },
  { name: 'Gold', min: 16, max: 30, color: '#D4AF37' },
  { name: 'Platinum', min: 31, max: Infinity, color: '#E5E4E2' },
];

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('process-referral', {
        body: { action: 'stats' },
      });
      if (error) throw error;
      setStats(data);
    } catch (e) {
      console.warn('Referral stats error:', e);
      // Fallback: try to get code from user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();
      if (profile?.referral_code) {
        setStats({
          total_referrals: 0,
          completed_referrals: 0,
          credits_earned: 0,
          credit_balance: 0,
          referral_code: profile.referral_code,
        });
      }
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

  const handleCopy = async () => {
    if (!stats?.referral_code) return;
    await Clipboard.setStringAsync(stats.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!stats?.referral_code) return;
    try {
      await Share.share({
        message: `Join Epix Visuals using my referral code: ${stats.referral_code}\n\nGet professional photo gallery management for your photography business!`,
      });
    } catch {}
  };

  const currentTier = TIERS.find((t) =>
    stats ? stats.completed_referrals >= t.min && stats.completed_referrals <= t.max : false
  ) || TIERS[0];

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Referrals</Text>
        <Text style={styles.subtitle}>Invite photographers, earn credits</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        {/* Referral Code */}
        {stats?.referral_code && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your Referral Code</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{stats.referral_code}</Text>
              <Pressable style={styles.copyBtn} onPress={handleCopy}>
                <Copy size={16} color={copied ? '#10B981' : Colors.gold} />
              </Pressable>
            </View>
            <Text style={styles.codeHint}>{copied ? 'Copied!' : 'Tap to copy'}</Text>
            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <Share2 size={16} color="#080810" />
              <Text style={styles.shareBtnText}>Share Referral Link</Text>
            </Pressable>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Users size={20} color="#3B82F6" />
            <Text style={styles.statValue}>{stats?.total_referrals || 0}</Text>
            <Text style={styles.statLabel}>Referrals</Text>
          </View>
          <View style={styles.statCard}>
            <Gift size={20} color="#10B981" />
            <Text style={styles.statValue}>{stats?.completed_referrals || 0}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUp size={20} color="#F59E0B" />
            <Text style={styles.statValue}>{stats?.credits_earned || 0}</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
          <View style={styles.statCard}>
            <Award size={20} color={currentTier.color} />
            <Text style={[styles.statValue, { color: currentTier.color }]}>{stats?.credit_balance || 0}</Text>
            <Text style={styles.statLabel}>Balance</Text>
          </View>
        </View>

        {/* Current Tier */}
        <View style={styles.tierCard}>
          <Text style={styles.tierTitle}>Current Tier</Text>
          <View style={[styles.tierBadge, { backgroundColor: currentTier.color + '20' }]}>
            <Award size={20} color={currentTier.color} />
            <Text style={[styles.tierName, { color: currentTier.color }]}>{currentTier.name}</Text>
          </View>
          <View style={styles.tierProgress}>
            {TIERS.map((tier) => {
              const isActive = tier.name === currentTier.name;
              return (
                <View key={tier.name} style={styles.tierItem}>
                  <View style={[styles.tierDot, { backgroundColor: isActive ? tier.color : 'rgba(255,255,255,0.1)' }]} />
                  <Text style={[styles.tierLabel, { color: isActive ? tier.color : 'rgba(255,255,255,0.3)' }]}>
                    {tier.name}
                  </Text>
                  <Text style={styles.tierRange}>{tier.min}+ referrals</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How It Works</Text>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>Share your code</Text>
              <Text style={styles.stepDesc}>Send your referral code to other photographers</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>They sign up</Text>
              <Text style={styles.stepDesc}>New photographer registers using your code</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>Earn credits</Text>
              <Text style={styles.stepDesc}>Get SMS credits for each successful referral</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  codeCard: {
    backgroundColor: 'rgba(212,175,55,0.08)', borderRadius: 16, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  codeLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  codeText: { fontSize: 24, fontWeight: '900', color: Colors.gold, letterSpacing: 2, flex: 1 },
  copyBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  codeHint: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.gold, borderRadius: 12, padding: 14, marginTop: 16,
  },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: '#080810' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginBottom: 20,
  },
  statCard: {
    width: '48%', margin: '1%', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginTop: 8 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  tierCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tierTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16,
    paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 16,
  },
  tierName: { fontSize: 16, fontWeight: '700' },
  tierProgress: { gap: 12 },
  tierItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierLabel: { fontSize: 13, fontWeight: '600', width: 60 },
  tierRange: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  howItWorks: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  howTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stepNumber: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.gold,
    justifyContent: 'center', alignItems: 'center',
  },
  stepNumberText: { fontSize: 13, fontWeight: '800', color: '#080810' },
  stepContent: { flex: 1 },
  stepLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  stepDesc: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
});
