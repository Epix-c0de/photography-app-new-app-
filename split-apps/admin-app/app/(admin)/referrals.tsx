import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, RefreshControl,
  ActivityIndicator, Share, ScrollView, Alert, Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Copy, Share2, Users, Gift, Clock, CheckCircle2,
  ChevronRight, RefreshCw, QrCode, MessageCircle,
  Smartphone, ExternalLink, Download, Sparkles, Star,
  Trophy, Medal,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import QRCode from 'react-native-qrcode-svg';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

async function safeHapticImpact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  try { await Haptics.impactAsync(style); } catch {}
}
async function safeHapticNotification(type: Haptics.NotificationFeedbackType) {
  try { await Haptics.notificationAsync(type); } catch {}
}

interface ReferralStat {
  total_referrals: number;
  pending_referrals: number;
  completed_referrals: number;
  total_credits_earned: number;
  referral_code: string | null;
}

interface ReferralRecord {
  id: string;
  referred_id: string | null;
  referral_code: string;
  status: string;
  reward_credits: number;
  created_at: string;
  completed_at: string | null;
  rewarded_at: string | null;
  referred_email?: string;
  referred_name?: string;
}

type Tier = 'bronze' | 'silver' | 'gold';

function getTier(count: number): Tier {
  if (count >= 15) return 'gold';
  if (count >= 5) return 'silver';
  return 'bronze';
}

