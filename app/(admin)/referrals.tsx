import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gift, Copy, Share2, Users, CreditCard, Loader2, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import SettingsHeader from '@/components/SettingsHeader';

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, credits: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get referral code
    const { data: referral } = await supabase
      .from('referrals')
      .select('referral_code')
      .eq('referrer_id', user.id)
      .limit(1)
      .single();

    if (referral) {
      setReferralCode(referral.referral_code);
    }

    // Get stats
    const { data: referrals } = await supabase
      .from('referrals')
      .select('status, reward_credits')
      .eq('referrer_id', user.id);

    const total = referrals?.length || 0;
    const completed = referrals?.filter(r => r.status === 'completed' || r.status === 'rewarded').length || 0;
    const credits = referrals?.filter(r => r.status === 'rewarded').reduce((sum, r) => sum + (r.reward_credits || 0), 0) || 0;

    setStats({ total, completed, credits });
    setLoading(false);
  };

  const generateCode = async () => {
    setGenerating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const code = `EPX-${user.id.substring(0, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    await supabase.from('referrals').insert({
      referrer_id: user.id,
      referral_code: code,
      status: 'pending',
    });

    setReferralCode(code);
    setGenerating(false);
    Alert.alert('Success', 'Referral code generated!');
  };

  const copyCode = () => {
    if (referralCode) {
      navigator.clipboard?.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      Alert.alert('Copied', 'Referral code copied to clipboard');
    }
  };

  const shareCode = async () => {
    if (!referralCode) return;
    
    // Fetch domain from platform_settings
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_domain')
      .single();
    const domain = settings?.value || 'https://epixvisuals.co.ke';
    
    const message = `Join Epix Visuals as a photographer! Use my referral code: ${referralCode}\n\nSign up here: ${domain}/signup?ref=${referralCode}`;
    
    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Loader2 size={24} color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SettingsHeader title="Referrals" />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.gold }]}>{stats.credits}</Text>
            <Text style={styles.statLabel}>Credits</Text>
          </View>
        </View>

        {/* Referral Code */}
        <View style={styles.codeCard}>
          <Text style={styles.cardTitle}>Your Referral Code</Text>
          
          {referralCode ? (
            <>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{referralCode}</Text>
                <Pressable onPress={copyCode} style={styles.copyBtn}>
                  {copied ? <CheckCircle size={18} color={Colors.success} /> : <Copy size={18} color={Colors.gold} />}
                </Pressable>
              </View>

              <Pressable style={styles.shareBtn} onPress={shareCode}>
                <Share2 size={18} color={Colors.background} />
                <Text style={styles.shareBtnText}>Share Referral Link</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.generateContainer}>
              <Text style={styles.generateText}>Generate your unique referral code</Text>
              <Pressable
                style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
                onPress={generateCode}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 size={18} color={Colors.background} />
                ) : (
                  <Gift size={18} color={Colors.background} />
                )}
                <Text style={styles.generateBtnText}>
                  {generating ? 'Generating...' : 'Generate Code'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* How It Works */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <Text style={styles.stepText}>Share your code with other photographers</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <Text style={styles.stepText}>They sign up and pay KES 500</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <Text style={styles.stepText}>You earn KES 100 in SMS credits</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  codeCard: {
    backgroundColor: 'rgba(212,175,55,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 16,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  codeText: {
    flex: 1,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: Colors.gold,
    fontSize: 18,
    letterSpacing: 2,
  },
  copyBtn: {
    padding: 8,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 16,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  generateContainer: {
    alignItems: 'center',
  },
  generateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  generateBtnDisabled: {
    opacity: 0.5,
  },
  generateBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
});
