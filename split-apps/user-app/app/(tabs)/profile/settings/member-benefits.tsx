import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { Ticket, Copy, Star, Gift, TrendingUp, Award } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';
import { supabase } from '@/lib/supabase';

interface MemberBenefits {
  tier: string;
  points: number;
  total_bookings: number;
  total_spent: number;
  discount_percent: number;
  next_tier: string | null;
  points_to_next: number;
}

const TIER_CONFIG = {
  bronze: { color: '#cd7f32', icon: Award, label: 'Bronze', minBookings: 0 },
  silver: { color: '#c0c0c0', icon: Star, label: 'Silver', minBookings: 5 },
  gold: { color: '#ffd700', icon: TrendingUp, label: 'Gold', minBookings: 10 },
  platinum: { color: '#e5e4e2', icon: Gift, label: 'Platinum', minBookings: 20 },
};

export default function MemberBenefits() {
  const [benefits, setBenefits] = useState<MemberBenefits | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoCode, setPromoCode] = useState('');

  const loadBenefits = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to get existing benefits
      const { data: existing } = await supabase
        .from('member_benefits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        setBenefits({
          tier: existing.tier || 'bronze',
          points: existing.points || 0,
          total_bookings: existing.total_bookings || 0,
          total_spent: existing.total_spent || 0,
          discount_percent: existing.discount_percent || 0,
          next_tier: existing.next_tier,
          points_to_next: existing.points_to_next || 0,
        });
      } else {
        // Create default benefits
        const { data: newBenefits } = await supabase
          .rpc('get_member_benefits', { p_user_id: user.id });

        if (newBenefits) {
          setBenefits(newBenefits);
        } else {
          setBenefits({
            tier: 'bronze',
            points: 0,
            total_bookings: 0,
            total_spent: 0,
            discount_percent: 0,
            next_tier: 'silver',
            points_to_next: 5,
          });
        }
      }

      // Generate unique promo code
      setPromoCode(`EPIX-${user.id.slice(0, 8).toUpperCase()}`);
    } catch (error) {
      console.error('Failed to load benefits:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBenefits();
  }, [loadBenefits]);

  const copyPromoCode = async () => {
    await Clipboard.setStringAsync(promoCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied!', 'Your promo code has been copied to clipboard');
  };

  const tierConfig = benefits ? TIER_CONFIG[benefits.tier as keyof typeof TIER_CONFIG] : TIER_CONFIG.bronze;
  const TierIcon = tierConfig.icon;

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsHeader title="Member Benefits" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Member Benefits" />
      
      <View style={styles.content}>
        {/* Tier Card */}
        <View style={[styles.tierCard, { borderColor: tierConfig.color }]}>
          <View style={styles.tierHeader}>
            <TierIcon size={32} color={tierConfig.color} />
            <Text style={[styles.tierLabel, { color: tierConfig.color }]}>
              {tierConfig.label} Member
            </Text>
          </View>
          
          <Text style={styles.discount}>{benefits?.discount_percent || 0}% OFF</Text>
          <Text style={styles.discountLabel}>All bookings</Text>
          
          {benefits?.next_tier && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.min(100, ((benefits.total_bookings / (benefits.total_bookings + benefits.points_to_next)) * 100))}%`,
                      backgroundColor: tierConfig.color 
                    }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {benefits.points_to_next} more bookings to {benefits.next_tier}
              </Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{benefits?.total_bookings || 0}</Text>
            <Text style={styles.statLabel}>Bookings</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{benefits?.points || 0}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>KES {(benefits?.total_spent || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
        </View>

        {/* Promo Code */}
        <View style={styles.promoCard}>
          <Text style={styles.promoTitle}>Your Member Code</Text>
          <View style={styles.promoCodeContainer}>
            <Ticket size={24} color={Colors.gold} />
            <Text style={styles.promoCode}>{promoCode}</Text>
            <Pressable onPress={copyPromoCode}>
              <Copy size={20} color={Colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.promoTerms}>Share with friends for 10% off their first booking</Text>
        </View>

        {/* Benefits List */}
        <View style={styles.benefitsList}>
          <Text style={styles.sectionTitle}>Your Benefits</Text>
          
          <View style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: '#22c55e20' }]}>
              <Text style={styles.benefitEmoji}>💰</Text>
            </View>
            <View style={styles.benefitInfo}>
              <Text style={styles.benefitTitle}>{benefits?.discount_percent || 0}% Discount</Text>
              <Text style={styles.benefitDesc}>On all booking packages</Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: '#3b82f620' }]}>
              <Text style={styles.benefitEmoji}>⭐</Text>
            </View>
            <View style={styles.benefitInfo}>
              <Text style={styles.benefitTitle}>Priority Booking</Text>
              <Text style={styles.benefitDesc}>Early access to available dates</Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: '#a855f720' }]}>
              <Text style={styles.benefitEmoji}>🎁</Text>
            </View>
            <View style={styles.benefitInfo}>
              <Text style={styles.benefitTitle}>Free Extras</Text>
              <Text style={styles.benefitDesc}>Bonus prints on select packages</Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIcon, { backgroundColor: '#f59e0b20' }]}>
              <Text style={styles.benefitEmoji}>⭐</Text>
            </View>
            <View style={styles.benefitInfo}>
              <Text style={styles.benefitTitle}>Referral Rewards</Text>
              <Text style={styles.benefitDesc}>Earn KES 100-250 per referral</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  tierCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    alignItems: 'center',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  tierLabel: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  discount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  discountLabel: {
    fontSize: 16,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  progressContainer: {
    width: '100%',
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  promoCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  promoCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gold,
    marginBottom: 12,
  },
  promoCode: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  promoTerms: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  benefitsList: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  benefitEmoji: {
    fontSize: 20,
  },
  benefitInfo: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});