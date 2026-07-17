import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Unlock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface QuickActionsProps {
  hasPendingPayments: boolean;
}

export function QuickActions({ hasPendingPayments }: QuickActionsProps) {
  const router = useRouter();

  return (
    <View style={styles.quickActions}>
      <Pressable
        style={styles.quickAction}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/(tabs)/bookings');
        }}
      >
        <LinearGradient colors={[Colors.goldMuted, 'rgba(212,175,55,0.05)']} style={styles.quickActionGradient}>
          <Camera size={20} color={Colors.gold} />
          <Text style={styles.quickActionText}>Book a Shoot</Text>
        </LinearGradient>
      </Pressable>
      <Pressable
        style={styles.quickAction}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(hasPendingPayments ? '/(tabs)/gallery?tab=unlock' : '/(tabs)/gallery');
        }}
      >
        <LinearGradient colors={[Colors.goldMuted, 'rgba(212,175,55,0.05)']} style={styles.quickActionGradient}>
          <View style={styles.actionIconContainer}>
            <Unlock size={20} color={Colors.gold} />
            {hasPendingPayments && <View style={styles.redBadge} />}
          </View>
          <Text style={styles.quickActionText}>Unlock Gallery</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  quickAction: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  quickActionGradient: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 8,
  },
  quickActionText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  actionIconContainer: {
    position: 'relative',
  },
  redBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
});