function getTierConfig(tier: Tier) {
  switch (tier) {
    case 'gold':
      return { label: 'Gold', color: '#FFD700', icon: Trophy, next: null, threshold: 15, bg: 'rgba(255,215,0,0.12)', border: 'rgba(255,215,0,0.3)' };
    case 'silver':
      return { label: 'Silver', color: '#C0C0C0', icon: Medal, next: 'Gold', threshold: 15, bg: 'rgba(192,192,192,0.1)', border: 'rgba(192,192,192,0.25)' };
    default:
      return { label: 'Bronze', color: '#CD7F32', icon: Star, next: 'Silver', threshold: 5, bg: 'rgba(205,127,50,0.1)', border: 'rgba(205,127,50,0.25)' };
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'rewarded':
      return { label: 'Rewarded', color: '#10B981', bg: 'rgba(16,185,129,0.12)' };
    case 'completed':
      return { label: 'Signed Up', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' };
    default:
      return { label: 'Pending', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
  }
}

export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qrRef = useRef<any>(null);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStat>({
    total_referrals: 0,
    pending_referrals: 0,
    completed_referrals: 0,
    total_credits_earned: 0,
    referral_code: null,
  });
  const [creditBalance, setCreditBalance] = useState(0);
  const [referralHistory, setReferralHistory] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [domain, setDomain] = useState('https://epixvisuals.co.ke');
  const [deepLinkScheme, setDeepLinkScheme] = useState('epix-visuals');

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const [statsRes, platformRes, historyRes] = await Promise.all([
        fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-referral`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stats' }),
        }).then(r => r.json()),
        supabase.from('platform_settings').select('key, value').in('key', ['platform_domain', 'deep_link_scheme']),
        supabase.from('referrals').select('*').eq('referrer_id', user.id).order('created_at', { ascending: false }).limit(50),
      ]);

      if (statsRes?.success) {
        setStats(statsRes.stats);
        setCreditBalance(statsRes.credit_balance || 0);
        if (statsRes.stats.referral_code) setReferralCode(statsRes.stats.referral_code);
      }

      if (platformRes.data) {
        const map: Record<string, string> = {};
        platformRes.data.forEach((r: any) => { map[r.key] = r.value || ''; });
        if (map['platform_domain']) setDomain(map['platform_domain']);
        if (map['deep_link_scheme']) setDeepLinkScheme(map['deep_link_scheme']);
      }

      if (historyRes.data) {
        setReferralHistory(historyRes.data);
      }
    } catch (e) {
      console.warn('Referral data load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (referralCode) {
      setShareUrl(`${domain}/signup?ref=${referralCode}`);
    }
  }, [referralCode, domain]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleCopyCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    safeHapticNotification(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    setLinkCopied(true);
    safeHapticNotification(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareNative = async () => {
    if (!referralCode) return;
    safeHapticImpact();
    try {
      await Share.share({
        message: `Join Epix Visuals as a photographer!\n\nUse my referral code: ${referralCode}\n\nSign up here: ${shareUrl}\n\nGet professional photo gallery management for your business!`,
        title: 'Join Epix Visuals',
        url: Platform.OS === 'ios' ? shareUrl : undefined,
      });
    } catch {}
  };

  const handleShareWhatsApp = async () => {
    if (!referralCode) return;
    safeHapticImpact();
    const msg = encodeURIComponent(
      `Join Epix Visuals as a photographer!\n\nUse my referral code: ${referralCode}\n\nSign up here: ${shareUrl}`
    );
    Linking.openURL(`https://wa.me/?text=${msg}`);
  };

  const handleShareSMS = async () => {
    if (!referralCode) return;
    safeHapticImpact();
    const body = encodeURIComponent(
      `Join Epix Visuals as a photographer! Use my code: ${referralCode} — Sign up: ${shareUrl}`
    );
    Linking.openURL(`sms:?body=${body}`);
  };

  const handleRegenerateCode = () => {
    safeHapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Regenerate Referral Code?',
      'Your current code will stop working. Anyone with the old code won\'t be able to use it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', style: 'destructive', onPress: performRegenerate },
      ]
    );
  };

  const performRegenerate = async () => {
    if (!user?.id) return;
    setRegenerating(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-referral`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_code' }),
      });
      const data = await res.json();
      if (data.success && data.referral_code) {
        setReferralCode(data.referral_code);
        safeHapticNotification(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Code Regenerated', `Your new referral code is: ${data.referral_code}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to regenerate code. Please try again.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadQR = async () => {
    if (!qrRef.current) return;
    safeHapticImpact();
    try {
      qrRef.current.toDataURL((data: string) => {
        const filename = FileSystem.documentDirectory + `referral-${referralCode}.png`;
        FileSystem.writeAsStringAsync(filename, data, { encoding: FileSystem.EncodingType.Base64 }).then(() => {
          safeHapticNotification(Haptics.NotificationFeedbackType.Success);
          Alert.alert('QR Code Saved', `Saved to ${filename}`);
        });
      });
    } catch {
      Alert.alert('Error', 'Failed to save QR code.');
    }
  };

  const tier = getTier(stats.total_referrals);
  const tierConfig = getTierConfig(tier);
  const TierIcon = tierConfig.icon;
  const progressToNext = tier === 'gold'
    ? 1
    : stats.total_referrals / tierConfig.threshold;

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
        {/* Tier Badge */}
        <View style={[styles.tierCard, { backgroundColor: tierConfig.bg, borderColor: tierConfig.border }]}>
          <View style={styles.tierLeft}>
            <View style={[styles.tierIconWrap, { backgroundColor: tierConfig.color + '22' }]}>
              <TierIcon size={20} color={tierConfig.color} />
            </View>
            <View>
              <Text style={[styles.tierLabel, { color: tierConfig.color }]}>{tierConfig.label} Tier</Text>
              {tierConfig.next && (
                <Text style={styles.tierProgress}>
                  {stats.total_referrals}/{tierConfig.threshold} referrals to {tierConfig.next}
                </Text>
              )}
              {tier === 'gold' && (
                <Text style={styles.tierProgress}>Maximum tier reached!</Text>
              )}
            </View>
          </View>
          {tierConfig.next && (
            <View style={styles.tierProgressWrap}>
              <View style={styles.tierProgressBar}>
                <View style={[styles.tierProgressFill, { width: `${Math.min(progressToNext * 100, 100)}%`, backgroundColor: tierConfig.color }]} />
              </View>
            </View>
          )}
        </View>

        {/* Referral Code Card */}
        {referralCode && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your Referral Code</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{referralCode}</Text>
              <Pressable style={styles.copyBtn} onPress={handleCopyCode}>
                <Copy size={16} color={copied ? '#10B981' : Colors.gold} />
              </Pressable>
            </View>
            <Text style={styles.codeHint}>{copied ? 'Copied!' : 'Tap to copy code'}</Text>

            <Pressable
              style={[styles.regenerateBtn, regenerating && { opacity: 0.5 }]}
              onPress={handleRegenerateCode}
              disabled={regenerating}
            >
              {regenerating ? (
                <ActivityIndicator size={14} color={Colors.error} />
              ) : (
                <RefreshCw size={14} color={Colors.error} />
              )}
              <Text style={styles.regenerateBtnText}>
                {regenerating ? 'Regenerating...' : 'Regenerate Code'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Shareable Link Card */}
        {shareUrl ? (
          <View style={styles.linkCard}>
            <View style={styles.linkLabelRow}>
              <ExternalLink size={14} color="rgba(255,255,255,0.4)" />
              <Text style={styles.linkLabel}>Referral Link</Text>
            </View>
            <View style={styles.linkRow}>
              <Text style={styles.linkText} numberOfLines={1}>{shareUrl}</Text>
              <Pressable style={styles.linkCopyBtn} onPress={handleCopyLink}>
                <Copy size={14} color={linkCopied ? '#10B981' : Colors.gold} />
              </Pressable>
            </View>
            <Text style={styles.linkHint}>{linkCopied ? 'Link copied!' : 'Tap to copy link'}</Text>

            <View style={styles.shareButtonsRow}>
              <Pressable style={[styles.shareBtn, styles.shareBtnPrimary]} onPress={handleShareNative}>
                <Share2 size={16} color={Colors.background} />
                <Text style={styles.shareBtnTextPrimary}>Share</Text>
              </Pressable>
              <Pressable style={[styles.shareBtn, styles.shareBtnWhatsApp]} onPress={handleShareWhatsApp}>
                <MessageCircle size={16} color="#FFFFFF" />
                <Text style={styles.shareBtnTextWhite}>WhatsApp</Text>
              </Pressable>
              <Pressable style={[styles.shareBtn, styles.shareBtnSMS]} onPress={handleShareSMS}>
                <Smartphone size={16} color="#FFFFFF" />
                <Text style={styles.shareBtnTextWhite}>SMS</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* QR Code Section */}
        <Pressable style={styles.qrToggle} onPress={() => setShowQR(!showQR)}>
          <View style={styles.qrToggleLeft}>
            <QrCode size={18} color={Colors.gold} />
            <Text style={styles.qrToggleText}>QR Code</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.3)" style={showQR ? styles.qrChevronOpen : undefined} />
        </Pressable>

        {showQR && referralCode && (
          <View style={styles.qrSection}>
            <View style={styles.qrContainer}>
              <QRCode
                ref={qrRef}
                value={shareUrl || referralCode}
                size={180}
                color="#000000"
                backgroundColor="#FFFFFF"
                ecl="M"
              />
            </View>
            <Text style={styles.qrHint}>Scan to sign up with your referral code</Text>
            <Pressable style={styles.downloadBtn} onPress={handleDownloadQR}>
              <Download size={16} color={Colors.gold} />
              <Text style={styles.downloadBtnText}>Save QR Code</Text>
            </Pressable>
          </View>
        )}

        {/* Stats Dashboard */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
              <Users size={18} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{stats.total_referrals}</Text>
            <Text style={styles.statLabel}>Total Referrals</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <CheckCircle2 size={18} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{stats.completed_referrals}</Text>
            <Text style={styles.statLabel}>Successful Signups</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Clock size={18} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{stats.pending_referrals}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(212,175,55,0.12)' }]}>
              <Gift size={18} color={Colors.gold} />
            </View>
            <Text style={[styles.statValue, { color: Colors.gold }]}>{stats.total_credits_earned}</Text>
            <Text style={styles.statLabel}>Credits Earned</Text>
          </View>
        </View>

        {/* Credit Balance */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <Sparkles size={20} color={Colors.gold} />
            <Text style={styles.balanceLabel}>Credit Balance</Text>
          </View>
          <Text style={styles.balanceValue}>{creditBalance} <Text style={styles.balanceUnit}>credits</Text></Text>
        </View>

        {/* Referral History */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Referral History</Text>
          {referralHistory.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Users size={32} color="rgba(255,255,255,0.15)" />
              <Text style={styles.historyEmptyText}>No referrals yet</Text>
              <Text style={styles.historyEmptyHint}>Share your code to start earning credits</Text>
            </View>
          ) : (
            referralHistory.map((item) => {
              const statusConf = getStatusConfig(item.status);
              const date = new Date(item.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              });
              return (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyItemLeft}>
                    <View style={[styles.historyAvatar, { backgroundColor: statusConf.bg }]}>
                      <Text style={[styles.historyAvatarText, { color: statusConf.color }]}>
                        {(item.referred_name || item.referred_email || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.historyItemInfo}>
                      <Text style={styles.historyItemName}>
                        {item.referred_name || item.referred_email || 'Unknown'}
                      </Text>
                      <Text style={styles.historyItemDate}>{date}</Text>
                    </View>
                  </View>
                  <View style={styles.historyItemRight}>
                    <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusConf.color }]}>{statusConf.label}</Text>
                    </View>
                    {item.status === 'rewarded' && (
                      <Text style={styles.historyCredits}>+{item.reward_credits}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* How It Works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How It Works</Text>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>Share your code</Text>
              <Text style={styles.stepDesc}>Send your referral code or link to other photographers</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>They sign up</Text>
              <Text style={styles.stepDesc}>New photographer registers using your code or link</Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>Earn credits</Text>
              <Text style={styles.stepDesc}>Get SMS credits for each successful referral that subscribes</Text>
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
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  tierCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1,
  },
  tierLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  tierIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tierLabel: { fontSize: 15, fontWeight: '700' },
  tierProgress: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  tierProgressWrap: { width: 80 },
  tierProgressBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  tierProgressFill: { height: '100%', borderRadius: 2 },

  codeCard: {
    backgroundColor: 'rgba(212,175,55,0.08)', borderRadius: 16, padding: 20,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  codeLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  codeText: { fontSize: 22, fontWeight: '900', color: Colors.gold, letterSpacing: 2, flex: 1 },
  copyBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  codeHint: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
  regenerateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(231,76,60,0.08)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.2)',
  },
  regenerateBtnText: { fontSize: 12, fontWeight: '600', color: Colors.error },

  linkCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  linkLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  linkLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkText: { fontSize: 13, color: Colors.gold, flex: 1, letterSpacing: 0.3 },
  linkCopyBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  linkHint: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
  shareButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  shareBtnPrimary: { backgroundColor: Colors.gold },
  shareBtnWhatsApp: { backgroundColor: '#25D366' },
  shareBtnSMS: { backgroundColor: 'rgba(255,255,255,0.1)' },
  shareBtnTextPrimary: { fontSize: 13, fontWeight: '700', color: Colors.background },
  shareBtnTextWhite: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  qrToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  qrToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qrToggleText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  qrChevronOpen: { transform: [{ rotate: '90deg' }] },

  qrSection: {
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  qrContainer: {
    backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12,
  },
  qrHint: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8,
    paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  downloadBtnText: { fontSize: 13, fontWeight: '600', color: Colors.gold },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12,
  },
  statCard: {
    width: '48%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  balanceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(212,175,55,0.06)', borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
  },
  balanceLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  balanceLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  balanceValue: { fontSize: 18, fontWeight: '800', color: Colors.gold },
  balanceUnit: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },

  historySection: { marginBottom: 16 },
  historyTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  historyEmpty: {
    alignItems: 'center', paddingVertical: 32, backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  historyEmptyText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.3)', marginTop: 12 },
  historyEmptyHint: { fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 4 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  historyItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  historyAvatar: {
    width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center',
  },
  historyAvatarText: { fontSize: 15, fontWeight: '700' },
  historyItemInfo: { flex: 1 },
  historyItemName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  historyItemDate: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  historyItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  historyCredits: { fontSize: 13, fontWeight: '700', color: Colors.gold },

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
