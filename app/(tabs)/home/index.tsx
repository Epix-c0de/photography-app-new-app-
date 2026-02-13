import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, FlatList, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, ChevronRight, Camera, Unlock, CreditCard, Zap, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 64;

type BTSPost = Database['public']['Tables']['bts_posts']['Row'];
type GalleryRow = Database['public']['Tables']['galleries']['Row'];
type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];

const BTS_CARD_SIZE = 84;
const BTS_CARD_GAP = 14;
const BTS_SNAP = BTS_CARD_SIZE + BTS_CARD_GAP;
const VIEWED_BTS_KEY = 'viewed_bts_post_ids_v1';

function BTSStoryCard({
  item,
  index,
  scrollX,
  isViewed,
  onPress,
  onLongPress,
}: {
  item: BTSPost;
  index: number;
  scrollX: Animated.Value;
  isViewed: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isViewed) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isViewed, pulseAnim]);

  const inputRange = [(index - 1) * BTS_SNAP, index * BTS_SNAP, (index + 1) * BTS_SNAP];
  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [2, -6, 2],
    extrapolate: 'clamp',
  });

  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.38],
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 0.95, duration: 90, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
        ]).start();
        onPress();
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress();
      }}
      delayLongPress={220}
    >
      <Animated.View style={[styles.btsCard, { transform: [{ translateY }, { scale: scaleAnim }] }]}>
        {!isViewed && (
          <Animated.View style={[styles.btsGlow, { opacity: glowOpacity }]} />
        )}

        {isViewed ? (
          <View style={styles.btsRingViewed}>
            <Image source={{ uri: item.media_url }} style={styles.btsImage} contentFit="cover" />
          </View>
        ) : (
          <LinearGradient colors={['#D4AF37', '#B8860B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btsRing}>
            <View style={styles.btsInner}>
              <Image source={{ uri: item.media_url }} style={styles.btsImage} contentFit="cover" />
            </View>
          </LinearGradient>
        )}

        {item.media_type === 'video' && (
          <View style={styles.btsPlay}>
            <Play size={14} color={Colors.white} fill={Colors.white} />
          </View>
        )}

        <Text style={styles.btsCategory} numberOfLines={1}>
          {item.category ?? 'BTS'}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function AnnouncementCard({ item, index, onPress }: { item: AnnouncementRow; index: number; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: index * 150, useNativeDriver: true }).start();
  }, [fadeAnim, index]);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Pressable style={styles.announcementCard} onPress={onPress}>
      <Image source={{ uri: item.image_url ?? '' }} style={styles.announcementImage} contentFit="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.announcementOverlay}
      />
      {item.tag && (
        <View style={styles.announcementTag}>
          <Text style={styles.announcementTagText}>{item.tag}</Text>
        </View>
      )}
      <View style={styles.announcementContent}>
        <Text style={styles.announcementTitle}>{item.title}</Text>
        <Text style={styles.announcementDesc} numberOfLines={2}>
          {item.description ?? ''}
        </Text>
        <View style={styles.announcementCta}>
          <Text style={styles.announcementCtaText}>{item.cta ?? 'View'}</Text>
          <ChevronRight size={14} color={Colors.gold} />
        </View>
      </View>
      </Pressable>
    </Animated.View>
  );
}

