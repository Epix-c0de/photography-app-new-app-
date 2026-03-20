import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Dimensions, Alert, Share, ActivityIndicator, Platform, PermissionsAndroid, Linking, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Unlock, Search, Heart, Download, Eye, X, Share2, ShoppingBag, ArrowLeft, CreditCard, AlertCircle, Zap } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ScreenCapture from 'expo-screen-capture';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { ClientService, type Photo as ClientPhoto, type PortfolioItem } from '@/services/client';
import { useBranding } from '@/contexts/BrandingContext';
import { useAuth } from '@/contexts/AuthContext';
import PaymentModal from '@/components/PaymentModal';
import { LocalSmsGateway } from '@lenzart/local-sms-gateway';
import { useLocalSearchParams, usePathname } from 'expo-router';

const { width } = Dimensions.get('window');
const COL_GAP = 8;
const PADDING = 16;
const COL_WIDTH = (width - PADDING * 2 - COL_GAP) / 2;
const LOCAL_UNLOCKED_GALLERY_IDS_KEY = 'local_unlocked_gallery_ids_v1';

type TabType = 'my-galleries' | 'portfolio' | 'top-rated' | 'unlock';
type ShareSheetPayload = { title: string; message: string; link: string };

type GalleryRow = Database['public']['Tables']['galleries']['Row'];
type GalleryRowWithCounts = GalleryRow & { photo_count?: number | null };
type PhotoRow = ClientPhoto;
type BTSPost = Database['public']['Tables']['bts_posts']['Row'];

