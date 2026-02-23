import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

export default function SplashScreen() {
  const router = useRouter();
  const { isLoggedIn, hasSeenOnboarding, isLoading, profile } = useAuth();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const [tapCount, setTapCount] = useState<number>(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (isLoading) return;

    const timer = setTimeout(() => {
      console.log('[Splash] Routing...', { isLoggedIn, hasSeenOnboarding, role: profile?.role });
      if (!hasSeenOnboarding) {
        router.replace('/onboarding');
      } else if (!isLoggedIn) {
        router.replace('/login');
      } else if (profile?.role === 'admin') {
        router.replace('/(admin)/dashboard');
      } else {
        router.replace('/(tabs)/home');
      }
    }, 2200);

    return () => clearTimeout(timer);
  }, [isLoading, isLoggedIn, hasSeenOnboarding, profile, router]);

  const handleLogoTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (newCount >= 3) {
      setTapCount(0);
      router.replace('/admin-login');
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
