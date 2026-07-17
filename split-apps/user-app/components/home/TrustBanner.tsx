import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface TrustBannerProps {
  clientCount: number;
  avgRating: number;
}

export function TrustBanner({ clientCount, avgRating }: TrustBannerProps) {
  const router = useRouter();

  return (
    <Pressable
      style={styles.trustBanner}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/(tabs)/profile');
      }}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
        style={styles.trustBannerGradient}
      >
        <View style={styles.trustBannerIcon}>
          <View style={styles.starCircle}>
            <Star size={20} color={Colors.gold} fill={Colors.gold} />
          </View>
        </View>
        <View style={styles.trustBannerContent}>
          <Text style={styles.trustBannerTitle}>Trusted by {clientCount || '50+'} clients</Text>
          <Text style={styles.trustBannerDesc}>
            {avgRating > 0 ? `${avgRating} average rating` : 'Rated by clients'}
          </Text>
        </View>
        <ChevronRight size={16} color={Colors.textMuted} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trustBanner: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  trustBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  trustBannerIcon: {
    marginRight: 12,
  },
  starCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  trustBannerContent: {
    flex: 1,
  },
  trustBannerTitle: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  trustBannerDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
