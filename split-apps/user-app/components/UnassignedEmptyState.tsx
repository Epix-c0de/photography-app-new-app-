// Reusable empty state shown on screens that require a photographer assignment.
// Includes a "notify your photographer" card with a personalized invite link.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Share2, ArrowRight } from 'lucide-react-native';
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
      // First, try to load from platform settings
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'platform_invite_url')
        .maybeSingle();

      if (settings?.value) {
        setInviteLink(settings.value);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInviteLink('https://epixvisuals.co.ke');
        return;
      }

      // Find the admin this client is assigned to via the clients table
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
          // Fetch domain from platform_settings
          const { data: domainSetting } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'platform_domain')
            .maybeSingle();
          const domain = domainSetting?.value || 'https://epixvisuals.co.ke';
          setInviteLink(`${domain}/join/${adminProfile.photographer_code}`);
          return;
        }
      }

      setInviteLink('https://epixvisuals.co.ke');
    } catch {
      setInviteLink('https://epixvisuals.co.ke');
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
    } catch {
      // User cancelled — that's fine
    } finally {
      setSharing(false);
    }
  };

  const handleOpenInviteLink = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(inviteLink).catch(() => {});
  };

  return (
    <View style={styles.container}>
      {/* Main icon */}
      <View style={styles.iconWrapper}>
        <LinearGradient
          colors={['rgba(212,175,55,0.15)', 'rgba(212,175,55,0.05)']}
          style={styles.iconGradient}
        >
          {icon ?? <Camera size={40} color={Colors.gold} strokeWidth={1.5} />}
        </LinearGradient>
      </View>

      <Text style={styles.title}>No photographer yet</Text>
      <Text style={styles.subtitle}>
        To access {featureName}, you need to be connected to a photographer.
      </Text>

      {/* ── Referral card ── */}
      <View style={styles.referralCard}>
        <View style={styles.referralHeader}>
          <View style={styles.referralIconBg}>
            <Share2 size={18} color={Colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.referralCardTitle}>Notify your photographer</Text>
            <Text style={styles.referralCardSubtitle}>
              Share the app with your photographer so they can create your gallery
            </Text>
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
            <Share2 size={16} color={Colors.background} />
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

      {/* Go to home */}
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
    marginBottom: 20,
  },
  iconGradient: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  // ── Referral card ──
  referralCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    marginBottom: 16,
    gap: 16,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
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
    marginBottom: 4,
  },
  referralCardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
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
    color: Colors.background,
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
  // ── Home button ──
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
