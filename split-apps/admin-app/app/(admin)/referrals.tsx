import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, RefreshControl,
  ActivityIndicator, Share, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, Share2, Users } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();
      if (profile?.referral_code) setReferralCode(profile.referral_code);

      const { count } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', user.id);
      setTotalReferrals(count || 0);
    } catch (e) {
      console.warn('Referral stats error:', e);
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
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message: `Join Epix Visuals using my referral code: ${referralCode}\n\nGet professional photo gallery management for your photography business!`,
      });
    } catch {}
  };

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
        {referralCode && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your Referral Code</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{referralCode}</Text>
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

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Users size={20} color="#3B82F6" />
            <Text style={styles.statValue}>{totalReferrals}</Text>
            <Text style={styles.statLabel}>Total Referrals</Text>
          </View>
        </View>

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
  statRow: { marginBottom: 20 },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginTop: 8 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
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
