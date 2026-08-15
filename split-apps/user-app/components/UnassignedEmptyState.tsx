// Reusable empty state shown on screens that require a photographer assignment.
// Includes a "notify your photographer" card with a personalized invite link.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Share2, ArrowRight, UserPlus, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

interface UnassignedEmptyStateProps {
  featureName?: string;
  icon?: React.ReactNode;
}

export default function UnassignedEmptyState({
  featureName = 'this feature',
  icon,
}: UnassignedEmptyStateProps) {
  const router = useRouter();
  const [inviteLink, setInviteLink] = useState<string>('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadInviteLink();
  }, []);

  const loadInviteLink = async () => {
    try {
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['platform_admin_app_android_link', 'platform_admin_app_ios_link', 'platform_invite_url'])
        .order('key');

      if (settings && settings.length > 0) {
        const kvMap: Record<string, string> = {};
        settings.forEach((r: any) => { kvMap[r.key] = r.value ?? ''; });
        const link = kvMap['platform_invite_url'] || kvMap['platform_admin_app_android_link'] || kvMap['platform_admin_app_ios_link'];
        if (link) { setInviteLink(link); return; }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { getPlatformDomain } = await import('@/lib/platform-config');
        const domain = await getPlatformDomain();
        setInviteLink(domain);
        return;
      }

      const { data: clientRecord } = await supabase
        .from('clients')
        .select('owner_admin_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clientRecord?.owner_admin_id) {
        const { data: adminProfile } = await supabase
          .from('user_profiles')
          .select('photographer_code')
          .eq('id', clientRecord.owner_admin_id)
          .maybeSingle();

        if (adminProfile?.photographer_code) {
          const { getPlatformDomain } = await import('@/lib/platform-config');
          const domain = await getPlatformDomain();
          setInviteLink(`${domain}/join/${adminProfile.photographer_code}`);
          return;
        }
      }

      const { getPlatformDomain } = await import('@/lib/platform-config');
      const fallbackDomain = await getPlatformDomain();
      setInviteLink(fallbackDomain);
    } catch {
      const { getPlatformDomain } = await import('@/lib/platform-config');
      const fallbackDomain = await getPlatformDomain();
      setInviteLink(fallbackDomain);
    }
  };

  const handleGoHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)/home');
  };

  const handleShareWithPhotographer = async () => {
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const message =
      `Hi! I use Epix Visuals to receive and manage my photo galleries. ` +
      `Please download the app and use this link to connect with me:\n\n${inviteLink}`;

    try {
      await Share.share({ message, url: inviteLink, title: 'Join Epix Visuals' });
    } catch {} finally {
      setSharing(false);
    }
  };

  const handleOpenInviteLink = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(inviteLink).catch(() => {});
  };

  return (
    <View style={styles.container}>
      {/* Animated icon */}
      <View style={styles.iconWrapper}>
        <LinearGradient
          colors={['rgba(212,175,55,0.2)', 'rgba(212,175,55,0.05)']}
          style={styles.iconGradient}
        >
          {icon ?? <Camera size={36} color={Colors.gold} strokeWidth={1.5} />}
        </LinearGradient>
        <View style={styles.badgeWrap}>
          <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.badge}>
            <Sparkles size={10} color="#000" />
          </LinearGradient>
        </View>
      </View>

      <Text style={styles.title}>No photographer yet</Text>
      <Text style={styles.subtitle}>
        To access {featureName}, connect with a photographer first.
      </Text>

      {/* Referral card */}
      <View style={styles.referralCard}>
        <View style={styles.referralHeader}>
          <View style={styles.referralIconBg}>
            <UserPlus size={18} color={Colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.referralCardTitle}>Get connected</Text>
            <Text style={styles.referralCardSubtitle}>
              Share the app with your photographer so they can add you to their client list.
            </Text>
          </View>
        </View>

        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <Text style={styles.stepText}>Share this link with your photographer</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <Text style={styles.stepText}>They register you in the system</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <Text style={styles.stepText}>Your account is linked automatically</Text>
          </View>
        </View>

        <Pressable
          style={styles.shareButton}
          onPress={handleShareWithPhotographer}
          disabled={sharing}
        >
          <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.shareButtonGradient}
          >
            <Share2 size={16} color="#000" />
            <Text style={styles.shareButtonText}>
              {sharing ? 'Opening share...' : 'Share Signup Link'}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={handleOpenInviteLink} style={styles.linkRow}>
          <Text style={styles.linkText} numberOfLines={1}>{inviteLink}</Text>
          <ArrowRight size={14} color={Colors.textMuted} />
        </Pressable>
      </View>

      <Pressable style={styles.homeButton} onPress={handleGoHome}>
        <Text style={styles.homeButtonText}>Go to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: Colors.background,
  },
  iconWrapper: {
    marginBottom: 24,
    position: 'relative',
  },
  iconGradient: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  badgeWrap: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  referralCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
    marginBottom: 16,
    gap: 16,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  referralIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  referralCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 3,
  },
  referralCardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  stepsContainer: {
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gold,
  },
  stepText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  shareButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  homeButton: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  homeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
