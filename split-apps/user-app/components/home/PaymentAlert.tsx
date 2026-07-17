import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CreditCard, Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import type { Database } from '@/types/supabase';

type GalleryRow = Database['public']['Tables']['galleries']['Row'];

interface PaymentAlertProps {
  pendingPaymentGalleries: GalleryRow[];
  onPayGallery: (gallery: GalleryRow) => void;
}

export function PaymentAlert({ pendingPaymentGalleries, onPayGallery }: PaymentAlertProps) {
  const router = useRouter();

  if (pendingPaymentGalleries.length === 0) return null;

  return (
    <View style={styles.paymentAlert}>
      <LinearGradient
        colors={['rgba(28,28,30,0.8)', 'rgba(28,28,30,0.95)']}
        style={styles.paymentAlertGradient}
      >
        <View style={styles.paymentAlertIcon}>
          <CreditCard size={20} color={Colors.gold} />
        </View>
        <View style={styles.paymentAlertContent}>
          <Text style={styles.paymentAlertTitle}>Pending Payment</Text>
          <Text style={styles.paymentAlertDesc}>
            {pendingPaymentGalleries.length} galleries awaiting payment
          </Text>
        </View>
        <Pressable
          style={styles.paymentAlertAction}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const firstPending = pendingPaymentGalleries[0];
            if (firstPending) {
              onPayGallery(firstPending);
              return;
            }
            router.push('/(tabs)/gallery?tab=unlock');
          }}
        >
          <Text style={styles.paymentAlertActionText}>Pay</Text>
          <Zap size={14} color={Colors.background} fill={Colors.background} />
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  paymentAlert: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  paymentAlertGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  paymentAlertIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentAlertContent: {
    flex: 1,
  },
  paymentAlertTitle: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  paymentAlertDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  paymentAlertAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  paymentAlertActionText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
});
