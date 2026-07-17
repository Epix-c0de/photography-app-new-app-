import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, FlatList, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, usePathname } from 'expo-router';
import { Bell, ChevronRight, Camera, Unlock, CreditCard, Zap, Play, Heart, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { demoAnnouncements, demoBtsPosts, demoGalleries, demoUnreadNotificationCount } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import PaymentModal from '@/components/PaymentModal';

// Lightweight skeleton placeholder (moti renders a stray "." on web)
function Skeleton({ width, height, radius }: { width?: number | string; height?: number; radius?: string }) {
  return (
    <View
      style={{
        width: (typeof width === 'string' ? width : (width ?? 60)) as any,
        height: height ?? 16,
        borderRadius: radius === 'round' ? (height ?? 16) / 2 : 8,
        backgroundColor: 'rgba(212,175,55,0.12)',
      }}
    />
  );
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 64;

type BTSPost = Database['public']['Tables']['bts_posts']['Row'];
type GalleryRow = Database['public']['Tables']['galleries']['Row'];
type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];

const BTS_CARD_SIZE = 84;
const BTS_CARD_GAP = 14;
const BTS_SNAP = BTS_CARD_SIZE + BTS_CARD_GAP;
const VIEWED_BTS_KEY = 'viewed_bts_post_ids_v1';
const LOCAL_UNLOCKED_GALLERY_IDS_KEY = 'local_unlocked_gallery_ids_v1';

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
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);

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

  // Auto-pause video when scrolling
  useEffect(() => {
    const listener = scrollX.addListener(({ value }) => {
      const currentIndex = Math.round(value / BTS_SNAP);
      if (currentIndex !== index && isPlaying) {
        videoRef.current?.stopAsync();
        videoRef.current?.setPositionAsync(0);
        setIsPlaying(false);
      }
    });
    return () => {
      scrollX.removeListener(listener);
      // Cleanup video on unmount
      try { videoRef.current?.unloadAsync(); } catch {}
    };
  }, [scrollX, index, isPlaying]);

  const inputRange = [(index - 1) * BTS_SNAP, index * BTS_SNAP, (index + 1) * BTS_SNAP];
  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [0, 0, 0],
    extrapolate: 'clamp',
  });

  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.38],
  });

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 90, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();

    // Always navigate to detail screen for both images and videos
    onPress();
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        videoRef.current?.setPositionAsync(0);
      }
    }
  };

  return (
    <Pressable
      onPress={handlePress}
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

        {item.media_type === 'video' ? (
          <LinearGradient colors={['#D4AF37', '#B8860B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btsRing}>
            <View style={styles.btsInner}>
              {!isPlaying ? (
                <>
                  <Image 
                    source={{ uri: item.image_url || item.media_url }} 
                    style={styles.btsImage} 
                    contentFit="cover" 
                    transition={300}
                    cachePolicy="memory-disk"
                  />
                  <View style={styles.btsPlay}>
                    <Play size={16} color={Colors.white} fill={Colors.white} />
                  </View>
                </>
              ) : (
                <Video
                  ref={videoRef}
                  source={{ uri: item.media_url }}
                  style={styles.btsVideo}
                  resizeMode={ResizeMode.COVER}
                  isLooping={false}
                  shouldPlay={true}
                  onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                  useNativeControls={false}
                />
              )}
            </View>
          </LinearGradient>
        ) : (
          <LinearGradient 
            colors={isViewed ? ['#333', '#222'] : ['#FFD700', '#D4AF37', '#B8860B']} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            style={[styles.btsRing, !isViewed && styles.btsRingActive]}
          >
            <View style={[styles.btsInner, isViewed && { borderColor: '#444', borderWidth: 1 }]}>
              <Image source={{ uri: item.image_url || item.media_url }} style={styles.btsImage} contentFit="cover" transition={300} cachePolicy="memory-disk" />
            </View>
          </LinearGradient>
        )}

        <Text style={styles.btsCategory} numberOfLines={1}>
          {(item as any).user_profiles?.name
            ? (item as any).user_profiles.name.split(' ')[0]
            : (item.category ?? 'BTS')}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function AnnouncementCard({ item, index, onPress }: { item: AnnouncementRow; index: number; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: index * 150, useNativeDriver: true }).start();
  }, [fadeAnim, index]);

  const handleMediaPress = () => {
    if (item.media_type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        videoRef.current.playAsync();
        setIsPlaying(true);
      }
    } else {
      onPress();
    }
  };

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Pressable style={styles.announcementCard} onPress={onPress}>
        <Pressable onPress={handleMediaPress} style={styles.announcementMediaContainer}>
          {item.media_type === 'video' ? (
            <View style={styles.announcementVideoContainer}>
              <Video
                ref={videoRef}
                source={{ uri: item.image_url || item.media_url || '' }}
                style={styles.announcementVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
                useNativeControls={false}
                onPlaybackStatusUpdate={(status) => {
                  if (status.isLoaded) {
                    setIsPlaying(status.isPlaying);
                  }
                }}
              />
              {!isPlaying && (
                <View style={styles.announcementPlayButton}>
                  <Play size={24} color={Colors.white} fill={Colors.white} />
                </View>
              )}
            </View>
          ) : (
            <Image 
              source={{ uri: item.image_url || item.media_url || '' }} 
              style={styles.announcementImage} 
              contentFit="cover" 
              transition={300}
              cachePolicy="memory-disk"
            />
          )}
        </Pressable>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.announcementOverlay}
        />
        {!!item.tag && (
          <View style={styles.announcementTag}>
            <Text style={styles.announcementTagText}>{item.tag}</Text>
          </View>
        )}
        <View style={styles.announcementContent}>
          {/* Admin attribution row */}
          {(item as any).user_profiles && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {(item as any).user_profiles.avatar_url ? (
                <Image
                  source={{ uri: (item as any).user_profiles.avatar_url }}
                  style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' }}
                  contentFit="cover"
                />
              ) : (
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(212,175,55,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 9, color: Colors.gold, fontWeight: '700' }}>
                    {((item as any).user_profiles.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }} numberOfLines={1}>
                {(item as any).user_profiles.name || 'Photographer'}
              </Text>
            </View>
          )}
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
  const subtitle = item.shoot_type ?? 'My Gallery';
  const photoCount = (item as any).photo_count || 0;
  const router = useRouter();

  return (
    <Pressable
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!item.is_paid && (item.price ?? 0) > 0) {
          router.push(`/(tabs)/gallery?tab=unlock&galleryId=${item.id}`);
          return;
        }
        router.push(`/(tabs)/gallery?galleryId=${item.id}`);
      }}
      style={styles.galleryThumbContainer}
    >
      <Animated.View style={[styles.galleryThumbWrapper, { transform: [{ scale: scaleAnim }] }]}>
        {coverUrl.length > 0 ? (
          <Image source={{ uri: coverUrl }} style={styles.galleryThumbImage} contentFit="contain" transition={300} cachePolicy="memory-disk" />
        ) : (
          <LinearGradient colors={[Colors.card, Colors.cardLight]} style={styles.galleryThumbImage} />
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.galleryThumbOverlay} />
        {isLocked && (
          <View style={styles.galleryThumbLockBadge}>
            <Unlock size={10} color={Colors.background} />
          </View>
        )}
        {photoCount > 0 && (
          <View style={styles.galleryThumbCountBadge}>
            <Text style={styles.galleryThumbCountText}>{photoCount}</Text>
          </View>
        )}
        <View style={styles.galleryThumbInfo}>
          <Text style={styles.galleryThumbTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.galleryThumbSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
          {photoCount > 0 && (
            <Text style={styles.galleryThumbPhotoCount}>
              {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
            </Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useLocalSearchParams();
  const { user, profile, isDemoMode } = useAuth();

  const handleNotificationPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/notifications');
  }, [router]);

  const [activeAdminId, setActiveAdminId] = useState<string | null>(null);

  useEffect(() => {
    // If we have an active filter from notification (deep link), handle it
    const filter = searchParams.filter as string;
    const btsId = searchParams.btsId as string;
    const announcementId = searchParams.announcementId as string;

    if (filter === 'packages') {
      router.push('/(tabs)/bookings');
    } else if (btsId) {
      router.push(`/bts/${btsId}` as any);
    } else if (announcementId) {
      router.push(`/announcements/${announcementId}` as any);
    }
  }, [searchParams]);
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
    
    // Try to get name from multiple sources: profile.name, user.user_metadata, user.email
    const userName = profile?.name || (user?.user_metadata as any)?.full_name || (user?.user_metadata as any)?.name || user?.email?.split('@')[0] || 'Guest';
    const firstName = userName.split(' ')[0];
    
    setGreeting(`${timeGreeting}, ${firstName} 👋`);
    setSubGreeting('Welcome to your studio');

    // Greeting stays visible — no timeout replacement
  }, [user, profile, greetingFadeAnim]);
  const previewScale = useRef(new Animated.Value(0.96)).current;
  const [btsPosts, setBtsPosts] = useState<BTSPost[]>([]);
  const [btsLoading, setBtsLoading] = useState(true);
  const [btsError, setBtsError] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<BTSPost | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [galleriesLoading, setGalleriesLoading] = useState(true);
  const [galleriesError, setGalleriesError] = useState<string | null>(null);
  const [realUnpaidGalleries, setRealUnpaidGalleries] = useState<GalleryRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentGallery, setPaymentGallery] = useState<GalleryRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trustStats, setTrustStats] = useState({ clientCount: 0, avgRating: 0 });

  const readLocalUnlockedGalleryIds = useCallback(async (): Promise<string[]> => {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_UNLOCKED_GALLERY_IDS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id) => typeof id === 'string' && id.length > 0);
    } catch {
      return [];
    }
  }, [isDemoMode]);

  const handlePaymentSuccess = useCallback(() => {
    if (paymentGallery) {
      setGalleries(prev => prev.map(g => g.id === paymentGallery.id ? { ...g, is_paid: true, is_locked: false } : g));
    }
  }, [paymentGallery]);

  const handlePayGallery = useCallback((gallery: GalleryRow) => {
    setPaymentGallery(gallery);
    setPaymentModalVisible(true);
  }, []);

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
    try {
      if (isDemoMode) {
        setBtsPosts(demoBtsPosts);
        return;
      }
      

      
      // Use the visibility filtering RPC function
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {

        // If not logged in, only show active content
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from('bts_posts')
          .select('*')
          .eq('is_active', true)
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
          .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('[BTS Feed] ✗ Failed to load BTS posts:', error);
          setBtsPosts([]);
          setBtsError('Failed to load BTS. Error: ' + (error.message || 'Unknown error'));
          setBtsLoading(false);
          return;
        }

        // Fetch user profiles for each unique created_by
        const creatorIds = [...new Set((data || []).map((p: any) => p.created_by).filter(Boolean))];
        let profileMap: Record<string, any> = {};
        if (creatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, name, avatar_url')
            .in('id', creatorIds);
          if (profiles) {
            profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
          }
        }
        const enriched = (data || []).map((p: any) => ({
          ...p,
          user_profiles: profileMap[p.created_by] || null,
        }));

        setBtsPosts(enriched || []);
      } else {
        // Direct query — show all active BTS posts (RLS allows public read)
        // Fetch user_profiles separately since created_by references auth.users, not user_profiles
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from('bts_posts')
          .select('*')
          .eq('is_active', true)
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
          .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('[BTS Feed] ✗ Failed to load BTS posts:', error);
          setBtsPosts([]);
          setBtsError('Failed to load BTS. Error: ' + (error.message || 'Unknown error'));
          setBtsLoading(false);
          return;
        }

        // Fetch user profiles for each unique created_by
        const creatorIds = [...new Set((data || []).map((p: any) => p.created_by).filter(Boolean))];
        let profileMap: Record<string, any> = {};
        if (creatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, name, avatar_url')
            .in('id', creatorIds);
          if (profiles) {
            profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
          }
        }
        const enriched = (data || []).map((p: any) => ({
          ...p,
          user_profiles: profileMap[p.created_by] || null,
        }));

        setBtsPosts((enriched || []) as BTSPost[]);
      }
    } catch (err) {
      console.error('[BTS Feed] ✗ Error fetching BTS:', err);
      setBtsError('Failed to load BTS posts: ' + ((err as any)?.message || String(err)));
    } finally {
      setBtsLoading(false);
    }
  }, [isDemoMode]);

  const fetchAllClientIds = useCallback(async () => {
    if (isDemoMode) {
      setClientIds(['demo-client']);
      return ['demo-client'];
    }
    let authUser: any = null;
    try {
      const result = await supabase.auth.getUser();
      authUser = result.data?.user;
    } catch {
      setClientIds([]);
      return [];
    }
    if (!authUser) {
      setClientIds([]);
      return [];
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', authUser.id);

    if (error) {
      setClientIds([]);
      return [];
    }

    const ids = (data || []).map((r: any) => r.id).filter(Boolean);
    setClientIds(ids);
    return ids;
  }, [isDemoMode]);

  const fetchUnreadCount = useCallback(async () => {
    if (isDemoMode) {
      setUnreadCount(demoUnreadNotificationCount);
      return;
    }
    let authUser: any = null;
    try {
      const result = await supabase.auth.getUser();
      authUser = result.data?.user;
    } catch {
      setUnreadCount(0);
      return;
    }
    if (!authUser) {
      setUnreadCount(0);
      return;
    }

    const { count: userCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authUser.id)
      .or('read.eq.false,is_read.eq.false');

    let clientCount = 0;
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (clientRow) {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientRow.id)
        .is('user_id', null)
        .or('read.eq.false,is_read.eq.false');
      clientCount = count ?? 0;
    }

    setUnreadCount((userCount ?? 0) + clientCount);
  }, [isDemoMode]);

  const fetchGalleries = useCallback(async () => {
    setGalleriesLoading(true);
    setGalleriesError(null);

    if (isDemoMode) {
      // Still query real DB for unpaid galleries (for payment banner)
      if (user?.id) {
        try {
          const { data: clientRows } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id);
          const realClientIds = (clientRows || []).map((r: any) => r.id).filter(Boolean);
          if (realClientIds.length > 0) {
            const { data: unpaidData } = await supabase
              .from('galleries')
              .select('*')
              .in('client_id', realClientIds);
            setRealUnpaidGalleries(
              (unpaidData || []).filter((g: any) => g.is_locked && !g.is_paid && (g.price ?? 0) > 0)
            );
          }
        } catch (e) {
          console.error('[Home] Error fetching real unpaid galleries:', e);
        }
      }
      setGalleries(demoGalleries);
      setGalleriesLoading(false);
      return;
    }

    // Don't query until user is available — avoids client_id=eq.undefined 400 errors
    if (!user?.id) {
      setGalleries([]);
      setGalleriesLoading(false);
      return;
    }

    const activeClientIds = clientIds.length > 0 ? clientIds : (await fetchAllClientIds());

    const { data: clientGalleries, error: clientError } = activeClientIds.length > 0
      ? await supabase
          .from('galleries')
          .select('*')
          .in('client_id', activeClientIds)
      : { data: [], error: null };

    // Only fetch unlocked galleries when user?.id is available
    const { data: unlockedGalleries, error: unlockedError } = user?.id
      ? await supabase
          .from('unlocked_galleries')
          .select('gallery_id, galleries(*)')
          .eq('user_id', user.id)
      : { data: [], error: null };

    const localUnlockedIds = await readLocalUnlockedGalleryIds();
    let locallyUnlockedGalleries: GalleryRow[] = [];
    if (localUnlockedIds.length > 0) {
      const { data: localData, error: localError } = await supabase
        .from('galleries')
        .select('*')
        .in('id', localUnlockedIds);
      if (localError) console.error('[Home] Error loading local unlocked galleries:', localError);
      locallyUnlockedGalleries = localData || [];
    }

    if (clientError) console.error('[Home] Error loading client galleries:', clientError);
    if (unlockedError) console.error('[Home] Error loading unlocked galleries:', unlockedError);

    const clientGals = clientGalleries || [];
    const unlockedGals = (unlockedGalleries || [])
      .map((ug: any) => ug.galleries)
      .filter(Boolean);

    const merged = [...clientGals, ...unlockedGals, ...locallyUnlockedGalleries];
    const unique = merged.filter((g, index, self) => index === self.findIndex(x => x.id === g.id));
    unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const limited = unique.slice(0, 10);
    const limitedIds = limited.map((g) => g.id);

    const galleryThumbnailMap = new Map<string, string>();
    const galleryPhotoCountMap = new Map<string, number>();
    if (limitedIds.length > 0) {
      const { data: thumbRows, error: thumbError } = await supabase
        .from('gallery_photos')
        .select('gallery_id, photo_url, created_at')
        .in('gallery_id', limitedIds)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false });
      if (thumbError) {
        console.error('[Home] Error loading gallery thumbnails:', thumbError);
      } else {
        (thumbRows || []).forEach((row: any) => {
          galleryPhotoCountMap.set(row.gallery_id, (galleryPhotoCountMap.get(row.gallery_id) || 0) + 1);
          if (!galleryThumbnailMap.has(row.gallery_id) && row.photo_url) {
            galleryThumbnailMap.set(row.gallery_id, row.photo_url);
          }
        });
      }
    }

    const normalizeCoverPath = (urlOrPath: string) => {
      if (!urlOrPath) return null;
      if (!urlOrPath.startsWith('http')) return urlOrPath;
      const publicMarker = '/object/public/client-photos/';
      const publicIdx = urlOrPath.indexOf(publicMarker);
      if (publicIdx !== -1) {
        const tail = urlOrPath.slice(publicIdx + publicMarker.length);
        return tail.split('?')[0];
      }
      const signedMarker = '/object/sign/client-photos/';
      const signedIdx = urlOrPath.indexOf(signedMarker);
      if (signedIdx !== -1) {
        const tail = urlOrPath.slice(signedIdx + signedMarker.length);
        return tail.split('?')[0];
      }
      return null;
    };

    const coverPaths = limited
      .map((g) => normalizeCoverPath(galleryThumbnailMap.get(g.id) || g.cover_photo_url || ''))
      .filter((path): path is string => !!path);

    let signedCoverMap = new Map<string, string>();
    if (coverPaths.length > 0) {
      const { data: signedCovers } = await supabase.storage
        .from('client-photos')
        .createSignedUrls(coverPaths, 3600);
      if (signedCovers) {
        signedCovers.forEach((s: any) => {
          if (s.path && s.signedUrl) signedCoverMap.set(s.path, s.signedUrl);
        });
      }
    }

    const withSignedCovers = limited.map((g) => {
      const preferredCover = galleryThumbnailMap.get(g.id) || g.cover_photo_url || '';
      let coverUrl = preferredCover;
      if (preferredCover) {
        const normalized = normalizeCoverPath(preferredCover);
        if (normalized && signedCoverMap.has(normalized)) {
          coverUrl = signedCoverMap.get(normalized)!;
        } else if (!preferredCover.startsWith('http')) {
          const { data } = supabase.storage.from('client-photos').getPublicUrl(preferredCover);
          if (data?.publicUrl) coverUrl = data.publicUrl;
        }
      }
      return { ...g, cover_photo_url: coverUrl, photo_count: galleryPhotoCountMap.get(g.id) || 0 };
    });

    setGalleries(withSignedCovers);
    setGalleriesLoading(false);
  }, [clientIds, fetchAllClientIds, isDemoMode, readLocalUnlockedGalleryIds, user?.id]);

  // Gallery fetches are handled by the main useEffect below (fetchAllClientIds -> fetchGalleries)
  // Removed duplicate pathname-based fetch to prevent double network calls on mount

  const fetchAnnouncements = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setAnnouncementsLoading(true);
    }
    setAnnouncementsError(false);
    if (isDemoMode) {
      setAnnouncements(demoAnnouncements);
      setAnnouncementsLoading(false);
      return;
    }



    try {
      // Use the visibility filtering RPC function
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {

        // If not logged in, only show active content
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(8);

        if (error || !data) {
          console.error('[Announcements] ✗ Failed to load announcements:', error);
          setAnnouncements([]);
          setAnnouncementsError(true);
          setAnnouncementsLoading(false);
          return;
        }

        // Fetch user profiles for announcements
        const annCreatorIds = [...new Set(data.map((p: any) => p.created_by || p.owner_admin_id).filter(Boolean))];
        let annProfileMap: Record<string, any> = {};
        if (annCreatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, name, avatar_url')
            .in('id', annCreatorIds);
          if (profiles) annProfileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
        }
        const enriched = data.map((ann: any) => ({
          ...ann,
          user_profiles: annProfileMap[ann.created_by || ann.owner_admin_id] || null,
        }));

        setAnnouncements(enriched);
        setAnnouncementsLoading(false);
      } else {
        // Direct query — show all active announcements (RLS allows public read)
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error || !data) {
          console.error('[Announcements] ✗ Failed to load announcements:', error);
          setAnnouncements([]);
          setAnnouncementsError(true);
          setAnnouncementsLoading(false);
          return;
        }

        // Fetch user profiles for announcements
        const annCreatorIds = [...new Set(data.map((p: any) => p.created_by || p.owner_admin_id).filter(Boolean))];
        let annProfileMap: Record<string, any> = {};
        if (annCreatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, name, avatar_url')
            .in('id', annCreatorIds);
          if (profiles) annProfileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
        }
        const enriched = data.map((ann: any) => ({
          ...ann,
          user_profiles: annProfileMap[ann.created_by || ann.owner_admin_id] || null,
        }));

        setAnnouncements(enriched as AnnouncementRow[]);
        setAnnouncementsLoading(false);
      }
    } catch (err) {
      console.error('[Announcements] ✗ Error fetching announcements:', err);
      setAnnouncements([]);
      setAnnouncementsError(true);
      setAnnouncementsLoading(false);
    }
  }, [isDemoMode]);

  const orderedBtsPosts = useMemo(() => {
    const unviewed: BTSPost[] = [];
    const viewed: BTSPost[] = [];
    for (const post of btsPosts) {
      if (viewedIds.has(post.id)) viewed.push(post);
      else unviewed.push(post);
    }
    return [...unviewed, ...viewed];
  }, [btsPosts, viewedIds]);

  const pendingPaymentGalleries = useMemo(
    () => isDemoMode
      ? realUnpaidGalleries
      : galleries.filter((gallery) => gallery.is_locked && !gallery.is_paid && (gallery.price ?? 0) > 0),
    [galleries, isDemoMode, realUnpaidGalleries]
  );
  const hasPendingPayments = pendingPaymentGalleries.length > 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchBts(),
        fetchUnreadCount(),
        fetchAllClientIds().then(() => Promise.all([fetchGalleries(), fetchAnnouncements()])),
      ]);
    } catch {}
    setRefreshing(false);
  }, [fetchBts, fetchUnreadCount, fetchAllClientIds, fetchGalleries, fetchAnnouncements]);

  useEffect(() => {
    loadViewed();
    fetchBts();
    fetchUnreadCount();
    fetchAllClientIds().then(() => {
      fetchGalleriesRef.current();
      fetchAnnouncementsRef.current(true);
    });
    (async () => {
      try {
        const { count: clientCount } = await supabase
          .from('clients')
          .select('id', { count: 'exact', head: true });
        const { data: ratingData } = await supabase
          .from('reviews')
          .select('rating');
        const ratings = (ratingData || []).map((r: any) => r.rating).filter(Boolean);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : '0.0';
        setTrustStats({ clientCount: clientCount ?? 0, avgRating: parseFloat(avgRating) });
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — callbacks are accessed via refs to avoid re-render loops

  // Use refs to store callbacks so realtime subscription doesn't re-run when they change
  const fetchBtsRef = useRef(fetchBts);
  const fetchAnnouncementsRef = useRef(fetchAnnouncements);
  const fetchGalleriesRef = useRef(fetchGalleries);
  const fetchUnreadCountRef = useRef(fetchUnreadCount);

  // Update refs when callbacks change
  useEffect(() => { fetchBtsRef.current = fetchBts; }, [fetchBts]);
  useEffect(() => { fetchAnnouncementsRef.current = fetchAnnouncements; }, [fetchAnnouncements]);
  useEffect(() => { fetchGalleriesRef.current = fetchGalleries; }, [fetchGalleries]);
  useEffect(() => { fetchUnreadCountRef.current = fetchUnreadCount; }, [fetchUnreadCount]);

  // Subscribe to realtime updates only once on mount
  useEffect(() => {
    if (isDemoMode) return;
    // Use unique channel name to avoid conflicts with any existing channels
    const channelName = `user_app_home_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bts_posts' }, () => fetchBtsRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchUnreadCountRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'galleries' }, () => fetchGalleriesRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchAnnouncementsRef.current())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Empty dependency array - only run once on mount

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
      {/* Sticky Header with Greeting */}
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 12 }]}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.95)' }]} /><BlurView intensity={200} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.stickyHeaderContent}>
          <View style={styles.headerContent}>
            <Pressable onPress={() => router.push('/(tabs)/profile')}>
              {profile?.avatar_url || (user?.user_metadata as any)?.avatar_url ? (
                <Image
                  source={{ uri: (profile?.avatar_url || (user?.user_metadata as any)?.avatar_url) as string }}
                  style={styles.headerAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.headerAvatarFallback}>
                  {(() => {
                    const email = user?.email || '';
                    const first = (email.split('@')[0] || '').trim();
                    const char = (first[0] || 'U').toUpperCase();
                    return <Text style={styles.headerAvatarFallbackText}>{char}</Text>;
                  })()}
                </View>
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting} numberOfLines={2}>{greeting}</Text>
              {subGreeting ? <Text style={styles.greetingSub} numberOfLines={1}>{subGreeting}</Text> : null}
            </View>
          </View>
          <Pressable style={styles.notifButton} onPress={handleNotificationPress}>
            <Bell size={22} color={Colors.white} />
            {unreadCount > 0 ? (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 80 + insets.top, paddingBottom: Math.max(insets.bottom + 120, 160) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} colors={[Colors.gold]} />}
      >
        <ErrorBoundary label="BTS Section">
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.sectionTitleNoPad]}>Behind the Scenes</Text>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/bts/all' as any); }}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          {btsLoading ? (
            <View style={styles.btsList}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.btsCard, { marginRight: 16 }]}>
                  <Skeleton radius="round" height={BTS_CARD_SIZE} width={BTS_CARD_SIZE} />
                  <View style={{ marginTop: 8, alignSelf: 'center' }}>
                    <Skeleton width={60} height={12} />
                  </View>
                </View>
              ))}
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
              directionalLockEnabled
              removeClippedSubviews={false}
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
                {hasPendingPayments && (
                  <View style={styles.redBadge} />
                )}
              </View>
              <Text style={styles.quickActionText}>Unlock Gallery</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {hasPendingPayments && (
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
                    handlePayGallery(firstPending);
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
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>For You</Text>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/announcements' as any); }}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {announcementsLoading ? (
            <View style={styles.announcementsContainer}>
              <View style={[styles.announcementCard, { backgroundColor: '#1C1C1E', overflow: 'hidden' }]}>
                <Skeleton width={CARD_WIDTH} height={180} />
                <View style={{ padding: 12 }}>
                  <Skeleton width="80%" height={16} />
                  <View style={{ height: 8 }} />
                  <Skeleton width="100%" height={12} />
                  <View style={{ height: 6 }} />
                  <Skeleton width="60%" height={12} />
                </View>
              </View>
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
              snapToInterval={width - 32}
              snapToAlignment="start"
              decelerationRate="fast"
              pagingEnabled={false}
              nestedScrollEnabled
            />
          )}
        </View>
        </ErrorBoundary>

        <ErrorBoundary label="Galleries Section">
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Galleries</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(hasPendingPayments ? '/(tabs)/gallery?tab=unlock' : '/(tabs)/gallery');
              }}
            >
              <Text style={styles.seeAll}>View all</Text>
            </Pressable>
          </View>
          {galleriesLoading ? (
            <View style={styles.recentGalleriesList}>
              {[1, 2].map((i) => (
                <View key={i} style={[styles.galleryThumbContainer, { marginRight: 16 }]}>
                  <View style={[styles.galleryThumbWrapper, { backgroundColor: '#1C1C1E', overflow: 'hidden' }]}>
                    <Skeleton width={160} height={200} />
                    <View style={[styles.galleryThumbInfo, { zIndex: 10 }]}>
                      <Skeleton width="70%" height={16} />
                      <View style={{ height: 6 }} />
                      <Skeleton width="40%" height={12} />
                    </View>
                  </View>
                </View>
              ))}
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
              snapToInterval={176}
              snapToAlignment="start"
              decelerationRate="fast"
            />
          )}
        </View>
        </ErrorBoundary>

        <Pressable 
          style={styles.trustBanner}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/profile'); }}
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
              <Text style={styles.trustBannerTitle}>Trusted by {trustStats.clientCount || '50+'} clients</Text>
              <Text style={styles.trustBannerDesc}>{trustStats.avgRating > 0 ? `${trustStats.avgRating} average rating` : 'Rated by clients'}</Text>
            </View>
            <ChevronRight size={16} color={Colors.textMuted} />
          </LinearGradient>
        </Pressable>

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
                <Image source={{ uri: previewPost.image_url || previewPost.media_url }} style={styles.previewImage} contentFit="cover" />
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
      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        gallery={paymentGallery}
        clientPhone={user?.user_metadata?.phone || (user as any)?.phone}
        onSuccess={handlePaymentSuccess}
      />
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
    flex: 1,
    paddingRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  headerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarFallbackText: {
    color: Colors.gold,
    fontWeight: '800' as const,
    fontSize: 16,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
    flexWrap: 'wrap' as const,
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
  // Sticky Header Styles
  stickyHeader: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden' as const,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  stickyHeaderContent: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  // Navigation blur gradient
  navBlurGradient: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99,
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
    padding: 2,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  btsRingActive: {
    padding: 2.5,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  btsRingViewed: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 2.5,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
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
  btsVideo: {
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
  actionIconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  redBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F44336',
    borderWidth: 2,
    borderColor: '#000',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  announcementsContainer: {
    paddingHorizontal: 20,
    gap: 16,
    paddingTop: 8,
  },
  announcementCard: {
    width: width - 48,
    height: 380,
    backgroundColor: Colors.card,
    borderRadius: 24,
    overflow: 'hidden' as const,
    marginBottom: 16,
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  announcementMediaContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  announcementVideoContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.cardDark,
  },
  announcementVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  announcementPlayButton: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: [{ translateX: -32 }, { translateY: -32 }],
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  announcementImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  announcementOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  announcementTag: {
    position: 'absolute' as const,
    top: 16,
    left: 16,
    backgroundColor: 'rgba(212,175,55,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backdropFilter: 'blur(10px)',
  },
  announcementTagText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: Colors.background,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  announcementContent: {
    position: 'absolute' as const,
    bottom: 24,
    left: 20,
    right: 20,
  },
  announcementTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.white,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  announcementDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  announcementCta: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 6,
  },
  announcementCtaText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  galleriesContainer: {
    paddingHorizontal: 20,
    gap: 14,
  },
  galleryThumbContainer: {
    width: 162,
  },
  galleryThumbWrapper: {
    width: 162,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.32)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    shadowColor: Colors.gold,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  galleryThumbImage: {
    width: '100%',
    height: '100%',
  },
  galleryThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  galleryThumbInfo: {
    position: 'absolute' as const,
    left: 12,
    right: 12,
    bottom: 12,
  },
  galleryThumbLockBadge: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  galleryThumbTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  galleryThumbSubtitle: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  galleryThumbCountBadge: {
    position: 'absolute' as const,
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backdropFilter: 'blur(8px)',
  },
  galleryThumbCountText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  galleryThumbPhotoCount: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: 'rgba(212,175,55,0.8)',
    marginTop: 4,
  },
  trustBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  trustBannerGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  trustBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustBannerContent: {
    flex: 1,
  },
  trustBannerTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  trustBannerDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    opacity: 0.8,
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
    borderRadius: 16,
    overflow: 'hidden' as const,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  paymentAlertGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },
  paymentAlertIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
  },
  paymentAlertContent: {
    flex: 1,
  },
  paymentAlertTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.gold,
    marginBottom: 2,
  },
  paymentAlertDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    opacity: 0.8,
  },
  paymentAlertAction: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  paymentAlertActionText: {
    fontSize: 14,
    fontWeight: '800' as const,
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
  recentGalleriesList: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
  },
  retryText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '600' as const,
  },
});
