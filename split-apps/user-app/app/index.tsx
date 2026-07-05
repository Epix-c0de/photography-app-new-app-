import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';

export default function SplashScreen() {
  const router = useRouter();
  const { isLoggedIn, hasSeenOnboarding, isLoading, profile, user } = useAuth();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const [tapCount, setTapCount] = useState<number>(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoAssignAttempted, setAutoAssignAttempted] = useState(false);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [logoOpacity, logoScale, subtitleOpacity, shimmerAnim]);

  useEffect(() => {
    // Don't wait for assignment status — we always route to home for logged-in clients
    // Individual screens show the "no photographer" empty state when unassigned
    if (isLoading) return;

    const timer = setTimeout(async () => {
      console.log('[Splash] Routing...', { isLoggedIn, hasSeenOnboarding, role: profile?.role });
      
      // Check for pending join code from deep link
      try {
        const pendingCode = await AsyncStorage.getItem('pending_join_code');
        if (pendingCode) {
          console.log('[Splash] Pending join code found:', pendingCode);
          if (isLoggedIn) {
            // User is logged in — go to join handler to auto-link
            router.replace(`/join?code=${pendingCode}`);
            return;
          } else {
            // User not logged in — go to login with join code
            router.replace(`/login?join_code=${pendingCode}`);
            return;
          }
        }
      } catch (e) {
        console.warn('[Splash] Error reading pending join code:', e);
      }
      
      if (!hasSeenOnboarding) {
        router.replace('/onboarding');
        return;
      }
      
      if (!isLoggedIn) {
        router.replace('/login');
        return;
      }
      
      // Admin users go directly to admin dashboard
      if (profile?.role === 'admin' || profile?.role === 'super_admin') {
        router.replace('/(admin)/dashboard' as any);
        return;
      }
      
      // Client users: attempt auto-assignment + phone-link in the background (non-blocking)
      if (!autoAssignAttempted) {
        setAutoAssignAttempted(true);
        // Get the user's phone from profile or auth metadata
        const phone = (user?.phone || (profile as any)?.phone) as string | undefined;
        if (phone) {
          // Link any pre-created client records that match this phone number
          (supabase.rpc as any)('claim_client_by_phone', { p_phone: phone })
            .then(({ data, error }: any) => {
              if (!error && data?.linked_count > 0) {
                console.log('[Splash] Linked to', data.linked_count, 'photographer(s) by phone');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            })
            .catch((err: any) => console.warn('[Splash] Phone link error:', err));

          // Also attempt legacy auto-assign
          (supabase.rpc as any)('auto_assign_on_login', { p_mobile_number: phone })
            .then(({ data, error }: any) => {
              if (!error && data?.auto_assigned) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            })
            .catch((err: any) => console.warn('[Splash] Auto-assign error:', err));
        }
      }
      
      // Always go to home — unassigned state is handled per-screen
      router.replace('/(tabs)/home');
    }, 1800); // Reduced from 2200ms to feel faster

    return () => clearTimeout(timer);
  }, [isLoading, isLoggedIn, hasSeenOnboarding, profile, router, autoAssignAttempted, user]);

  const handleLogoTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (newCount >= 3) {
      setTapCount(0);
      router.replace('/admin-login' as any);
      return;
    }
    tapTimerRef.current = setTimeout(() => setTapCount(0), 800);
  };

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <LinearGradient
        colors={['#0A0A0A', '#111111', '#0A0A0A']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <Animated.View style={[styles.decorLine, { opacity: shimmerOpacity, top: '20%', left: -50, transform: [{ rotate: '-35deg' }] }]}>
        <LinearGradient colors={['transparent', Colors.goldMuted, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.decorLineInner} />
      </Animated.View>
      <Animated.View style={[styles.decorLine, { opacity: shimmerOpacity, bottom: '25%', right: -50, transform: [{ rotate: '-35deg' }] }]}>
        <LinearGradient colors={['transparent', Colors.goldMuted, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.decorLineInner} />
      </Animated.View>

      <Pressable onPress={handleLogoTap}>
        <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoFrame}>
            <Animated.Text style={[styles.logoIcon, { opacity: shimmerOpacity }]}>◈</Animated.Text>
          </View>
          <Text style={styles.logoText}>EPIX<Text style={styles.logoAccent}>VISUALS</Text></Text>
        </Animated.View>
      </Pressable>

      <Animated.View style={{ opacity: subtitleOpacity }}>
        <Text style={styles.subtitle}>P H O T O G R A P H Y</Text>
        <View style={styles.divider}>
          <LinearGradient
            colors={['transparent', Colors.gold, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.dividerGradient}
          />
        </View>
        <Text style={styles.tagline}>Capturing Timeless Moments</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorLine: {
    position: 'absolute' as const,
    width: 300,
    height: 1,
  },
  decorLineInner: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoFrame: {
    width: 80,
    height: 80,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoIcon: {
    fontSize: 36,
    color: Colors.gold,
  },
  logoText: {
    fontSize: 38,
    fontWeight: '200' as const,
    color: Colors.white,
    letterSpacing: 12,
  },
  logoAccent: {
    color: Colors.gold,
    fontWeight: '600' as const,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 6,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  divider: {
    marginVertical: 16,
    alignItems: 'center',
  },
  dividerGradient: {
    width: 120,
    height: 1,
  },
  tagline: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
});