function GalleryPreviewCard({ item }: { item: GalleryRow }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const coverUrl = item.cover_photo_url ?? '';
  const isLocked = item.is_locked;
  const title = item.name;
  const subtitle = item.shoot_type ?? 'Gallery';

  return (
    <Pressable
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    >
      <Animated.View style={[styles.galleryCard, { transform: [{ scale: scaleAnim }] }]}>
        {coverUrl.length > 0 ? (
          <Image source={{ uri: coverUrl }} style={styles.galleryCardImage} contentFit="cover" />
        ) : (
          <LinearGradient colors={[Colors.card, Colors.cardLight]} style={styles.galleryCardImage} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.galleryCardOverlay}
        />
        {isLocked && (
          <View style={styles.galleryLockBadge}>
            <Unlock size={12} color={Colors.gold} />
          </View>
        )}
        <View style={styles.galleryCardInfo}>
          <Text style={styles.galleryCardTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.galleryCardMeta}>
            <View style={styles.galleryCardTypeBadge}>
              <Text style={styles.galleryCardType}>{subtitle}</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;
  const btsScrollX = useRef(new Animated.Value(0)).current;
  
  const [greeting, setGreeting] = useState('');
  const [subGreeting, setSubGreeting] = useState('Welcome to your studio');
  const greetingFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const hour = new Date().getHours();
    let timeGreeting = 'Hello';
    if (hour >= 5 && hour < 12) timeGreeting = 'Good morning';
    else if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
    else if (hour >= 17 && hour < 21) timeGreeting = 'Good evening';
    
    setGreeting(`${timeGreeting}, ${user?.name?.split(' ')[0] || 'Guest'} 👋`);
    setSubGreeting('Welcome to your studio');

    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(greetingFadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.delay(100),
      ]).start(() => {
        const quotes = [
          "Every moment deserves to be captured beautifully.",
          "Your memories are priceless — let’s preserve them.",
          "Photography freezes time, we make it unforgettable.",
          "Capturing the moments that matter most.",
          "Your story, beautifully told through our lens."
        ];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        
        setGreeting(randomQuote);
        setSubGreeting(''); 
        
        Animated.timing(greetingFadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [user, greetingFadeAnim]);
  const previewScale = useRef(new Animated.Value(0.96)).current;
  const [btsPosts, setBtsPosts] = useState<BTSPost[]>([]);
  const [btsLoading, setBtsLoading] = useState(true);
  const [btsError, setBtsError] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<BTSPost | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [clientId, setClientId] = useState<string | null>(null);
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [galleriesLoading, setGalleriesLoading] = useState(true);
  const [galleriesError, setGalleriesError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);

  const loadViewed = useCallback(async () => {
    const raw = await AsyncStorage.getItem(VIEWED_BTS_KEY);
    if (!raw) return;
    const ids = JSON.parse(raw);
    if (Array.isArray(ids)) setViewedIds(new Set(ids.filter((v) => typeof v === 'string')));
  }, []);

  const markViewed = useCallback(async (id: string) => {
    setViewedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(VIEWED_BTS_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const fetchBts = useCallback(async () => {
    setBtsLoading(true);
    setBtsError(null);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('bts_posts')
      .select('*')
      .eq('is_active', true)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) {
      setBtsPosts([]);
      setBtsError('Failed to load BTS.');
      setBtsLoading(false);
      return;
    }

    setBtsPosts(data);
    setBtsLoading(false);
  }, []);

  const fetchClientId = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setClientId(null);
      return null;
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', authUser.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      setClientId(null);
      return null;
    }

    const id = data?.id ?? null;
    setClientId(id);
    return id;
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setUnreadCount(0);
      return;
    }

    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authUser.id)
      .eq('read', false);

    setUnreadCount(count ?? 0);
  }, []);

  const fetchGalleries = useCallback(async () => {
    setGalleriesLoading(true);
    setGalleriesError(null);

    const activeClientId = clientId ?? (await fetchClientId());
    if (!activeClientId) {
      setGalleries([]);
      setGalleriesLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('galleries')
      .select('*')
      .eq('client_id', activeClientId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data) {
      setGalleries([]);
      setGalleriesError('Failed to load galleries.');
      setGalleriesLoading(false);
      return;
    }

    setGalleries(data);
    setGalleriesLoading(false);
  }, [clientId, fetchClientId]);

  const fetchAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    setAnnouncementsError(null);
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error || !data) {
      setAnnouncements([]);
      setAnnouncementsError('Failed to load announcements.');
      setAnnouncementsLoading(false);
      return;
    }

    setAnnouncements(data);
    setAnnouncementsLoading(false);
  }, []);

  const orderedBtsPosts = useMemo(() => {
    const unviewed: BTSPost[] = [];
    const viewed: BTSPost[] = [];
    for (const post of btsPosts) {
      if (viewedIds.has(post.id)) viewed.push(post);
      else unviewed.push(post);
    }
    return [...unviewed, ...viewed];
  }, [btsPosts, viewedIds]);

  useEffect(() => {
    loadViewed();
    fetchBts();
    fetchUnreadCount();
    fetchClientId().then(() => {
      fetchGalleries();
      fetchAnnouncements();
    });
  }, [fetchAnnouncements, fetchBts, fetchClientId, fetchGalleries, fetchUnreadCount, loadViewed]);

  useEffect(() => {
    const channel = supabase
      .channel('bts_posts_home')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bts_posts' },
        () => fetchBts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBts]);

  useEffect(() => {
    const channel = supabase
      .channel('home_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchUnreadCount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'galleries' }, () => fetchGalleries())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchAnnouncements())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAnnouncements, fetchGalleries, fetchUnreadCount]);

  useEffect(() => {
    if (!previewPost) return;
    previewScale.setValue(0.96);
    Animated.spring(previewScale, { toValue: 1, useNativeDriver: true }).start();
  }, [previewPost, previewScale]);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <Animated.View style={[styles.header, { paddingTop: insets.top + 12, opacity: headerOpacity }]}>
          <View style={styles.headerContent}>
            <Pressable onPress={() => router.push('/(tabs)/profile')}>
              <Image
                source={{ uri: user?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' }}
                style={styles.headerAvatar}
                contentFit="cover"
              />
            </Pressable>
            <Animated.View style={{ opacity: greetingFadeAnim }}>
              <Text style={styles.greeting}>{greeting}</Text>
              {subGreeting ? <Text style={styles.greetingSub}>{subGreeting}</Text> : null}
            </Animated.View>
          </View>
          <Pressable style={styles.notifButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/notifications'); }}>
            <Bell size={22} color={Colors.white} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleNoPad]}>Behind the Scenes</Text>
            <Pressable onPress={() => router.push('/bts/all' as any)}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          {btsLoading ? (
            <View style={styles.btsLoading}>
              <ActivityIndicator color={Colors.gold} />
            </View>
          ) : btsError ? (
            <View style={styles.emptyAnnouncements}>
              <Text style={styles.emptyAnnouncementsText}>Unable to load content right now.</Text>
              <Pressable onPress={fetchBts}>
                <Text style={styles.retryText}>Refresh</Text>
              </Pressable>
            </View>
          ) : orderedBtsPosts.length === 0 ? (
            <View style={styles.emptyAnnouncements}>
              <Text style={styles.emptyAnnouncementsText}>No BTS posts right now.</Text>
            </View>
          ) : (
            <Animated.FlatList
              data={orderedBtsPosts}
              renderItem={({ item, index }) => (
                <BTSStoryCard
                  item={item}
                  index={index}
                  scrollX={btsScrollX}
                  isViewed={viewedIds.has(item.id)}
                  onPress={() => {
                    markViewed(item.id);
                    router.push(`/bts/${item.id}` as any);
                  }}
                  onLongPress={() => setPreviewPost(item)}
                />
              )}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.btsList}
              snapToInterval={BTS_SNAP}
              decelerationRate="fast"
              nestedScrollEnabled
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: btsScrollX } } }], { useNativeDriver: true })}
              scrollEventThrottle={16}
            />
          )}
        </View>

        <View style={styles.quickActions}>
          <Pressable style={styles.quickAction} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/bookings'); }}>
            <LinearGradient colors={[Colors.goldMuted, 'rgba(212,175,55,0.05)']} style={styles.quickActionGradient}>
              <Camera size={20} color={Colors.gold} />
              <Text style={styles.quickActionText}>Book a Shoot</Text>
            </LinearGradient>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/gallery'); }}>
            <LinearGradient colors={[Colors.goldMuted, 'rgba(212,175,55,0.05)']} style={styles.quickActionGradient}>
              <Unlock size={20} color={Colors.gold} />
              <Text style={styles.quickActionText}>Unlock Gallery</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {galleries.some((g) => g.is_locked && !g.is_paid && (g.price ?? 0) > 0) && (
          <View style={styles.paymentAlert}>
            <LinearGradient
              colors={['rgba(243,156,18,0.12)', 'rgba(243,156,18,0.03)']}
              style={styles.paymentAlertGradient}
            >
              <View style={styles.paymentAlertIcon}>
                <CreditCard size={18} color={Colors.warning} />
              </View>
              <View style={styles.paymentAlertContent}>
                <Text style={styles.paymentAlertTitle}>Pending Payment</Text>
                <Text style={styles.paymentAlertDesc}>
                  {galleries.filter((g) => g.is_locked && !g.is_paid && (g.price ?? 0) > 0).length} galleries awaiting payment
                </Text>
              </View>
              <Pressable
                style={styles.paymentAlertAction}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/gallery'); }}
              >
                <Text style={styles.paymentAlertActionText}>Pay</Text>
                <Zap size={12} color={Colors.background} />
              </Pressable>
            </LinearGradient>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>For You</Text>
            <Pressable onPress={() => router.push('/announcements/all' as any)}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {announcementsLoading ? (
            <View style={styles.btsLoading}>
              <ActivityIndicator color={Colors.gold} />
            </View>
          ) : announcementsError ? (
            <View style={styles.emptyAnnouncements}>
              <Text style={styles.emptyAnnouncementsText}>Check back later for new updates.</Text>
              <Pressable onPress={fetchAnnouncements}>
                <Text style={styles.retryText}>Refresh</Text>
              </Pressable>
            </View>
          ) : announcements.length === 0 ? (
            <View style={styles.emptyAnnouncements}>
              <Text style={styles.emptyAnnouncementsText}>No announcements right now.</Text>
            </View>
          ) : (
            <FlatList
              data={announcements}
              renderItem={({ item, index }) => (
                <AnnouncementCard item={item} index={index} onPress={() => router.push(`/announcements/${item.id}` as any)} />
              )}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.announcementsContainer}
              snapToInterval={CARD_WIDTH + 16}
              decelerationRate="fast"
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Galleries</Text>
            <Pressable>
              <Text style={styles.seeAll}>View all</Text>
            </Pressable>
          </View>
          {galleriesLoading ? (
            <View style={styles.btsLoading}>
              <ActivityIndicator color={Colors.gold} />
            </View>
          ) : galleriesError ? (
            <View style={styles.emptyAnnouncements}>
              <Text style={styles.emptyAnnouncementsText}>{galleriesError}</Text>
              <Pressable onPress={fetchGalleries}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : galleries.length === 0 ? (
            <View style={styles.emptyAnnouncements}>
              <Text style={styles.emptyAnnouncementsText}>Your memories will appear here soon.</Text>
            </View>
          ) : (
            <FlatList
              data={galleries.slice(0, 4)}
              renderItem={({ item }) => <GalleryPreviewCard item={item} />}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleriesContainer}
            />
          )}
        </View>

      </Animated.ScrollView>

      <Modal
        visible={!!previewPost}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPost(null)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewPost(null)}>
          {previewPost && (
            <Pressable
              onPress={() => {
                setPreviewPost(null);
                markViewed(previewPost.id);
                router.push(`/bts/${previewPost.id}` as any);
              }}
            >
              <Animated.View style={[styles.previewCard, { transform: [{ scale: previewScale }] }]}>
                <Image source={{ uri: previewPost.media_url }} style={styles.previewImage} contentFit="cover" />
                <View style={styles.previewMeta}>
                  <Text style={styles.previewCategory}>{previewPost.category ?? 'BTS'}</Text>
                  <Text style={styles.previewTitle} numberOfLines={1}>
                    {previewPost.title ?? 'Behind the Scenes'}
                  </Text>
                </View>
              </Animated.View>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  greetingSub: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitleNoPad: {
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  seeAll: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '500' as const,
  },
  btsLoading: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  btsList: {
    paddingHorizontal: 16,
    paddingBottom: 2,
    gap: BTS_CARD_GAP,
  },
  btsCard: {
    width: BTS_CARD_SIZE,
    alignItems: 'center',
  },
  btsGlow: {
    position: 'absolute' as const,
    top: 2,
    left: 8,
    right: 8,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.gold,
  },
  btsRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    marginBottom: 8,
  },
  btsRingViewed: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  btsInner: {
    flex: 1,
    borderRadius: 33,
    overflow: 'hidden' as const,
    backgroundColor: Colors.card,
  },
  btsImage: {
    width: '100%',
    height: '100%',
    borderRadius: 33,
  },
  btsPlay: {
    position: 'absolute' as const,
    top: 50,
    right: 16,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  btsCategory: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  previewCard: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: Colors.card,
  },
  previewImage: {
    width: '100%',
    height: 320,
  },
  previewMeta: {
    padding: 14,
  },
  previewCategory: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700' as const,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  previewTitle: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  quickActions: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 28,
  },
  quickAction: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  quickActionGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  announcementsContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  announcementCard: {
    width: CARD_WIDTH,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  announcementImage: {
    width: '100%',
    height: '100%',
  },
  announcementOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  announcementTag: {
    position: 'absolute' as const,
    top: 12,
    left: 12,
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  announcementTagText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.background,
    textTransform: 'uppercase' as const,
  },
  announcementContent: {
    position: 'absolute' as const,
    bottom: 14,
    left: 14,
    right: 14,
  },
  announcementTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 4,
  },
  announcementDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  announcementCta: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
  },
  announcementCtaText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  galleriesContainer: {
    paddingHorizontal: 20,
    gap: 14,
  },
  galleryCard: {
    width: 200,
    height: 260,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  galleryCardImage: {
    width: '100%',
    height: '100%',
  },
  galleryCardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  galleryLockBadge: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.goldMuted,
  },
  galleryCardInfo: {
    position: 'absolute' as const,
    bottom: 14,
    left: 14,
    right: 14,
  },
  galleryCardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
    marginBottom: 6,
  },
  galleryCardMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryCardCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  galleryCardTypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  galleryCardType: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '500' as const,
  },
  trustBanner: {
    marginHorizontal: 20,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  trustBannerGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  trustBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustBannerContent: {
    flex: 1,
  },
  trustBannerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  trustBannerDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusCard: {
    marginHorizontal: 20,
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.goldMuted,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  paymentAlert: {
    marginHorizontal: 20,
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(243,156,18,0.2)',
  },
  paymentAlertGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  paymentAlertIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(243,156,18,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentAlertContent: {
    flex: 1,
  },
  paymentAlertTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.warning,
    marginBottom: 2,
  },
  paymentAlertDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  paymentAlertAction: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warning,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  paymentAlertActionText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  emptyAnnouncements: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyAnnouncementsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  retryText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '600' as const,
  },
});
