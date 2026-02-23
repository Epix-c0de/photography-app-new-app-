import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, Pressable, Animated, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Star, Lock, CreditCard, Share2, ArrowRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

const { width, height } = Dimensions.get('window');

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  icon: React.ReactNode;
  stat?: string;
}

const slides: Slide[] = [
  {
    id: '1',
    title: 'Welcome to Epix Visuals Studios.co',
    subtitle: 'Premium Photography',
    description: 'Experience photography like never before. Your moments, captured with artistry and delivered with luxury.',
    image: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=800&h=1200&fit=crop',
    icon: <Star size={24} color={Colors.gold} fill={Colors.gold} />,
    stat: '500+ Happy Clients',
  },
  {
    id: '2',
    title: 'Private Galleries',
    subtitle: 'Secure & Personal',
    description: 'Your photos are delivered to a private, password-protected gallery. Only you can access your memories.',
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=1200&fit=crop',
    icon: <Lock size={24} color={Colors.gold} />,
  },
  {
    id: '3',
    title: 'Seamless Payments',
    subtitle: 'View → Pay → Download',
    description: 'One-tap M-Pesa payments. No hidden fees. Preview your gallery, pay securely, and download instantly.',
    image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=1200&fit=crop',
    icon: <CreditCard size={24} color={Colors.gold} />,
  },
  {
    id: '4',
    title: 'Share Your Story',
    subtitle: 'Effortless Sharing',
    description: 'Share your favorite photos directly to WhatsApp, Instagram, and Facebook. Let the world see your moments.',
    image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&h=1200&fit=crop',
    icon: <Share2 size={24} color={Colors.gold} />,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleComplete = useCallback(async () => {
    console.log('[Onboarding] Completing...');
    await completeOnboarding();
    router.replace('/login');
  }, [completeOnboarding, router]);

  const handleNext = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleComplete();
    }
  }, [currentIndex, handleComplete]);

  const handlePressIn = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start();
  }, [buttonScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  }, [buttonScale]);

  const renderSlide = useCallback(({ item, index }: { item: Slide; index: number }) => {
    return (
      <View style={styles.slide}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.image }} style={styles.slideImage} contentFit="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(10,10,10,0.6)', Colors.background]}
            style={styles.imageOverlay}
            locations={[0, 0.5, 1]}
          />
        </View>

        <View style={styles.slideContent}>
          <View style={styles.iconBadge}>{item.icon}</View>
          <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideDescription}>{item.description}</Text>

          {item.stat && (
            <View style={styles.statBadge}>
              <Text style={styles.statText}>{item.stat}</Text>
            </View>
          )}

          {index === 0 && (
            <View style={styles.reviewsRow}>
              <View style={styles.reviewStars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={12} color={Colors.gold} fill={Colors.gold} />
                ))}
                <Text style={styles.reviewCount}>4.9</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    if (viewableItems[0]?.index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        bounces={false}
      />

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 28, 8], extrapolate: 'clamp' });
            const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
            return (
              <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: Colors.gold }]} />
            );
          })}
        </View>

        <View style={styles.footerButtons}>
          {currentIndex < slides.length - 1 && (
            <Pressable onPress={handleComplete} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleNext}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <Animated.View style={[styles.nextButton, { transform: [{ scale: buttonScale }] }]}>
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark]}
                style={styles.nextButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.nextButtonText}>
                  {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
                </Text>
                <ArrowRight size={18} color={Colors.background} />
              </LinearGradient>
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  slide: {
    width,
    height,
  },
  imageContainer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.6,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  slideContent: {
    position: 'absolute' as const,
    bottom: 160,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  slideSubtitle: {
    fontSize: 13,
    color: Colors.gold,
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 12,
    lineHeight: 38,
  },
  slideDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  statBadge: {
    marginTop: 16,
    backgroundColor: Colors.goldMuted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start' as const,
  },
  statText: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '600' as const,
  },
  reviewsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    marginTop: 20,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.background,
    marginRight: -10,
    overflow: 'hidden' as const,
  },
  reviewAvatarImage: {
    width: '100%',
    height: '100%',
  },
  reviewStars: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    marginLeft: 20,
    gap: 2,
  },
  reviewCount: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '600' as const,
    marginLeft: 6,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingHorizontal: 32,
  },
  pagination: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  footerButtons: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  nextButton: {
    borderRadius: 28,
    overflow: 'hidden' as const,
  },
  nextButtonGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
});