function PhotoCard({ photo, index, onLike, onOpenPhoto, isLiked, showWatermark, isBlurred, accessCodeLink, shareAppLink, isGalleryUnpaid }: { photo: PhotoRow; index: number; onLike: (id: string) => void; onOpenPhoto: (photo: PhotoRow) => void; isLiked: boolean; showWatermark: boolean; isBlurred?: boolean; accessCodeLink: string; shareAppLink: string; isGalleryUnpaid?: boolean }) {
  const {
    brandName,
    watermarkText,
    watermarkOpacity,
    watermarkRotation,
    watermarkSize,
    watermarkPosition,
  } = useBranding();
  const heartScale = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardFade, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }).start();
  }, [cardFade, index]);

  const handleDoubleTap = useCallback(() => {
    if (isGalleryUnpaid) {
      // Show payment modal for unpaid galleries
      Alert.alert('Payment Required', 'Please unlock this gallery to view photos without watermarks.');
      return;
    }
    onLike(photo.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, friction: 3, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 0, duration: 600, delay: 400, useNativeDriver: true }),
    ]).start();
  }, [heartScale, onLike, photo.id, isGalleryUnpaid]);

  const handleOpen = useCallback(() => {
    onOpenPhoto(photo);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onOpenPhoto, photo]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Check if gallery is paid/unlocked
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!clientData) return;

      // Check if this gallery is paid/unlocked
      const { data: galleryData } = await supabase
        .from('galleries')
        .select('is_paid, is_locked, access_code')
        .eq('client_id', clientData.id)
        .maybeSingle();

      if (galleryData && !galleryData.is_paid && galleryData.is_locked) {
        Alert.alert('Payment Required', 'Please unlock this gallery to share photos.');
        return;
      }

      // Share a friendly message + deep link (avoid exposing raw storage URLs)
      const link = galleryData?.access_code ? `${accessCodeLink}${galleryData.access_code}` : shareAppLink;
      await Share.share({
        message: `Check out this photo from ${brandName}!\nPhoto Link: ${shareAppLink}\nGallery Link: ${link}`,
        url: shareAppLink,
        title: 'Share Photo',
      });
    } catch (error) {
      console.error('Failed to share photo:', error);
    }
  }, [brandName, photo.url, accessCodeLink, shareAppLink]);

  const aspectRatio = (photo.width ?? 1) / (photo.height ?? 1);
  const imageHeight = COL_WIDTH / aspectRatio;
  const opacity = Math.max(0, Math.min(100, watermarkOpacity)) / 100;
  const displayText = (watermarkText || '').trim();
  const fontSize = watermarkSize === 'small' ? 12 : watermarkSize === 'large' ? 22 : 16;
  const rotation = `${-1 * watermarkRotation}deg`;
  // Heavy watermarks for unpaid galleries
  const heavyOpacity = isGalleryUnpaid ? Math.max(0.8, opacity) : opacity;
  const shouldShowWatermark = showWatermark && photo.variant === 'watermarked' && heavyOpacity > 0 && displayText.length > 0;


  const randomPoints = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < photo.id.length; i++) {
      hash = (hash * 31 + photo.id.charCodeAt(i)) >>> 0;
    }

    const next = () => {
      hash = (hash * 1664525 + 1013904223) >>> 0;
      return hash / 0xffffffff;
    };

    return [
      { top: 10 + next() * 25, left: 5 + next() * 55 },
      { top: 40 + next() * 25, left: 25 + next() * 55 },
      { top: 65 + next() * 20, left: 10 + next() * 70 },
      { top: 20 + next() * 60, left: 60 + next() * 25 },
    ];
  }, [photo.id]);

  return (
    <Animated.View style={[styles.photoCard, { opacity: cardFade }]}>
      <Pressable onPress={handleOpen} onLongPress={handleDoubleTap}>
        <Image
          source={{ uri: photo.thumbnailUrl || photo.url }}
          style={[styles.photoImage, { height: imageHeight }, isBlurred && { opacity: 0.7 }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority={index < 10 ? "high" : "low" }
          blurRadius={isBlurred ? 15 : 0}
        />
        {isBlurred && (
          <View style={styles.blurOverlay}>
            <Lock size={20} color={Colors.white} />
          </View>
        )}
        {shouldShowWatermark && (
          <View style={styles.watermarkOverlay} pointerEvents="none">
            {watermarkPosition === 'grid' ? (
              <View style={styles.watermarkGrid}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <Text
                    key={`${photo.id}-wm-${i}`}
                    style={[
                      styles.watermarkText,
                      { color: `rgba(255,255,255,${heavyOpacity * 0.55})`, fontSize, transform: [{ rotate: rotation }] },
                    ]}
                  >
                    {displayText}
                  </Text>
                ))}
              </View>
            ) : watermarkPosition === 'randomized' ? (
              <View style={StyleSheet.absoluteFillObject}>
                {randomPoints.map((p, i) => (
                  <Text
                    key={`${photo.id}-wm-r-${i}`}
                    style={[
                      styles.watermarkText,
                      {
                        position: 'absolute',
                        top: `${p.top}%`,
                        left: `${p.left}%`,
                        color: `rgba(255,255,255,${heavyOpacity * 0.55})`,
                        fontSize,
                        transform: [{ rotate: rotation }],
                      },
                    ]}
                  >
                    {displayText}
                  </Text>
                ))}
              </View>
            ) : (
              <Text
                style={[
                  styles.watermarkText,
                  { color: `rgba(255,255,255,${heavyOpacity * 0.55})`, fontSize, transform: [{ rotate: rotation }] },
                ]}
              >
                {displayText}
              </Text>
            )}
          </View>
        )}
        <Animated.View style={[styles.heartOverlay, { transform: [{ scale: heartScale }], opacity: heartScale }]}>
          <Heart size={40} color={Colors.gold} fill={Colors.gold} />
        </Animated.View>
        {isLiked && (
          <View style={styles.likedBadge}>
            <Heart size={12} color={Colors.gold} fill={Colors.gold} />
          </View>
        )}
        <Pressable style={styles.shareIconButton} onPress={handleShare} hitSlop={8}>
          <Share2 size={12} color={Colors.white} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function PortfolioCard({ item, index, onLike, onPress }: { item: PortfolioItem; index: number; onLike: (id: string, isPortfolio: boolean) => void; onPress: (item: PortfolioItem) => void }) {
  const cardFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardFade, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }).start();
  }, [cardFade, index]);

  const handlePress = useCallback(() => {
    onPress(item);
  }, [onPress, item]);

  return (
    <Animated.View style={[styles.photoCard, { opacity: cardFade, marginBottom: 12 }]}>
      <Pressable onPress={handlePress}>
        <Image source={{ uri: item.image_url || item.media_url }} style={[styles.photoImage, { height: COL_WIDTH * 1.5 }]} contentFit="cover" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.galleryTileOverlay} />
        <View style={{ position: 'absolute', bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 14 }}>
            <Pressable hitSlop={12} onPress={() => onLike(item.id, true)}>
              <Heart size={16} color={Colors.white} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { brandName, blockScreenshots, setActiveAdminId, accessCodeLink, shareAppLink } = useBranding();
  const pathname = usePathname();
  const searchParams = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('my-galleries');
  const [accessCode, setAccessCode] = useState<string>((searchParams.accessCode as string) || '');
  const smsAutofillLastTriedAt = useRef<number>(0);
  const [selectedGallery, setSelectedGallery] = useState<GalleryRowWithCounts | null>(null);
  const [likedPhotos, setLikedPhotos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const unlockAnim = useRef(new Animated.Value(0)).current;
  const photosRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const galleriesRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSharingRef = useRef(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [galleries, setGalleries] = useState<GalleryRowWithCounts[]>([]);
  const [galleriesLoading, setGalleriesLoading] = useState(true);
  const [galleriesError, setGalleriesError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentGallery, setPaymentGallery] = useState<GalleryRowWithCounts | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [topRatedItems, setTopRatedItems] = useState<PortfolioItem[]>([]);
  const [topRatedLoading, setTopRatedLoading] = useState(false);
  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState<PortfolioItem | null>(null);
  const [selectedPhotoItem, setSelectedPhotoItem] = useState<PhotoRow | null>(null);
  const [shareSheet, setShareSheet] = useState<ShareSheetPayload | null>(null);

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
  }, []);

  const saveLocalUnlockedGalleryId = useCallback(async (galleryId: string) => {
    try {
      const existing = await readLocalUnlockedGalleryIds();
      if (existing.includes(galleryId)) return;
      await AsyncStorage.setItem(LOCAL_UNLOCKED_GALLERY_IDS_KEY, JSON.stringify([...existing, galleryId]));
    } catch {
    }
  }, [readLocalUnlockedGalleryIds]);

  const favoritesCount = likedPhotos.size;

  useEffect(() => {
    if (activeTab === 'portfolio') {
      setPortfolioLoading(true);
      ClientService.portfolio.list()
        .then(setPortfolioItems)
        .catch(console.error)
        .finally(() => setPortfolioLoading(false));
    } else if (activeTab === 'top-rated') {
      setTopRatedLoading(true);
      ClientService.portfolio.listTopRated()
        .then(setTopRatedItems)
        .catch(console.error)
        .finally(() => setTopRatedLoading(false));
    }
  }, [activeTab]);

  const fetchPhotosForGallery = useCallback(async (galleryId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setPhotosLoading(true);
      setPhotosError(null);
    }

    try {
      const data = await ClientService.gallery.getPhotos(galleryId, { thumbnailsOnly: true });
      setPhotos(data);

      // Track gallery view
      if (user?.id) {
        try {
          await supabase.from('gallery_views').upsert({
            gallery_id: galleryId,
            user_id: user.id,
            viewed_at: new Date().toISOString()
          }, { onConflict: 'gallery_id,user_id' });
        } catch (viewError) {
          // Ignore conflicts or errors to prevent log spam
        }
      }
    } catch (error) {
      setPhotos([]);
      setPhotosError('Failed to load photos.');
      console.error('Failed to load photos:', error);
    } finally {
      if (!options?.silent) {
        setPhotosLoading(false);
      }
    }
  }, [user?.id]);

  const handleUnlock = useCallback(async (overrideCode?: string) => {
    const codeToUse = typeof overrideCode === 'string' ? overrideCode : accessCode;
    
    if (!codeToUse.trim()) {
      Alert.alert('Enter Code', 'Please enter your gallery access code.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(unlockAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(unlockAnim, { toValue: 0, duration: 300, delay: 1500, useNativeDriver: true }),
    ]).start();
    const normalizedCode = codeToUse.trim().toUpperCase();
    try {
      await ClientService.tempUploads.syncByAccessCode(normalizedCode);
    } catch (syncError) {
      console.warn('Temporary upload sync failed:', syncError);
    }
    const { data, error } = await supabase
      .from('galleries')
      .select('*')
      .eq('access_code', normalizedCode)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      Alert.alert('Invalid Code', 'We could not find a gallery for that access code.');
      return;
    }

    await saveLocalUnlockedGalleryId(data.id);
    setAccessCode('');
    setGalleries((prev) => {
      if (prev.some((g) => g.id === data.id)) return prev;
      return [data, ...prev];
    });

    const isPending = data.is_locked && !data.is_paid && (data.price ?? 0) > 0;
    if (isPending) {
      setSelectedGallery(null);
    } else {
      setSelectedGallery(data);
    }

    // Refresh so the gallery appears in whichever tab is active
    setTimeout(() => {
      fetchGalleries({ silent: true });
    }, 500);

    // Add gallery to user's unlocked galleries
    if (user?.id) {
      try {
        await supabase
          .from('unlocked_galleries')
          .upsert(
            {
              user_id: user.id,
              gallery_id: data.id,
              unlocked_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,gallery_id', ignoreDuplicates: true }
          );
      } catch (error) {
        console.error('Failed to save unlocked gallery:', error);
      }
    }

    try {
      await supabase.rpc('sync_temp_uploads_for_user', { p_access_code: normalizedCode });
    } catch (unlockError) {
      console.warn('Failed to sync temp uploads:', unlockError);
    }
  }, [accessCode, unlockAnim, fetchPhotosForGallery, saveLocalUnlockedGalleryId]);

  const autoUnlockProcessed = useRef(false);

  useEffect(() => {
    const notificationAccessCode = searchParams.accessCode as string;
    const autoUnlock = searchParams.autoUnlock === 'true';

    if (notificationAccessCode && !autoUnlockProcessed.current) {
      setActiveTab('unlock');
      setAccessCode(notificationAccessCode.toUpperCase());
      
      if (autoUnlock) {
        autoUnlockProcessed.current = true; // Mark as processed so we don't loop
        const timer = setTimeout(() => {
          handleUnlock(notificationAccessCode.toUpperCase());
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [searchParams.accessCode, searchParams.autoUnlock, handleUnlock]);

  useEffect(() => {
    if (searchParams.tab === 'unlock') {
      setActiveTab('unlock');
      setSelectedGallery(null);
    }
  }, [searchParams.tab]);

  const maybeAutofillAccessCodeFromSms = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    if (accessCode.trim().length > 0) return;

    const now = Date.now();
    if (now - smsAutofillLastTriedAt.current < 15_000) return;
    smsAutofillLastTriedAt.current = now;

    try {
      const hasReadSms = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      const granted = hasReadSms
        ? PermissionsAndroid.RESULTS.GRANTED
        : await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) return;

      const found = await LocalSmsGateway.findLatestAccessCode({
        regex: '(?:use\\s*code|access\\s*code\\s*(?:is)?)[^A-Z0-9-]*([A-Z0-9-]{4,64})',
        maxMessages: 40,
      });

      const code = found?.code?.trim();
      if (!code) return;
      setAccessCode(code.toUpperCase());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
    }
  }, [accessCode]);

  const handleLikePhoto = useCallback(async (id: string, isPortfolio: boolean = false) => {
    if (isPortfolio) {
      try {
        const isLikedNow = await ClientService.portfolio.toggleLike(id);
        if (activeTab === 'portfolio') {
          const items = await ClientService.portfolio.list();
          setPortfolioItems(items);
        } else if (activeTab === 'top-rated') {
          const items = await ClientService.portfolio.listTopRated();
          setTopRatedItems(items);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        console.error('Failed to toggle portfolio like:', err);
      }
    } else {
      setLikedPhotos(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
  }, [activeTab]);

  const handleShareItem = useCallback(async (item: PortfolioItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Check if gallery is paid/unlocked
      if (selectedGallery && !selectedGallery.is_paid && selectedGallery.is_locked) {
        Alert.alert('Payment Required', 'Please unlock this gallery to share photos.');
        return;
      }

      // Share a friendly message + deep link (avoid exposing raw storage URLs)
      await Share.share({
        message: `Check out "${item.title || 'Portfolio Item'}" from ${brandName}!\n${shareAppLink}`,
        url: shareAppLink,
        title: 'Share Portfolio Item',
      });
      await ClientService.portfolio.incrementShare(item.id);
    } catch (error) {
      console.error('Failed to share portfolio item:', error);
    }
  }, [brandName, selectedGallery, shareAppLink]);

  useEffect(() => {
    if (activeTab !== 'unlock' || selectedGallery) return;
    maybeAutofillAccessCodeFromSms();
  }, [activeTab, selectedGallery, maybeAutofillAccessCodeFromSms]);

  const fetchClientId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setClientId(null);
      return null;
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
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

  const fetchGalleries = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setGalleriesLoading(true);
      setGalleriesError(null);
    }

    const activeClientId = clientId ?? (await fetchClientId());
    if (!activeClientId) {
      setGalleries([]);
      setGalleriesLoading(false);
      return;
    }

    // Fetch galleries where client_id matches
    const { data: clientGalleries, error: clientError } = await supabase
      .from('galleries')
      .select('*')
      .eq('client_id', activeClientId);

    // Fetch galleries from unlocked_galleries
    const { data: unlockedGalleries, error: unlockedError } = await supabase
      .from('unlocked_galleries')
      .select('gallery_id, galleries(*)')
      .eq('user_id', user?.id);

    const localUnlockedIds = await readLocalUnlockedGalleryIds();
    let locallyUnlockedGalleries: GalleryRow[] = [];
    if (localUnlockedIds.length > 0) {
      const { data: localData, error: localError } = await supabase
        .from('galleries')
        .select('*')
        .in('id', localUnlockedIds);
      if (localError) console.error('Error loading local unlocked galleries:', localError);
      locallyUnlockedGalleries = localData || [];
    }

    if (clientError) console.error('Error loading client galleries:', clientError);
    if (unlockedError) console.error('Error loading unlocked galleries:', unlockedError);

    // Combine both results
    const clientGals = clientGalleries || [];
    const unlockedGals = (unlockedGalleries || [])
      .map((ug: any) => ug.galleries)
      .filter(Boolean);

    const data = [...clientGals, ...unlockedGals, ...locallyUnlockedGalleries];

    if (data.length === 0) {
      setGalleries([]);
      setGalleriesLoading(false);
      return;
    }

    const uniqueGalleries = data.filter((gallery, index, self) =>
      index === self.findIndex(g => g.id === gallery.id)
    );

    uniqueGalleries.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const extractStoragePath = (url: string): string | null => {
      if (!url) return null;
      if (!url.startsWith('http')) return url;
      const match = url.match(/\/object\/(?:public|sign|authenticated)\/[^/]+\/(.+?)(?:\?|$)/);
      return match ? decodeURIComponent(match[1]) : null;
    };

    const galleryIds = uniqueGalleries.map((g) => g.id);
    const galleryThumbnailMap = new Map<string, string>();
    if (galleryIds.length > 0) {
      const { data: thumbRows, error: thumbError } = await supabase
        .from('gallery_photos')
        .select('gallery_id, thumbnail_url, created_at')
        .in('gallery_id', galleryIds)
        .not('thumbnail_url', 'is', null)
        .order('created_at', { ascending: false });
      if (thumbError) {
        console.error('Error loading gallery thumbnails:', thumbError);
      } else {
        (thumbRows || []).forEach((row: any) => {
          if (!galleryThumbnailMap.has(row.gallery_id) && row.thumbnail_url) {
            galleryThumbnailMap.set(row.gallery_id, row.thumbnail_url);
          }
        });
      }
    }

    const coverPaths = uniqueGalleries
      .map((g) => {
        const preferredCover = galleryThumbnailMap.get(g.id) || g.cover_photo_url || '';
        return { id: g.id, raw: preferredCover, path: extractStoragePath(preferredCover) };
      })
      .filter((item): item is { id: string; raw: string; path: string } => !!item.path);

    let signedCoverMap = new Map<string, string>();
    if (coverPaths.length > 0) {
      try {
        const paths = coverPaths.map(item => item.path);
        const { data: signedCovers } = await supabase.storage
          .from('client-photos')
          .createSignedUrls(paths, 3600);
        if (signedCovers) {
          signedCovers.forEach((s: any) => {
            if (s.path && s.signedUrl) signedCoverMap.set(s.path, s.signedUrl);
          });
        }
      } catch (e) {
        console.error('[Gallery] Error creating signed URLs:', e);
      }
    }

    const galleriesWithCovers = uniqueGalleries.map((gallery) => {
      const preferredCover = galleryThumbnailMap.get(gallery.id) || gallery.cover_photo_url || '';
      if (!preferredCover) return gallery;
      const path = extractStoragePath(preferredCover);
      if (path && signedCoverMap.has(path)) {
        return { ...gallery, cover_photo_url: signedCoverMap.get(path)! };
      }
      return { ...gallery, cover_photo_url: preferredCover };
    });

    setGalleries(galleriesWithCovers);
    setGalleriesLoading(false);
  }, [clientId, fetchClientId, readLocalUnlockedGalleryIds, user?.id]);

  useEffect(() => {
    if (!pathname.includes('/gallery')) return;
    fetchGalleries({ silent: true });
  }, [pathname, fetchGalleries]);

  // Sync selectedGallery when galleries update
  useEffect(() => {
    if (selectedGallery) {
      const updated = galleries.find(g => g.id === selectedGallery.id);
      if (updated && (updated.is_paid !== selectedGallery.is_paid || updated.is_locked !== selectedGallery.is_locked)) {
        setSelectedGallery(updated);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [galleries, selectedGallery]);

  const handlePayGallery = useCallback((gallery: GalleryRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPaymentGallery(gallery);
    setPaymentModalVisible(true);
  }, []);

  const handlePaymentSuccess = useCallback(() => {
    if (paymentGallery) {
      setGalleries(prev => prev.map(g => 
        g.id === paymentGallery.id ? { ...g, is_paid: true, is_locked: false } : g
      ));

      if (selectedGallery?.id === paymentGallery.id) {
        setSelectedGallery(prev => prev ? { ...prev, is_paid: true, is_locked: false } : null);
        setPhotos(prev => prev.map(p => ({ ...p, variant: 'clean' })));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [paymentGallery, selectedGallery]);

  const resolveGalleryLink = useCallback((gallery: GalleryRow) => {
    const rawLink = gallery.access_code ? `${accessCodeLink}${gallery.access_code}` : shareAppLink;
    const normalized = rawLink.startsWith('epix-visuals://') ? shareAppLink : rawLink;
    if (!normalized || normalized.includes('rork.app')) return '';
    return normalized;
  }, [accessCodeLink, shareAppLink]);

  const openAdvancedShare = useCallback((title: string, message: string, link: string) => {
    setShareSheet({ title, message, link });
  }, []);

  const downloadOnWeb = useCallback(async (sourceUrl: string, fileName: string) => {
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
      return;
    } catch {
      const anchor = document.createElement('a');
      anchor.href = sourceUrl;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  }, []);

  const handleShareChannel = useCallback(async (channel: 'system' | 'whatsapp' | 'instagram' | 'tiktok' | 'facebook' | 'x' | 'copy') => {
    if (!shareSheet) return;
    const { title, message, link } = shareSheet;
    setShareSheet(null);
    try {
      if (channel === 'copy') {
        await Clipboard.setStringAsync(link || message);
        Alert.alert('Copied', link ? 'Share link copied to clipboard.' : 'Share message copied to clipboard.');
        return;
      }
      if (channel === 'system') {
        await Share.share({ message, ...(link ? { url: link } : {}), title });
        return;
      }
      if (channel === 'whatsapp') {
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
          return;
        }
      }
      if (channel === 'instagram') {
        const instagramUrl = 'instagram://app';
        const canOpen = await Linking.canOpenURL(instagramUrl);
        if (canOpen) {
          await Linking.openURL(instagramUrl);
          await Share.share({ message, ...(link ? { url: link } : {}), title });
          return;
        }
      }
      if (channel === 'tiktok') {
        const tiktokUrl = 'snssdk1233://';
        const canOpen = await Linking.canOpenURL(tiktokUrl);
        if (canOpen) {
          await Linking.openURL(tiktokUrl);
          await Share.share({ message, ...(link ? { url: link } : {}), title });
          return;
        }
      }
      if (channel === 'facebook') {
        if (!link) {
          await Share.share({ message, title });
          return;
        }
        const facebookAppUrl = `fb://facewebmodal/f?href=${encodeURIComponent(link)}`;
        const canOpen = await Linking.canOpenURL(facebookAppUrl);
        if (canOpen) {
          await Linking.openURL(facebookAppUrl);
          return;
        }
        await Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`);
        return;
      }
      if (channel === 'x') {
        const tweet = encodeURIComponent(message);
        const xAppUrl = `twitter://post?message=${tweet}`;
        const canOpen = await Linking.canOpenURL(xAppUrl);
        if (canOpen) {
          await Linking.openURL(xAppUrl);
          return;
        }
        await Linking.openURL(`https://x.com/intent/tweet?text=${tweet}`);
        return;
      }
      await Share.share({ message, ...(link ? { url: link } : {}), title });
    } catch (error) {
      console.error('Failed to share content:', error);
    }
  }, [shareSheet]);

  const handleShareGallery = useCallback(async (gallery: GalleryRow) => {
    if (isSharingRef.current) return;
    isSharingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const link = resolveGalleryLink(gallery);
      const message = link
        ? `✨ Come relive our beautiful moments in "${gallery.name}" by ${brandName}.\nTap to view: ${link}`
        : `✨ Come relive our beautiful moments in "${gallery.name}" by ${brandName}.`;
      openAdvancedShare('Share Gallery', message, link);
    } catch (error: any) {
      if (!error?.message?.includes('share has not yet completed')) {
        console.error('Failed to share gallery:', error);
      }
    } finally {
      isSharingRef.current = false;
    }
  }, [brandName, openAdvancedShare, resolveGalleryLink]);

  const handleDownloadGallery = useCallback(async (gallery: GalleryRow) => {
    const folderPath = `${FileSystem.documentDirectory}galleries/${gallery.id}/`;
    const activePhotos =
      selectedGallery?.id === gallery.id && photos.length > 0
        ? photos
        : await ClientService.gallery.getPhotos(gallery.id);
    const sourceUrls = activePhotos
      .map((p) => p.url || p.thumbnailUrl)
      .filter((url): url is string => typeof url === 'string' && url.length > 0);

    if (sourceUrls.length === 0) {
      Alert.alert('Unavailable', 'No downloadable files available for this gallery yet.');
      return;
    }

    if (Platform.OS === 'web') {
      try {
        let downloadedCount = 0;
        for (let i = 0; i < sourceUrls.length; i++) {
          const sourceUrl = sourceUrls[i];
          const fileName = `${gallery.name.replace(/[^a-z0-9-_]/gi, '_')}-${i + 1}.jpg`;
          await downloadOnWeb(sourceUrl, fileName);
          downloadedCount++;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Downloaded', `${downloadedCount} file(s) downloaded to your device.`);
        return;
      } catch (error) {
        console.error('Failed to download files on web:', error);
      }
    }

    try {
      await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
      let savedCount = 0;
      for (let i = 0; i < sourceUrls.length; i++) {
        const sourceUrl = sourceUrls[i];
        if (!sourceUrl) continue;
        const fileName = `${gallery.name.replace(/[^a-z0-9-_]/gi, '_')}-${i + 1}.jpg`;
        const destination = `${folderPath}${fileName}`;
        try {
          await FileSystem.downloadAsync(sourceUrl, destination);
          savedCount++;
        } catch {
        }
      }

      if (savedCount > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Downloaded', `${savedCount} file(s) saved to app storage.`);
        return;
      }
    } catch {
    }

    const link = resolveGalleryLink(gallery);
    if (!link) {
      Alert.alert('Unavailable', 'Could not download files for this gallery.');
      return;
    }
    try {
      await Share.share({
        message: `Open and share this gallery on social apps:\n${link}`,
        url: link,
        title: 'Share Gallery',
      });
    } catch (error) {
      console.error('Failed to share download link:', error);
    }
  }, [downloadOnWeb, photos, resolveGalleryLink, selectedGallery?.id]);

  const handleDownloadFavorites = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Download Favorites',
      `Download ${favoritesCount} favorite photos?\n\nChoose your format:`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Web (Social)', onPress: () => Alert.alert('Downloading', 'Web-optimized photos are being prepared...') },
        { text: 'High-Res (Print)', onPress: () => Alert.alert('Downloading', 'High-resolution photos are being prepared...') },
      ]
    );
  }, [favoritesCount]);

  const handleOpenPhoto = useCallback((photo: PhotoRow) => {
    setSelectedPhotoItem(photo);
  }, []);

  const handleDownloadPhotoItem = useCallback(async (photo: PhotoRow) => {
    const sourceUrl = photo.url || photo.thumbnailUrl;
    if (!sourceUrl) {
      Alert.alert('Unavailable', 'This photo is not available for download yet.');
      return;
    }
    const folderPath = `${FileSystem.documentDirectory}photos/${selectedGallery?.id || 'gallery'}/`;
    const fileName = `${(selectedGallery?.name || 'photo').replace(/[^a-z0-9-_]/gi, '_')}-${photo.id}.jpg`;
    const destination = `${folderPath}${fileName}`;

    if (Platform.OS === 'web') {
      try {
        await downloadOnWeb(sourceUrl, fileName);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Downloaded', 'Photo downloaded to your device.');
        return;
      } catch (error) {
        console.error('Failed to download photo on web:', error);
        Alert.alert('Download Failed', 'Could not download this photo right now.');
        return;
      }
    }

    try {
      await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
      await FileSystem.downloadAsync(sourceUrl, destination);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Downloaded', 'Photo saved to app storage.');
    } catch (error) {
      console.error('Failed to download photo:', error);
      Alert.alert('Download Failed', 'Could not save this photo right now.');
    }
  }, [downloadOnWeb, selectedGallery?.id, selectedGallery?.name]);

  const handleSharePhotoItem = useCallback(async (photo: PhotoRow) => {
    if (!selectedGallery) return;
    try {
      const link = resolveGalleryLink(selectedGallery);
      const message = link
        ? `💛 I wanted to share this special moment from "${selectedGallery.name}" by ${brandName}.\nView it here: ${link}`
        : `💛 I wanted to share this special moment from "${selectedGallery.name}" by ${brandName}.`;
      openAdvancedShare('Share Photo', message, link);
    } catch (error) {
      console.error('Failed to share photo:', error);
    }
  }, [brandName, openAdvancedShare, resolveGalleryLink, selectedGallery]);

  useEffect(() => {
    fetchClientId().then(() => fetchGalleries());
  }, [fetchClientId, fetchGalleries]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const activeClientId = clientId ?? (await fetchClientId());
      if (!activeClientId || cancelled) return;

      channel = supabase
        .channel(`client-galleries-${activeClientId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'galleries', filter: `client_id=eq.${activeClientId}` },
          () => {
            if (galleriesRefreshTimerRef.current) clearTimeout(galleriesRefreshTimerRef.current);
            galleriesRefreshTimerRef.current = setTimeout(() => {
              fetchGalleries({ silent: true });
            }, 1500);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'galleries', filter: `client_id=eq.${activeClientId}` },
          () => {
            if (galleriesRefreshTimerRef.current) clearTimeout(galleriesRefreshTimerRef.current);
            galleriesRefreshTimerRef.current = setTimeout(() => {
              fetchGalleries({ silent: true });
            }, 1500);
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (galleriesRefreshTimerRef.current) {
        clearTimeout(galleriesRefreshTimerRef.current);
        galleriesRefreshTimerRef.current = null;
      }
      if (channel) supabase.removeChannel(channel);
    };
  }, [clientId, fetchClientId, fetchGalleries]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`client-unlocked-galleries-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'unlocked_galleries', filter: `user_id=eq.${user.id}` },
        () => {
          if (galleriesRefreshTimerRef.current) clearTimeout(galleriesRefreshTimerRef.current);
          galleriesRefreshTimerRef.current = setTimeout(() => {
            fetchGalleries({ silent: true });
          }, 1500);
        }
      )
      .subscribe();

    return () => {
      if (galleriesRefreshTimerRef.current) {
        clearTimeout(galleriesRefreshTimerRef.current);
        galleriesRefreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [fetchGalleries, user?.id]);

  useEffect(() => {
    setActiveAdminId(selectedGallery?.owner_admin_id ?? null);
  }, [selectedGallery?.owner_admin_id, setActiveAdminId]);

  const canViewClean = selectedGallery ? (selectedGallery.is_paid || !selectedGallery.is_locked) : false;
  const shouldProtectScreenshots = !!selectedGallery && blockScreenshots && !canViewClean;

  useEffect(() => {
    (async () => {
      try {
        if (shouldProtectScreenshots) {
          await ScreenCapture.preventScreenCaptureAsync();
        } else {
          await ScreenCapture.allowScreenCaptureAsync();
        }
      } catch {
      }
    })();
  }, [shouldProtectScreenshots]);

  useEffect(() => {
    if (!selectedGallery) {
      setPhotos([]);
      setPhotosError(null);
      setPhotosLoading(false);
      return;
    }
    fetchPhotosForGallery(selectedGallery.id);
  }, [fetchPhotosForGallery, selectedGallery]);

  useEffect(() => {
    if (!selectedGallery) return;

    const channel = supabase
      .channel(`client-photos-${selectedGallery.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gallery_photos', filter: `gallery_id=eq.${selectedGallery.id}` },
        () => {
          if (photosRefreshTimerRef.current) clearTimeout(photosRefreshTimerRef.current);
          photosRefreshTimerRef.current = setTimeout(() => {
            fetchPhotosForGallery(selectedGallery.id, { silent: true });
          }, 1500);
        }
      )
      .subscribe();

    return () => {
      if (photosRefreshTimerRef.current) {
        clearTimeout(photosRefreshTimerRef.current);
        photosRefreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [fetchPhotosForGallery, selectedGallery]);

  const myGalleries = useMemo(() => {
    const filtered = galleries.filter((g) =>
      !g.is_locked || g.is_paid || (g.price ?? 0) === 0
    );
    if (searchQuery.trim()) {
      return filtered.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
  }, [galleries, searchQuery]);

  const pendingPaymentGalleries = useMemo(
    () => galleries.filter((g) => g.is_locked && !g.is_paid && (g.price ?? 0) > 0),
    [galleries]
  );

  const hasPendingPayments = pendingPaymentGalleries.length > 0;

  const leftColumn = useMemo(() => photos.filter((_, i) => i % 2 === 0), [photos]);
  const rightColumn = useMemo(() => photos.filter((_, i) => i % 2 !== 0), [photos]);

  const unlockScale = unlockAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.2, 1],
  });

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {selectedGallery ? (
            <View style={styles.galleryDetailHeader}>
              <Pressable onPress={() => setSelectedGallery(null)} hitSlop={12}>
                <ArrowLeft size={22} color={Colors.white} />
              </Pressable>
              <View style={styles.galleryDetailTitle}>
                <Text style={styles.headerTitle} numberOfLines={1}>{selectedGallery.name}</Text>
                <Text style={styles.galleryDetailSub}>{photos.length} photos • {selectedGallery.shoot_type ?? 'Gallery'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {canViewClean && (
                  <Pressable
                    onPress={() => handleDownloadGallery(selectedGallery)}
                    hitSlop={8}
                  >
                    <Download size={20} color={Colors.gold} />
                  </Pressable>
                )}
                <Pressable onPress={() => handleShareGallery(selectedGallery)} hitSlop={8}>
                  <Share2 size={20} color={Colors.gold} />
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.headerTitle}>My Galleries</Text>
              <View style={styles.searchContainer}>
                <Search size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search my galleries..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <X size={14} color={Colors.textMuted} />
                  </Pressable>
                )}
              </View>
            </>
          )}
        </View>

        {!selectedGallery && (
          <View style={styles.tabsWrapper}>
            <View style={styles.tabsContent}>
              <Pressable
                style={[styles.tab, activeTab === 'my-galleries' && styles.tabActive]}
                onPress={() => { setActiveTab('my-galleries'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={[styles.tabText, activeTab === 'my-galleries' && styles.tabTextActive]} numberOfLines={1}>My Galleries</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'portfolio' && styles.tabActive]}
                onPress={() => { setActiveTab('portfolio'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={[styles.tabText, activeTab === 'portfolio' && styles.tabTextActive]} numberOfLines={1}>Portfolio</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'top-rated' && styles.tabActive]}
                onPress={() => { setActiveTab('top-rated'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={[styles.tabText, activeTab === 'top-rated' && styles.tabTextActive]} numberOfLines={1}>Top Rated</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'unlock' && styles.tabActive]}
                onPress={() => { setActiveTab('unlock'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={[styles.tabText, activeTab === 'unlock' && styles.tabTextActive]} numberOfLines={1}>Unlock</Text>
              </Pressable>
            </View>
          </View>
        )}

        {favoritesCount > 0 && !selectedGallery && activeTab !== 'unlock' && (
          <Pressable style={styles.favoritesBar} onPress={handleDownloadFavorites}>
            <LinearGradient
              colors={[Colors.goldMuted, 'rgba(212,175,55,0.05)']}
              style={styles.favoritesBarGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Heart size={16} color={Colors.gold} fill={Colors.gold} />
              <Text style={styles.favoritesBarText}>{favoritesCount} favorites</Text>
              <View style={styles.favoritesBarCta}>
                <ShoppingBag size={14} color={Colors.background} />
                <Text style={styles.favoritesBarCtaText}>Download Pack</Text>
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {hasPendingPayments && !selectedGallery && (
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
                  {pendingPaymentGalleries.length} galler{pendingPaymentGalleries.length === 1 ? 'y' : 'ies'} awaiting payment
                </Text>
              </View>
              <Pressable
                style={styles.paymentAlertAction}
                onPress={() => {
                  const firstPending = pendingPaymentGalleries[0];
                  if (firstPending) handlePayGallery(firstPending);
                }}
              >
                <Text style={styles.paymentAlertActionText}>Pay</Text>
                <Zap size={14} color={Colors.background} fill={Colors.background} />
              </Pressable>
            </LinearGradient>
          </View>
        )}

        {activeTab === 'unlock' && !selectedGallery && (
          <View style={styles.unlockSection}>
            <Animated.View style={[styles.unlockIcon, { transform: [{ scale: unlockScale }] }]}>
              <LinearGradient colors={[Colors.goldMuted, 'rgba(212,175,55,0.05)']} style={styles.unlockIconGradient}>
                <Lock size={32} color={Colors.gold} />
              </LinearGradient>
            </Animated.View>
            <Text style={styles.unlockTitle}>Enter Access Code</Text>
            <Text style={styles.unlockDesc}>Your photographer will send you a unique code to unlock your private gallery.</Text>
            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.codeInput}
                placeholder="Enter code (e.g., LAP-2026-XXXX)"
                placeholderTextColor={Colors.textMuted}
                value={accessCode}
                onChangeText={setAccessCode}
                autoCapitalize="characters"
                testID="access-code-input"
              />
              {accessCode.length > 0 && (
                <Pressable onPress={() => setAccessCode('')} hitSlop={8}>
                  <X size={16} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>
            <Pressable style={styles.unlockButton} onPress={() => handleUnlock()}>
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark]}
                style={styles.unlockButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Unlock size={18} color={Colors.background} />
                <Text style={styles.unlockButtonText}>Unlock Gallery</Text>
              </LinearGradient>
            </Pressable>

            {pendingPaymentGalleries.length > 0 && (
              <View style={styles.lockedList}>
                <Text style={styles.lockedListTitle}>Pending Galleries</Text>
                {pendingPaymentGalleries.map((gallery) => (
                  <Pressable key={gallery.id} style={styles.lockedItem} onPress={() => handlePayGallery(gallery)}>
                    {gallery.cover_photo_url ? (
                      <Image source={{ uri: gallery.cover_photo_url }} style={styles.lockedItemImage} />
                    ) : (
                      <LinearGradient colors={[Colors.card, Colors.cardLight]} style={styles.lockedItemImage} />
                    )}
                    <View style={styles.lockedItemInfo}>
                      <Text style={styles.lockedItemTitle}>{gallery.name}</Text>
                      <Text style={styles.lockedItemMeta}>
                        {(gallery.photo_count ?? 0) > 0 ? `${gallery.photo_count} photos • ` : ''}{gallery.shoot_type ?? 'My Gallery'}
                      </Text>
                    </View>
                    <View style={styles.payChip}>
                      <CreditCard size={12} color={Colors.background} />
                      <Text style={styles.payChipText}>KES {gallery.price?.toLocaleString()}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'my-galleries' && !selectedGallery && (
          galleriesLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator color={Colors.gold} />
            </View>
          ) : galleriesError ? (
            <View style={styles.stateContainer}>
              <Text style={styles.stateText}>{galleriesError}</Text>
            </View>
          ) : (
            <View style={styles.galleriesGrid}>
              {myGalleries.map((gallery) => (
                <Pressable
                  key={gallery.id}
                  style={styles.galleryTile}
                  onPress={() => {
                    setSelectedGallery(gallery);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  {gallery.cover_photo_url ? (
                    <Image source={{ uri: gallery.cover_photo_url }} style={styles.galleryTileImage} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={[Colors.card, Colors.cardLight]} style={styles.galleryTileImage} />
                  )}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.galleryTileOverlay} />
                  <View style={styles.galleryTileInfo}>
                    <View style={styles.galleryTileTopRow}>
                      <View style={styles.galleryTypePill}>
                        <Text style={styles.galleryTypePillText} numberOfLines={1}>{gallery.shoot_type ?? 'My Gallery'}</Text>
                      </View>
                    </View>
                    <Text style={styles.galleryTileName} numberOfLines={1}>{gallery.name}</Text>
                    <View style={styles.galleryTileMeta}>
                      <Text style={styles.galleryTileCount}>{(gallery.photo_count ?? 0) > 0 ? `${gallery.photo_count} photos` : 'Ready to view'}</Text>
                      <View style={styles.galleryTileActions}>
                        <Pressable style={styles.galleryTileActionButton} hitSlop={8} onPress={(e) => { e.stopPropagation?.(); handleShareGallery(gallery); }}>
                          <Share2 size={14} color={Colors.textSecondary} />
                        </Pressable>
                        <View style={styles.galleryTileActionButton}>
                          <Eye size={14} color={Colors.textSecondary} />
                        </View>
                        <Pressable style={styles.galleryTileActionButton} hitSlop={8} onPress={(e) => { e.stopPropagation?.(); handleDownloadGallery(gallery); }}>
                          <Download size={14} color={Colors.textSecondary} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )
        )}

        {activeTab === 'portfolio' && (
          portfolioLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator color={Colors.gold} />
            </View>
          ) : portfolioItems.length === 0 ? (
            <View style={styles.stateContainer}>
              <Text style={styles.stateText}>No portfolio items found.</Text>
            </View>
          ) : (
            <View style={styles.masonryGrid}>
              <View style={styles.masonryColumn}>
                {portfolioItems.filter((_, i) => i % 2 === 0).map((item, i) => (
                  <PortfolioCard key={item.id} item={item} index={i * 2} onLike={(id) => handleLikePhoto(id, true)} onPress={setSelectedPortfolioItem} />
                ))}
              </View>
              <View style={styles.masonryColumn}>
                {portfolioItems.filter((_, i) => i % 2 !== 0).map((item, i) => (
                  <PortfolioCard key={item.id} item={item} index={i * 2 + 1} onLike={(id) => handleLikePhoto(id, true)} onPress={setSelectedPortfolioItem} />
                ))}
              </View>
            </View>
          )
        )}

        {activeTab === 'top-rated' && !selectedGallery && (
          topRatedLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator color={Colors.gold} />
            </View>
          ) : topRatedItems.length === 0 ? (
            <View style={styles.stateContainer}>
              <Text style={styles.stateText}>No top-rated items yet.</Text>
            </View>
          ) : (
            <View>
              <View style={styles.masonryGrid}>
                <View style={styles.masonryColumn}>
                  {topRatedItems.filter((_, i) => i % 2 === 0).map((item, i) => (
                    <PortfolioCard key={item.id} item={item} index={i * 2} onLike={(id) => handleLikePhoto(id, true)} onPress={setSelectedPortfolioItem} />
                  ))}
                </View>
                <View style={styles.masonryColumn}>
                  {topRatedItems.filter((_, i) => i % 2 !== 0).map((item, i) => (
                    <PortfolioCard key={item.id} item={item} index={i * 2 + 1} onLike={(id) => handleLikePhoto(id, true)} onPress={setSelectedPortfolioItem} />
                  ))}
                </View>
              </View>
            </View>
          )
        )}

        
      </ScrollView>

      <Modal visible={!!selectedGallery} animationType="slide" onRequestClose={() => setSelectedGallery(null)}>
        <View style={styles.galleryModalContainer}>
          <SafeAreaView edges={['top']} style={styles.galleryModalHeaderSafe}>
            {selectedGallery && (
              <View style={[styles.header, { paddingTop: 6 }]}>
                <View style={styles.galleryDetailHeader}>
                  <Pressable onPress={() => setSelectedGallery(null)} hitSlop={12}>
                    <ArrowLeft size={22} color={Colors.white} />
                  </Pressable>
                  <View style={styles.galleryDetailTitle}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{selectedGallery.name}</Text>
                    <Text style={styles.galleryDetailSub}>{photos.length} photos • {selectedGallery.shoot_type ?? 'My Gallery'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {canViewClean && (
                      <Pressable onPress={() => handleDownloadGallery(selectedGallery)} hitSlop={8}>
                        <Download size={20} color={Colors.gold} />
                      </Pressable>
                    )}
                    <Pressable onPress={() => handleShareGallery(selectedGallery)} hitSlop={8}>
                      <Share2 size={20} color={Colors.gold} />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </SafeAreaView>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {photosLoading ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator color={Colors.gold} />
              </View>
            ) : photosError ? (
              <View style={styles.stateContainer}>
                <Text style={styles.stateText}>{photosError}</Text>
              </View>
            ) : (
              <View>
                <View style={styles.masonryGrid}>
                  <View style={styles.masonryColumn}>
                    {leftColumn.map((photo, i) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        index={i * 2}
                        onLike={handleLikePhoto}
                        onOpenPhoto={handleOpenPhoto}
                        isLiked={likedPhotos.has(photo.id)}
                        showWatermark={!canViewClean}
                        isBlurred={!canViewClean && (i * 2) >= 3}
                        accessCodeLink={accessCodeLink}
                        shareAppLink={shareAppLink}
                        isGalleryUnpaid={!!selectedGallery && !selectedGallery.is_paid && selectedGallery.is_locked}
                      />
                    ))}
                  </View>
                  <View style={styles.masonryColumn}>
                    {rightColumn.map((photo, i) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        index={i * 2 + 1}
                        onLike={handleLikePhoto}
                        onOpenPhoto={handleOpenPhoto}
                        isLiked={likedPhotos.has(photo.id)}
                        showWatermark={!canViewClean}
                        isBlurred={!canViewClean && (i * 2 + 1) >= 3}
                        accessCodeLink={accessCodeLink}
                        shareAppLink={shareAppLink}
                        isGalleryUnpaid={!!selectedGallery && !selectedGallery.is_paid && selectedGallery.is_locked}
                      />
                    ))}
                  </View>
                </View>

                {selectedGallery && !selectedGallery.is_paid && selectedGallery.is_locked && (
                  <View style={styles.payToUnlockContainer}>
                    <LinearGradient
                      colors={['rgba(212,175,55,0.1)', 'rgba(212,175,55,0.02)']}
                      style={styles.payToUnlockGradient}
                    >
                      <Lock size={32} color={Colors.gold} style={{ marginBottom: 12 }} />
                      <Text style={styles.payToUnlockTitle}>Unlock Full Resolution</Text>
                      <Text style={styles.payToUnlockDesc}>
                        Purchase this gallery to remove watermarks and enable high-quality downloads for all {photos.length} photos.
                      </Text>
                      <Pressable
                        style={styles.floatingPayButton}
                        onPress={() => handlePayGallery(selectedGallery)}
                      >
                        <CreditCard size={20} color={Colors.background} />
                        <Text style={styles.floatingPayButtonText}>
                          Pay KES {selectedGallery.price?.toLocaleString()}
                        </Text>
                      </Pressable>
                    </LinearGradient>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!selectedPhotoItem} transparent animationType="fade" onRequestClose={() => setSelectedPhotoItem(null)}>
        <View style={styles.photoViewerContainer}>
          {selectedPhotoItem && (
            <>
              <Image
                source={{ uri: selectedPhotoItem.url || selectedPhotoItem.thumbnailUrl }}
                style={styles.photoViewerImage}
                contentFit="contain"
              />
              <LinearGradient colors={['rgba(0,0,0,0.82)', 'transparent']} style={styles.photoViewerTopGradient}>
                <SafeAreaView edges={['top']} style={styles.photoViewerTopSafe}>
                  <View style={styles.photoViewerHeader}>
                    <Pressable onPress={() => setSelectedPhotoItem(null)} hitSlop={10} style={styles.photoViewerBack}>
                      <ArrowLeft size={22} color={Colors.white} />
                    </Pressable>
                    <View style={styles.photoViewerActions}>
                      <Pressable hitSlop={10} style={styles.photoViewerActionBtn} onPress={() => handleLikePhoto(selectedPhotoItem.id)}>
                        <Heart
                          size={18}
                          color={likedPhotos.has(selectedPhotoItem.id) ? Colors.gold : Colors.white}
                          fill={likedPhotos.has(selectedPhotoItem.id) ? Colors.gold : 'transparent'}
                        />
                      </Pressable>
                      <Pressable hitSlop={10} style={styles.photoViewerActionBtn} onPress={() => handleDownloadPhotoItem(selectedPhotoItem)}>
                        <Download size={18} color={Colors.gold} />
                      </Pressable>
                      <Pressable hitSlop={10} style={styles.photoViewerActionBtn} onPress={() => handleSharePhotoItem(selectedPhotoItem)}>
                        <Share2 size={18} color={Colors.gold} />
                      </Pressable>
                    </View>
                  </View>
                </SafeAreaView>
              </LinearGradient>
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.photoViewerBottomGradient}>
                <SafeAreaView edges={['bottom']}>
                  <View style={styles.photoViewerMetaRow}>
                    <Text style={styles.photoViewerMetaTitle} numberOfLines={1}>{selectedGallery?.name || 'Gallery'}</Text>
                    <View style={styles.photoViewerBadge}>
                      <Text style={styles.photoViewerBadgeText}>{selectedPhotoItem.variant === 'clean' ? 'High Quality' : 'Preview'}</Text>
                    </View>
                  </View>
                  <Text style={styles.photoViewerMetaHint}>
                    Tap icons to like, download to storage, or share to social apps.
                  </Text>
                </SafeAreaView>
              </LinearGradient>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={!!shareSheet} transparent animationType="fade" onRequestClose={() => setShareSheet(null)}>
        <Pressable style={styles.shareSheetBackdrop} onPress={() => setShareSheet(null)}>
          <Pressable style={styles.shareSheetCard}>
            <View style={styles.shareSheetHeader}>
              <Text style={styles.shareSheetTitle}>{shareSheet?.title || 'Share'}</Text>
              <Text style={styles.shareSheetSubtitle}>Choose where to post this content.</Text>
            </View>
            <View style={styles.shareSheetActions}>
              <Pressable style={styles.shareSheetButton} onPress={() => handleShareChannel('system')}>
                <View style={[styles.shareSheetIconWrap, { backgroundColor: 'rgba(212,175,55,0.2)' }]}>
                  <MaterialCommunityIcons name="share-variant" size={18} color={Colors.gold} />
                </View>
                <Text style={styles.shareSheetButtonText}>Share Everywhere</Text>
              </Pressable>
              <Pressable style={styles.shareSheetButton} onPress={() => handleShareChannel('whatsapp')}>
                <View style={[styles.shareSheetIconWrap, { backgroundColor: 'rgba(37,211,102,0.18)' }]}>
                  <MaterialCommunityIcons name="whatsapp" size={18} color="#25D366" />
                </View>
                <Text style={styles.shareSheetButtonText}>WhatsApp</Text>
              </Pressable>
              <Pressable style={styles.shareSheetButton} onPress={() => handleShareChannel('instagram')}>
                <View style={[styles.shareSheetIconWrap, { backgroundColor: 'rgba(225,48,108,0.18)' }]}>
                  <MaterialCommunityIcons name="instagram" size={18} color="#E1306C" />
                </View>
                <Text style={styles.shareSheetButtonText}>Instagram</Text>
              </Pressable>
              <Pressable style={styles.shareSheetButton} onPress={() => handleShareChannel('tiktok')}>
                <View style={[styles.shareSheetIconWrap, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                  <MaterialCommunityIcons name="music-note-eighth" size={18} color={Colors.white} />
                </View>
                <Text style={styles.shareSheetButtonText}>TikTok</Text>
              </Pressable>
              <Pressable style={styles.shareSheetButton} onPress={() => handleShareChannel('facebook')}>
                <View style={[styles.shareSheetIconWrap, { backgroundColor: 'rgba(24,119,242,0.2)' }]}>
                  <MaterialCommunityIcons name="facebook" size={18} color="#1877F2" />
                </View>
                <Text style={styles.shareSheetButtonText}>Facebook</Text>
              </Pressable>
              <Pressable style={styles.shareSheetButton} onPress={() => handleShareChannel('x')}>
                <View style={[styles.shareSheetIconWrap, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                  <MaterialCommunityIcons name="alpha-x" size={18} color={Colors.white} />
                </View>
                <Text style={styles.shareSheetButtonText}>X</Text>
              </Pressable>
              <Pressable style={styles.shareSheetButton} onPress={() => handleShareChannel('copy')}>
                <View style={[styles.shareSheetIconWrap, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                  <MaterialCommunityIcons name="content-copy" size={18} color={Colors.white} />
                </View>
                <Text style={styles.shareSheetButtonText}>Copy Link</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!selectedPortfolioItem} transparent animationType="fade">
        <View style={styles.portfolioModalContainer}>
          <View style={styles.portfolioModalContent}>
            <Image
              source={{ uri: selectedPortfolioItem?.image_url || selectedPortfolioItem?.media_url }}
              style={styles.portfolioModalImage}
              contentFit="contain"
            />
            {selectedPortfolioItem && (
              <LinearGradient colors={['rgba(0,0,0,0.8)', 'transparent']} style={styles.portfolioModalTopGradient}>
                <SafeAreaView edges={['top']} style={styles.portfolioModalHeaderWrapper}>
                  <View style={styles.portfolioModalHeader}>
                    <Pressable onPress={() => setSelectedPortfolioItem(null)} hitSlop={12} style={styles.portfolioModalBack}>
                      <ArrowLeft size={24} color={Colors.white} />
                    </Pressable>
                    <View style={styles.portfolioModalActions}>
                      <Pressable hitSlop={12} onPress={() => {
                        handleLikePhoto(selectedPortfolioItem.id, true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}>
                        <Heart size={24} color={Colors.white} />
                      </Pressable>
                    </View>
                  </View>
                </SafeAreaView>
              </LinearGradient>
            )}
            {selectedPortfolioItem && (
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.portfolioModalBottomGradient}>
                <SafeAreaView edges={['bottom']}>
                  <Text style={styles.portfolioModalTitle}>{selectedPortfolioItem.title}</Text>
                  {selectedPortfolioItem.category && (
                    <Text style={styles.portfolioModalCategory}>{selectedPortfolioItem.category}</Text>
                  )}
                </SafeAreaView>
              </LinearGradient>
            )}
          </View>
        </View>
      </Modal>

      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        gallery={paymentGallery}
        clientPhone={user?.user_metadata?.phone || user?.phone}
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
  galleryModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  galleryModalHeaderSafe: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 14,
  },
  stateContainer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center' as const,
  },
  galleryDetailHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
  },
  galleryDetailTitle: {
    flex: 1,
  },
  galleryDetailSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.white,
  },
  tabsWrapper: {
    flexGrow: 0,
    marginBottom: 16,
  },
  tabsContent: {
    paddingHorizontal: 6,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 8,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    shadowColor: Colors.gold,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(212,175,55,0.26)',
    borderColor: 'rgba(212,175,55,0.9)',
    shadowColor: Colors.gold,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  tabTextActive: {
    color: Colors.gold,
  },
  favoritesBar: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  favoritesBarGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  favoritesBarText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.gold,
  },
  favoritesBarCta: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  favoritesBarCtaText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  unlockSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  unlockIcon: {
    marginBottom: 20,
  },
  unlockIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  unlockTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 8,
  },
  unlockDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  codeInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    width: '100%',
    marginBottom: 16,
    gap: 8,
  },
  codeInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.white,
    letterSpacing: 1,
    textAlign: 'center' as const,
  },
  unlockButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginBottom: 32,
  },
  unlockButtonGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    gap: 10,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  lockedList: {
    width: '100%',
  },
  lockedListTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
    marginBottom: 12,
  },
  lockedItem: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockedItemImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  lockedItemInfo: {
    flex: 1,
  },
  lockedItemTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  lockedItemMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  payChip: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  payChipText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  galleriesGrid: {
    paddingHorizontal: 20,
    gap: 14,
  },
  galleryTile: {
    width: '100%',
    height: 230,
    borderRadius: 20,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    shadowColor: Colors.gold,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  galleryTileImage: {
    width: '100%',
    height: '100%',
  },
  galleryTileOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  galleryTileInfo: {
    position: 'absolute' as const,
    bottom: 14,
    left: 14,
    right: 14,
  },
  galleryTileTopRow: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  galleryTypePill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  galleryTypePillText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  galleryTileName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 6,
  },
  galleryTileMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryTileCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  galleryTileActions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  galleryTileActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  masonryGrid: {
    flexDirection: 'row' as const,
    paddingHorizontal: PADDING,
    gap: COL_GAP,
  },
  masonryColumn: {
    flex: 1,
    gap: COL_GAP,
  },
  photoCard: {
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  photoImage: {
    width: '100%',
    borderRadius: 12,
  },
  watermarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkGrid: {
    width: '100%',
    height: '100%',
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  watermarkText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 4,
    transform: [{ rotate: '-30deg' }],
  },
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedBadge: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIconButton: {
    position: 'absolute' as const,
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payToUnlockContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  payToUnlockGradient: {
    alignItems: 'center',
    padding: 30,
  },
  payToUnlockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 8,
  },
  payToUnlockDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  floatingPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 10,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingPayButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  unpaidPhotosBar: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  unpaidPhotosBarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  unpaidPhotosBarText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  unpaidPhotosBarCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ef4444',
    borderRadius: 20,
  },
  unpaidPhotosBarCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  paymentAlert: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  paymentAlertGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  paymentAlertIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
  },
  paymentAlertContent: {
    flex: 1,
  },
  paymentAlertTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 2,
  },
  paymentAlertDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  paymentAlertAction: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  paymentAlertActionText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: Colors.background,
  },
  photoViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
  },
  photoViewerImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  photoViewerTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 130,
  },
  photoViewerTopSafe: {
    flex: 1,
  },
  photoViewerHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  photoViewerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoViewerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
  },
  photoViewerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoViewerBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 18,
  },
  photoViewerMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  photoViewerMetaTitle: {
    flex: 1,
    color: Colors.white,
    fontSize: 20,
    fontWeight: '700' as const,
  },
  photoViewerBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.6)',
    backgroundColor: 'rgba(212,175,55,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  photoViewerBadgeText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  photoViewerMetaHint: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  shareSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  shareSheetCard: {
    borderRadius: 22,
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.24)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 14,
  },
  shareSheetHeader: {
    gap: 4,
  },
  shareSheetTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  shareSheetSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  shareSheetActions: {
    gap: 10,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
  },
  shareSheetButton: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
    width: '48.5%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  shareSheetIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareSheetButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  portfolioModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  portfolioModalContent: {
    flex: 1,
  },
  portfolioModalImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  portfolioModalTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 10,
  },
  portfolioModalHeaderWrapper: {
    flex: 1,
  },
  portfolioModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  portfolioModalBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioModalActions: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  portfolioModalBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingTop: 60,
  },
  portfolioModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 8,
  },
  portfolioModalCategory: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
