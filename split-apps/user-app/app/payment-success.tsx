import { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Download, Share2, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { width, height } = Dimensions.get('window');

const CONFETTI_COLORS = [Colors.gold, '#E8CC6E', '#FFD700', '#FFA500', '#FF6347', '#87CEEB', '#DDA0DD'];
const CONFETTI_COUNT = 30;

function ConfettiPiece({ index }: { index: number }) {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const startX = Math.random() * width;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const size = 6 + Math.random() * 8;
  const delay = Math.random() * 800;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height + 50,
        duration: 2500 + Math.random() * 1500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: (Math.random() - 0.5) * 200,
        duration: 2500 + Math.random() * 1500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 5 + Math.random() * 10,
        duration: 2500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 2000,
        delay: delay + 1500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, translateX, rotate, opacity, delay]);

  const spin = rotate.interpolate({
    inputRange: [0, 10],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute' as const,
        left: startX,
        top: 0,
        width: size,
        height: size * 0.6,
        backgroundColor: color,
        borderRadius: 2,
        transform: [{ translateY }, { translateX }, { rotate: spin }],
        opacity,
      }}
    />
  );
}

export default function PaymentSuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string; gallery?: string }>();
  const checkScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.sequence([
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 4,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(buttonSlide, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [checkScale, contentOpacity, buttonSlide]);

  const handleViewGallery = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)/gallery');
  }, [router]);

  const handleGoHome = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)/home');
  }, [router]);

  const amount = params.amount || '35,000';
  const gallery = params.gallery || 'Your Gallery';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0A0A', '#111111', '#0A0A0A']}
        style={StyleSheet.absoluteFillObject}
      />

      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <ConfettiPiece key={i} index={i} />
      ))}

      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
          <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            style={styles.checkGradient}
          >
            <Check size={40} color={Colors.background} strokeWidth={3} />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.textSection, { opacity: contentOpacity }]}>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successDesc}>
            Your photos are now unlocked and ready for download.
          </Text>

          <View style={styles.receiptCard}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Amount Paid</Text>
              <Text style={styles.receiptValue}>KES {amount}</Text>
            </View>
            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Gallery</Text>
              <Text style={styles.receiptValueSmall}>{gallery}</Text>
            </View>
            <View style={styles.receiptDivider} />
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Status</Text>
              <View style={styles.statusChip}>
                <Text style={styles.statusChipText}>Unlocked</Text>
              </View>
            </View>
          </View>

          <Text style={styles.thankYou}>Thank you for your purchase!</Text>
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: contentOpacity, transform: [{ translateY: buttonSlide }] }]}>
          <Pressable onPress={handleViewGallery} style={styles.primaryButton}>
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              style={styles.primaryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Download size={18} color={Colors.background} />
              <Text style={styles.primaryButtonText}>View & Download Photos</Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.secondaryRow}>
            <Pressable style={styles.secondaryButton}>
              <Share2 size={16} color={Colors.gold} />
              <Text style={styles.secondaryButtonText}>Share</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleGoHome}>
              <ArrowRight size={16} color={Colors.textSecondary} />
              <Text style={styles.secondaryButtonTextMuted}>Go Home</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  checkCircle: {
    marginBottom: 32,
  },
  checkGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSection: {
    alignItems: 'center',
    width: '100%',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 10,
    textAlign: 'center' as const,
  },
  successDesc: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  receiptRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  receiptLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  receiptValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.gold,
  },
  receiptValueSmall: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  receiptDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
  },
  statusChip: {
    backgroundColor: 'rgba(46,204,113,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  thankYou: {
    fontSize: 14,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
    marginBottom: 32,
  },
  actions: {
    width: '100%',
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginBottom: 16,
  },
  primaryButtonGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  secondaryRow: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: Colors.card,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  secondaryButtonTextMuted: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
});
