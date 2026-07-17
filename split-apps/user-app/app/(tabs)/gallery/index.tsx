import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated as RNAnimated, Dimensions, Alert, Share, ActivityIndicator, Platform, Linking, Modal, AppState, AppStateStatus, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  try {
    FileSystem = require('expo-file-system');
  } catch (e) {
    // FileSystem not available
  }
}
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Unlock, Search, Heart, Download, Eye, X, Share2, ShoppingBag, ArrowLeft, CreditCard, Zap } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ScreenCapture from 'expo-screen-capture';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { ClientService, type Photo as ClientPhoto, type PortfolioItem } from '@/services/client';
import { useBranding } from '@/contexts/BrandingContext';
import { useAuth } from '@/contexts/AuthContext';
import { demoGalleries } from '@/lib/demo';
import { downloadAndCompress } from '@/lib/network-compression';
import PaymentModal from '@/components/PaymentModal';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { galleryTabPressRef } from '../_layout';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

import { FlashList } from '@shopify/flash-list';
import { useAssignmentStatus } from '@/hooks/useAssignmentStatus';
import UnassignedEmptyState from '@/components/UnassignedEmptyState';

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

function PhotoCard({ photo, index, onLike, onOpenPhoto, isLiked, showWatermark, isBlurred, accessCodeLink, shareAppLink, isGalleryUnpaid, selectMode, isSelected, onToggleSelect }: { photo: PhotoRow; index: number; onLike: (id: string) => void; onOpenPhoto: (photo: PhotoRow) => void; isLiked: boolean; showWatermark: boolean; isBlurred?: boolean; accessCodeLink: string; shareAppLink: string; isGalleryUnpaid?: boolean, selectMode?: boolean, isSelected?: boolean, onToggleSelect?: (id: string) => void }) {
  const {
    brandName,
    watermarkText,
    watermarkOpacity,
    watermarkRotation,
    watermarkSize,
    watermarkPosition,
  } = useBranding();
  const heartScale = useRef(new RNAnimated.Value(0)).current;
  const cardFade = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(cardFade, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }).start();
  }, [cardFade, index]);

  const handleLongPress = useCallback(() => {
    if (selectMode) return;
    if (isGalleryUnpaid) {
      Alert.alert('Payment Required', 'Please unlock this gallery to view photos without watermarks.');
      return;
    }
    onLike(photo.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    RNAnimated.sequence([
      RNAnimated.spring(heartScale, { toValue: 1, friction: 3, useNativeDriver: true }),
      RNAnimated.timing(heartScale, { toValue: 0, duration: 600, delay: 400, useNativeDriver: true }),
    ]).start();
  }, [heartScale, onLike, photo.id, isGalleryUnpaid, selectMode]);

  const handleOpen = useCallback(() => {
    if (selectMode && onToggleSelect) {
      onToggleSelect(photo.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    onOpenPhoto(photo);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onOpenPhoto, photo, selectMode, onToggleSelect]);

  const handleShare = useCallback(async () => {
    if (selectMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { data: galleryData } = await supabase
        .from('galleries')
        .select('is_paid, is_locked, access_code')
        .eq('id', photo.gallery_id)
        .maybeSingle();
      
      if (galleryData && !galleryData.is_paid && galleryData.is_locked) {
        Alert.alert('Payment Required', 'Please unlock this gallery to share photos.');
        return;
      }

      const link = galleryData?.access_code ? `${accessCodeLink}${galleryData.access_code}` : shareAppLink;
      await Share.share({
        message: `Check out this photo from ${brandName}!\nPhoto Link: ${shareAppLink}\nGallery Link: ${link}`,
        url: shareAppLink,
        title: 'Share Photo',
      });
    } catch (error) {
      console.error('Failed to share photo:', error);
    }
  }, [brandName, photo.url, photo.gallery_id, accessCodeLink, shareAppLink, selectMode]);

  const aspectRatio = (photo.width ?? 1) / (photo.height ?? 1);
  const imageHeight = COL_WIDTH / aspectRatio;
  const opacity = Math.max(0, Math.min(100, watermarkOpacity)) / 100;
  const displayText = (watermarkText || '').trim();
  const fontSize = watermarkSize === 'small' ? 12 : watermarkSize === 'large' ? 22 : 16;
  const rotation = `${-1 * watermarkRotation}deg`;
  const heavyOpacity = isGalleryUnpaid ? Math.max(0.8, opacity) : opacity;
  const shouldShowWatermark = showWatermark && photo.variant === 'watermarked' && heavyOpacity > 0 && displayText.length > 0;

  const randomPoints = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < photo.id.length; i++) hash = (hash * 31 + photo.id.charCodeAt(i)) >>> 0;
    const next = () => { hash = (hash * 1664525 + 1013904223) >>> 0; return hash / 0xffffffff; };
    return [
      { top: 10 + next() * 25, left: 5 + next() * 55 },
      { top: 40 + next() * 25, left: 25 + next() * 55 },
      { top: 65 + next() * 20, left: 10 + next() * 70 },
      { top: 20 + next() * 60, left: 60 + next() * 25 },
    ];
  }, [photo.id]);

  return (
    <RNAnimated.View style={[styles.photoCard, { opacity: cardFade, transform: [{ scale: isSelected ? 0.95 : 1 }] }]}>
      <Pressable onPress={handleOpen} onLongPress={handleLongPress}>
        <Image
          source={{ uri: photo.thumbnailUrl || photo.url }}
          style={[styles.photoImage, { height: imageHeight, backgroundColor: Colors.cardLight }, isBlurred && { opacity: 0.7 }, isSelected && { opacity: 0.6 }]}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={300}
          priority={index < 10 ? "high" : "low" }
          blurRadius={isBlurred ? 15 : 0}
        />
        {isBlurred && (
          <View style={styles.blurOverlay}>
            <Lock size={20} color={Colors.white} />
          </View>
        )}
        
        {selectMode && (
          <View style={[styles.selectIndicator, isSelected && styles.selectIndicatorActive]}>
             {isSelected && <View style={styles.selectIndicatorInner} />}
          </View>
        )}
        
        {shouldShowWatermark && (
          <View style={styles.watermarkOverlay} pointerEvents="none">
            {watermarkPosition === 'grid' ? (
              <View style={styles.watermarkGrid}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <Text key={`${photo.id}-wm-${i}`} style={[styles.watermarkText, { color: `rgba(255,255,255,${heavyOpacity * 0.55})`, fontSize, transform: [{ rotate: rotation }] }]}>
                    {displayText}
                  </Text>
                ))}
              </View>
            ) : watermarkPosition === 'randomized' ? (
              <View style={StyleSheet.absoluteFillObject}>
                {randomPoints.map((p, i) => (
                  <Text key={`${photo.id}-wm-r-${i}`} style={[styles.watermarkText, { position: 'absolute', top: `${p.top}%`, left: `${p.left}%`, color: `rgba(255,255,255,${heavyOpacity * 0.55})`, fontSize, transform: [{ rotate: rotation }] }]}>
                    {displayText}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={[styles.watermarkText, { color: `rgba(255,255,255,${heavyOpacity * 0.55})`, fontSize, transform: [{ rotate: rotation }] }]}>
                {displayText}
              </Text>
            )}
          </View>
        )}
        <RNAnimated.View style={[styles.heartOverlay, { transform: [{ scale: heartScale }], opacity: heartScale }]}>
          <Heart size={40} color={Colors.gold} fill={Colors.gold} />
        </RNAnimated.View>
        {isLiked && !selectMode && (
          <View style={styles.likedBadge}>
            <Heart size={12} color={Colors.gold} fill={Colors.gold} />
          </View>
        )}
        {!selectMode && (
          <Pressable style={styles.shareIconButton} onPress={handleShare} hitSlop={8}>
            <Share2 size={12} color={Colors.white} />
          </Pressable>
        )}
      </Pressable>
    </RNAnimated.View>
  );
}

function PortfolioCard({ item, index, onLike, onPress }: { item: PortfolioItem; index: number; onLike: (id: string, isPortfolio: boolean) => void; onPress: (item: PortfolioItem) => void }) {
  const cardFade = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(cardFade, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }).start();
  }, [cardFade, index]);

  const handlePress = useCallback(() => {
    onPress(item);
  }, [onPress, item]);

  const adminProfile = (item as any).user_profiles as { id: string; name: string; avatar_url: string | null } | null;

  return (
    <RNAnimated.View style={[styles.photoCard, { opacity: cardFade, marginBottom: 12 }]}>
      <Pressable onPress={handlePress}>
        <Image source={{ uri: item.image_url || item.media_url }} style={[styles.photoImage, { height: COL_WIDTH * 1.5 }]} contentFit="cover" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.galleryTileOverlay} />
        <View style={{ position: 'absolute', bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }} numberOfLines={2}>{item.title}</Text>
          {/* Admin attribution */}
          {adminProfile && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
              {adminProfile.avatar_url ? (
                <Image
                  source={{ uri: adminProfile.avatar_url }}
                  style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)' }}
                  contentFit="cover"
                />
              ) : (
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(212,175,55,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 8, color: '#D4AF37', fontWeight: '700' }}>
                    {(adminProfile.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }} numberOfLines={1}>
                {adminProfile.name || 'Photographer'}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 14 }}>
            <Pressable hitSlop={12} onPress={() => onLike(item.id, true)}>
              <Heart size={16} color={Colors.white} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </RNAnimated.View>
  );
}

function FluidPhotoViewer({ photo, onClose, onLike, onDownload, onShare, isLiked, galleryName }: {
  photo: PhotoRow;
  onClose: () => void;
  onLike: (id: string) => void;
  onDownload: (photo: PhotoRow) => void;
  onShare: () => void;
  isLiked: boolean;
  galleryName: string;
}) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onChange((event) => {
      translateY.value = event.translationY;
      scale.value = Math.max(0.6, 1 - Math.abs(event.translationY) / 500);
    })
    .onEnd((event) => {
      if (Math.abs(event.translationY) > 150 || Math.abs(event.velocityY) > 1000) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: scale.value
  }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'black' }, backdropStyle]} />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, animatedStyle]}>
          <Image
            source={{ uri: photo.url || photo.thumbnailUrl }}
            style={styles.photoViewerImage}
            contentFit="contain"
          />
          <LinearGradient colors={['rgba(0,0,0,0.82)', 'transparent']} style={styles.photoViewerTopGradient}>
            <SafeAreaView edges={['top']} style={styles.photoViewerTopSafe}>
              <View style={styles.photoViewerHeader}>
                <Pressable onPress={onClose} hitSlop={10} style={styles.photoViewerBack}>
                  <ArrowLeft size={22} color={Colors.white} />
                </Pressable>
                <View style={styles.photoViewerActions}>
                  <Pressable hitSlop={10} style={styles.photoViewerActionBtn} onPress={() => onLike(photo.id)}>
                    <Heart
                      size={18}
                      color={isLiked ? Colors.gold : Colors.white}
                      fill={isLiked ? Colors.gold : 'transparent'}
                    />
                  </Pressable>
                  <Pressable hitSlop={10} style={styles.photoViewerActionBtn} onPress={() => onDownload(photo)}>
                    <Download size={18} color={Colors.gold} />
                  </Pressable>
                  <Pressable hitSlop={10} style={styles.photoViewerActionBtn} onPress={onShare}>
                    <Share2 size={18} color={Colors.gold} />
                  </Pressable>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.photoViewerBottomGradient}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.photoViewerMetaRow}>
                <Text style={styles.photoViewerMetaTitle} numberOfLines={1}>{galleryName}</Text>
                <View style={styles.photoViewerBadge}>
                  <Text style={styles.photoViewerBadgeText}>{photo.variant === 'clean' ? 'High Quality' : 'Preview'}</Text>
                </View>
              </View>
              <Text style={styles.photoViewerMetaHint}>
                Tap icons to like, download to storage, or share to social apps. Swipe up or down to dismiss.
              </Text>
            </SafeAreaView>
          </LinearGradient>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isDemoMode } = useAuth();
  const { isAssigned, loading: assignmentLoading } = useAssignmentStatus();
  const { brandName, blockScreenshots, setActiveAdminId, accessCodeLink, shareAppLink, galleryShareLink } = useBranding();
  const pathname = usePathname();
  const searchParams = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('my-galleries');
  const [accessCode, setAccessCode] = useState<string>((searchParams.accessCode as string) || '');

  // Rate limiting for gallery unlock attempts (brute-force protection)
  const unlockAttemptsRef = useRef<{ count: number; lastAttempt: number; blockedUntil: number }>({
    count: 0,
    lastAttempt: 0,
    blockedUntil: 0,
  });
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 60 * 1000; // 1 minute lockout after max attempts
  const [selectedGallery, setSelectedGallery] = useState<GalleryRowWithCounts | null>(null);
  const [likedPhotos, setLikedPhotos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const unlockAnim = useRef(new RNAnimated.Value(0)).current;
  const photosRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const galleriesRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSharingRef = useRef(false);
  const [clientIds, setClientIds] = useState<string[]>([]);
  // Keep a stable ref so fetchGalleries can read clientIds without being in its dep array
  const clientIdsRef = useRef<string[]>([]);
  // Stable refs for callbacks to break dependency chains
  const fetchGalleriesRef = useRef<any>(null);
  const fetchAllClientIdsRef = useRef<any>(null);
  const [galleries, setGalleries] = useState<GalleryRowWithCounts[]>([]);
  const [galleriesLoading, setGalleriesLoading] = useState(true);
  const [galleriesError, setGalleriesError] = useState<string | null>(null);
  const [realUnpaidGalleries, setRealUnpaidGalleries] = useState<GalleryRow[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentGallery, setPaymentGallery] = useState<GalleryRowWithCounts | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioCategory, setPortfolioCategory] = useState<string>('All');
  const [topRatedItems, setTopRatedItems] = useState<PortfolioItem[]>([]);
  const [topRatedLoading, setTopRatedLoading] = useState(false);
  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState<PortfolioItem | null>(null);
  const [portfolioPackages, setPortfolioPackages] = useState<any[]>([]);
  const [selectedPhotoItem, setSelectedPhotoItem] = useState<PhotoRow | null>(null);
  const [shareSheet, setShareSheet] = useState<ShareSheetPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Phase 3 additions:
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Close gallery modal when the gallery tab is pressed while already on it
  const lastTabPressCount = useRef(galleryTabPressRef.current);
  useEffect(() => {
    const interval = setInterval(() => {
      if (galleryTabPressRef.current !== lastTabPressCount.current) {
        lastTabPressCount.current = galleryTabPressRef.current;
        if (selectedGallery) {
          setSelectedGallery(null);
          setSelectMode(false);
          setSelectedPhotoIds(new Set());
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedGallery]);

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

      // Fetch active packages for "Book This" CTA
      supabase.from('packages')
        .select('id, name, price, category, cover_image_url, owner_admin_id')
        .eq('is_active', true)
        .then(({ data }) => setPortfolioPackages(data || []))
        .catch(console.error);
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
      if (user?.id && !isDemoMode) {
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
  }, [isDemoMode, user?.id]);

  const handleUnlock = useCallback(async (overrideCode?: string) => {
    // Rate limiting check
    const now = Date.now();
    const attempts = unlockAttemptsRef.current;
    if (now < attempts.blockedUntil) {
      const waitSec = Math.ceil((attempts.blockedUntil - now) / 1000);
      Alert.alert('Too Many Attempts', `Please wait ${waitSec} seconds before trying again.`);
      return;
    }

    const codeToUse = typeof overrideCode === 'string' ? overrideCode : accessCode;
    
    if (!codeToUse.trim()) {
      Alert.alert('Enter Code', 'Please enter your gallery access code.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    RNAnimated.sequence([
        RNAnimated.timing(unlockAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        RNAnimated.timing(unlockAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    const normalizedCode = codeToUse.trim().toUpperCase();
    if (isDemoMode) {
      const matchedGallery = demoGalleries.find((gallery) => gallery.access_code === normalizedCode);
      if (!matchedGallery) {
        Alert.alert('Invalid Code', 'We could not find a demo gallery for that access code.');
        return;
      }
      await saveLocalUnlockedGalleryId(matchedGallery.id);
      setAccessCode('');
      setGalleries((prev) => {
        if (prev.some((g) => g.id === matchedGallery.id)) return prev;
        return [matchedGallery, ...prev];
      });
      setSelectedGallery(matchedGallery);
      return;
    }

    try {
      await ClientService.tempUploads.syncByAccessCode(normalizedCode);
    } catch (syncError) {
      console.warn('Temporary upload sync failed:', syncError);
    }

    // Use the server-side function that finds the gallery AND links the client
    // row to this user if it was pre-created by phone (no user_id yet).
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
      'unlock_gallery_and_link',
      { p_access_code: normalizedCode }
    );

    if (rpcError || !rpcResult?.success) {
      // Track failed attempt for rate limiting
      attempts.count++;
      attempts.lastAttempt = now;
      if (attempts.count >= MAX_ATTEMPTS) {
        attempts.blockedUntil = now + LOCKOUT_DURATION;
        attempts.count = 0;
        Alert.alert('Too Many Failed Attempts', 'Please wait 1 minute before trying again.');
        return;
      }

      // Fallback: direct gallery lookup (works if user already has a client row)
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('galleries')
        .select('*')
        .eq('access_code', normalizedCode)
        .limit(1)
        .maybeSingle();

      if (fallbackError || !fallbackData) {
        // Track failed attempt for rate limiting
        attempts.count++;
        attempts.lastAttempt = now;
        if (attempts.count >= MAX_ATTEMPTS) {
          attempts.blockedUntil = now + LOCKOUT_DURATION;
          attempts.count = 0;
          Alert.alert('Too Many Failed Attempts', 'Please wait 1 minute before trying again.');
          return;
        }
        Alert.alert('Invalid Code', 'We could not find a gallery for that access code.');
        return;
      }

      await saveLocalUnlockedGalleryId(fallbackData.id);
      setAccessCode('');
      setGalleries((prev) => {
        if (prev.some((g) => g.id === fallbackData.id)) return prev;
        return [fallbackData, ...prev];
      });
      const isPendingFallback = fallbackData.is_locked && !fallbackData.is_paid && (fallbackData.price ?? 0) > 0;
      setSelectedGallery(isPendingFallback ? null : fallbackData);
      setTimeout(() => { fetchGalleries({ silent: true }); }, 500);
      return;
    }

    // RPC succeeded — reset rate limiting and fetch the full gallery row
    attempts.count = 0;
    attempts.blockedUntil = 0;

    const { data, error } = await supabase
      .from('galleries')
      .select('*')
      .eq('id', rpcResult.gallery_id)
      .single();

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
  }, [accessCode, fetchPhotosForGallery, isDemoMode, saveLocalUnlockedGalleryId, unlockAnim]);

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

  const handleLikePhoto = useCallback(async (id: string, isPortfolio: boolean = false) => {
    if (isPortfolio) {
      try {
        await ClientService.portfolio.toggleLike(id);
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

  const fetchAllClientIds = useCallback(async () => {
    if (isDemoMode) {
      setClientIds(['demo-client']);
      clientIdsRef.current = ['demo-client'];
      return ['demo-client'];
    }
    let user: any = null;
    try {
      const result = await supabase.auth.getUser();
      user = result.data?.user;
    } catch {
      setClientIds([]);
      return [];
    }
    if (!user) {
      setClientIds([]);
      return [];
    }

    const { data, error } = await supabase
      .from('clients')
      .select('id, owner_admin_id, user_profiles:owner_admin_id(name)')
      .eq('user_id', user.id);

    if (error) {
      setClientIds([]);
      return [];
    }

    const ids = (data || []).map((r: any) => r.id).filter(Boolean);
    setClientIds(ids);
    clientIdsRef.current = ids;

    // Build admin name map for filter dropdown
    const nameMap: Record<string, string> = {};
    (data || []).forEach((r: any) => {
      if (r.owner_admin_id && r.user_profiles) {
        nameMap[r.owner_admin_id] = (r.user_profiles as any)?.name || 'Photographer';
      }
    });
    setAdminNames(nameMap);

    return ids;
  }, [isDemoMode]);

  const fetchGalleries = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setGalleriesLoading(true);
      setGalleriesError(null);
    }

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
          console.error('[Gallery] Error fetching real unpaid galleries:', e);
        }
      }
      setGalleries(demoGalleries);
      setGalleriesLoading(false);
      return;
    }

    // Don't query until we have a user — avoids client_id=eq.undefined 400 errors
    if (!user?.id) {
      setGalleries([]);
      setGalleriesLoading(false);
      return;
    }

    const activeClientIds = clientIdsRef.current.length > 0 ? clientIdsRef.current : (await fetchAllClientIds());

    let clientGalleries: any[] = [];
    let clientError: any = null;

    if (activeClientIds.length > 0) {
      const result = await supabase
        .from('galleries')
        .select('*')
        .in('client_id', activeClientIds);
      clientGalleries = result.data || [];
      clientError = result.error;
    } else {
      // Fallback: join through clients table to find galleries for this user
      const result = await supabase
        .from('galleries')
        .select('*, clients!inner(user_id)')
        .eq('clients.user_id', user.id);
      clientGalleries = (result.data || []).map((g: any) => {
        const { clients, ...rest } = g;
        return rest;
      });
      clientError = result.error;
    }

    // Fetch galleries from unlocked_galleries — only when user?.id is available
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
      if (!url.startsWith('http')) {
        // Raw storage path like "client-photos/filename.jpg" — strip bucket prefix
        const parts = url.split('/');
        if (parts.length > 1) return parts.slice(1).join('/');
        return url;
      }
      const match = url.match(/\/object\/(?:public|sign|authenticated)\/[^/]+\/(.+?)(?:\?|$)/);
      return match ? decodeURIComponent(match[1]) : null;
    };

    const galleryIds = uniqueGalleries.map((g) => g.id);
    const galleryThumbnailMap = new Map<string, string>();
    const photoCountMap = new Map<string, number>();
    if (galleryIds.length > 0) {
      const [thumbResult, countResult] = await Promise.all([
        supabase
          .from('gallery_photos')
          .select('gallery_id, photo_url, created_at')
          .in('gallery_id', galleryIds)
          .not('photo_url', 'is', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('gallery_photos')
          .select('gallery_id')
          .in('gallery_id', galleryIds),
      ]);

      if (thumbResult.error) {
        console.error('Error loading gallery thumbnails:', thumbResult.error);
      } else {
        (thumbResult.data || []).forEach((row: any) => {
          if (!galleryThumbnailMap.has(row.gallery_id) && row.photo_url) {
            galleryThumbnailMap.set(row.gallery_id, row.photo_url);
          }
        });
      }

      if (!countResult.error && countResult.data) {
        (countResult.data as any[]).forEach((row: any) => {
          photoCountMap.set(row.gallery_id, (photoCountMap.get(row.gallery_id) || 0) + 1);
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
      let coverUrl = preferredCover;
      if (preferredCover) {
        const path = extractStoragePath(preferredCover);
        if (path && signedCoverMap.has(path)) {
          coverUrl = signedCoverMap.get(path)!;
        } else if (!preferredCover.startsWith('http')) {
          const { data } = supabase.storage.from('client-photos').getPublicUrl(preferredCover);
          if (data?.publicUrl) coverUrl = data.publicUrl;
        }
      }
      return { ...gallery, cover_photo_url: coverUrl, photo_count: photoCountMap.get(gallery.id) ?? 0 };
    });

    setGalleries(galleriesWithCovers);
    setGalleriesLoading(false);
  }, [isDemoMode, readLocalUnlockedGalleryIds, user?.id]);

  // Keep refs current so effects can call without depending on identity
  fetchGalleriesRef.current = fetchGalleries;
  fetchAllClientIdsRef.current = fetchAllClientIds;

  const trackGalleryView = useCallback(async (galleryId: string, clientId: string) => {
    if (isDemoMode || !user?.id) return;
    try {
      await supabase.from('gallery_views').upsert({
        gallery_id: galleryId,
        user_id: user.id,
      }, { onConflict: 'gallery_id,user_id' });
      await supabase.rpc('update_delivery_status', {
        p_gallery_id: galleryId, p_client_id: clientId, p_field: 'gallery_viewed', p_value: true
      });
    } catch (e) {
      console.warn('Failed to track gallery view:', e);
    }
  }, [isDemoMode, user?.id]);

  useEffect(() => {
    if (!pathname.includes('/gallery')) return;
    if (!isDemoMode && !user?.id) return;
    fetchGalleriesRef.current?.({ silent: true });
  }, [pathname, isDemoMode, user?.id]);

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
    const baseGalleryLink = galleryShareLink || shareAppLink;
    const rawLink = gallery.access_code ? `${accessCodeLink}${gallery.access_code}` : baseGalleryLink;
    const normalized = rawLink.startsWith('epix-visuals://') ? baseGalleryLink : rawLink;
    if (!normalized) return '';
    return normalized;
  }, [accessCodeLink, galleryShareLink, shareAppLink]);

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
    if (!FileSystem) {
      Alert.alert('Unavailable', 'Downloads are not available on this platform.');
      return;
    }
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
          await downloadAndCompress(sourceUrl, destination);
          savedCount++;
        } catch (downloadErr) {
          console.warn('[Gallery] Download failed for', fileName, downloadErr);
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

  const handleDownloadFavorites = useCallback(async () => {
    if (favoritesCount === 0) {
      Alert.alert('No Favorites', 'You haven\'t favorited any photos yet. Double-tap a photo to like it.');
      return;
    }
    if (!FileSystem) {
      Alert.alert('Unavailable', 'Downloads are not available on this platform.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Gather all liked photos from current gallery
    const likedPhotosList = photos.filter(p => likedPhotos.has(p.id));
    if (likedPhotosList.length === 0) {
      Alert.alert('No Favorites', 'Your favorited photos from this gallery will appear here.');
      return;
    }

    const sourceUrls = likedPhotosList
      .map(p => p.url || p.thumbnailUrl)
      .filter((url): url is string => !!url);

    if (sourceUrls.length === 0) {
      Alert.alert('Unavailable', 'No downloadable files available for your favorites.');
      return;
    }

    if (Platform.OS === 'web') {
      try {
        let downloadedCount = 0;
        for (let i = 0; i < sourceUrls.length; i++) {
          await downloadOnWeb(sourceUrls[i], `favorite-${i + 1}.jpg`);
          downloadedCount++;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Downloaded', `${downloadedCount} favorite photo(s) downloaded.`);
      } catch (error) {
        console.error('Failed to download favorites on web:', error);
        Alert.alert('Download Failed', 'Could not download favorites right now.');
      }
      return;
    }

    try {
      const folderPath = `${FileSystem.documentDirectory}favorites/`;
      await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
      let savedCount = 0;
      for (let i = 0; i < sourceUrls.length; i++) {
        const dest = `${folderPath}favorite-${Date.now()}-${i}.jpg`;
        try {
          await downloadAndCompress(sourceUrls[i], dest);
          savedCount++;
        } catch (e) {
          console.warn('[Favorites] Download failed for', i, e);
        }
      }
      if (savedCount > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Downloaded', `${savedCount} favorite photo(s) saved to app storage.`);
      } else {
        Alert.alert('Download Failed', 'Could not save favorites right now.');
      }
    } catch (error) {
      console.error('Failed to download favorites:', error);
      Alert.alert('Download Failed', 'Could not save favorites right now.');
    }
  }, [favoritesCount, photos, likedPhotos, downloadOnWeb]);

  const handleOpenPhoto = useCallback((photo: PhotoRow) => {
    setSelectedPhotoItem(photo);
  }, []);

  const handleDownloadPhotoItem = useCallback(async (photo: PhotoRow) => {
    // Resolve the correct download URL via RPC:
    //   - If photographer allows original downloads → original file
    //   - Otherwise → optimized 5MB version (max 1920px, high quality)
    let resolvedUrl: string | null = null;

    if (photo.id && !isDemoMode) {
      try {
        const { data, error } = await supabase.rpc('get_photo_download_url' as any, {
          p_photo_id: photo.id,
        }) as any;
        if (!error && data?.success && data?.url) {
          resolvedUrl = data.url;
        }
      } catch (rpcErr) {
        console.warn('[Download] RPC failed, falling back to stored URL:', rpcErr);
      }
    }

    // Fall back to stored URL if RPC failed or in demo mode
    const sourceUrl = resolvedUrl || photo.url || photo.thumbnailUrl;
    if (!sourceUrl) {
      Alert.alert('Unavailable', 'This photo is not available for download yet.');
      return;
    }

    // Generate signed URL if it's a storage path (not a full https URL)
    let downloadUrl = sourceUrl;
    if (sourceUrl && !sourceUrl.startsWith('http')) {
      const { data: signedData } = await supabase.storage
        .from('client-photos')
        .createSignedUrl(sourceUrl, 3600);
      if (signedData?.signedUrl) {
        downloadUrl = signedData.signedUrl;
      }
    }

    if (!FileSystem) {
      Alert.alert('Unavailable', 'Downloads are not available on this platform.');
      return;
    }

    const folderPath = `${FileSystem.documentDirectory}photos/${selectedGallery?.id || 'gallery'}/`;
    const fileName = `${(selectedGallery?.name || 'photo').replace(/[^a-z0-9-_]/gi, '_')}-${photo.id}.jpg`;
    const destination = `${folderPath}${fileName}`;

    if (Platform.OS === 'web') {
      try {
        await downloadOnWeb(downloadUrl, fileName);
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
      await downloadAndCompress(downloadUrl, destination);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Downloaded', 'Photo saved to app storage.');
    } catch (error) {
      console.error('Failed to download photo:', error);
      Alert.alert('Download Failed', 'Could not save this photo right now.');
    }
  }, [downloadOnWeb, isDemoMode, selectedGallery?.id, selectedGallery?.name]);

  const handleSharePhotoItem = useCallback(async () => {
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
    if (!isDemoMode && !user?.id) return;
    fetchAllClientIdsRef.current?.().then(() => fetchGalleriesRef.current?.());
  }, [isDemoMode, user?.id]);

  // Fix 12: Refresh signed URLs when app returns to foreground (they expire after 1 hour)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        fetchGalleriesRef.current?.({ silent: true });
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const activeClientIds = clientIdsRef.current.length > 0 ? clientIdsRef.current : (await fetchAllClientIdsRef.current?.());
      if (!activeClientIds || activeClientIds.length === 0 || cancelled) return;

      channel = supabase
        .channel(`client-galleries-multi-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'galleries' },
          (payload: any) => {
            if (activeClientIds.includes(payload.new?.client_id)) {
              if (galleriesRefreshTimerRef.current) clearTimeout(galleriesRefreshTimerRef.current);
              galleriesRefreshTimerRef.current = setTimeout(() => {
                fetchGalleriesRef.current?.({ silent: true });
              }, 1500);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'galleries' },
          (payload: any) => {
            if (activeClientIds.includes(payload.new?.client_id)) {
              if (galleriesRefreshTimerRef.current) clearTimeout(galleriesRefreshTimerRef.current);
              galleriesRefreshTimerRef.current = setTimeout(() => {
                fetchGalleriesRef.current?.({ silent: true });
              }, 1500);
            }
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
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`client-unlocked-galleries-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'unlocked_galleries', filter: `user_id=eq.${user.id}` },
        () => {
          if (galleriesRefreshTimerRef.current) clearTimeout(galleriesRefreshTimerRef.current);
          galleriesRefreshTimerRef.current = setTimeout(() => {
            fetchGalleriesRef.current?.({ silent: true });
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
  }, [isDemoMode, user?.id]);

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
      .channel(`client-photos-${selectedGallery.id}-${Date.now()}`)
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
    let filtered = galleries.filter((g) =>
      !g.is_locked || g.is_paid || (g.price ?? 0) === 0
    );
    // Filter by selected admin (multi-admin support)
    if (selectedAdminId) {
      filtered = filtered.filter((g) => (g as any).owner_admin_id === selectedAdminId);
    }
    if (searchQuery.trim()) {
      return filtered.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
  }, [galleries, searchQuery, selectedAdminId]);

  const pendingPaymentGalleries = useMemo(
    () => isDemoMode
      ? realUnpaidGalleries
      : galleries.filter((g) => g.is_locked && !g.is_paid && (g.price ?? 0) > 0),
    [galleries, isDemoMode, realUnpaidGalleries]
  );

  const hasPendingPayments = pendingPaymentGalleries.length > 0;

  const unlockScale = unlockAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.2, 1],
  });

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDownloadSelected = useCallback(async () => {
    if (selectedPhotoIds.size === 0 || !selectedGallery) return;
    setIsDownloading(true);
    
    // Process downloading
    const selectedPhotos = photos.filter(p => selectedPhotoIds.has(p.id));
    const sourceUrls = selectedPhotos.map(p => p.url || p.thumbnailUrl).filter(url => url);

    try {
      if (Platform.OS === 'web') {
        let downloadedCount = 0;
        for (let i = 0; i < sourceUrls.length; i++) {
          const u = sourceUrls[i];
          if (!u) continue;
          await downloadOnWeb(u, `${selectedGallery.name.replace(/[^a-z0-9-_]/gi, '_')}-batch-${i+1}.jpg`);
          downloadedCount++;
        }
        Alert.alert('Downloaded', `${downloadedCount} photos downloaded to your device.`);
      } else {
        const folderPath = `${FileSystem.documentDirectory}galleries/${selectedGallery.id}/`;
        await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
        let savedCount = 0;
        for (let i = 0; i < sourceUrls.length; i++) {
          const u = sourceUrls[i];
          if (!u) continue;
          const dest = `${folderPath}batch-${Date.now()}-${i}.jpg`;
          await downloadAndCompress(u, dest);
          savedCount++;
        }
        Alert.alert('Downloaded', `${savedCount} photos saved to app storage.`);
      }
    } catch (err) {
      console.error('Batch download error:', err);
    } finally {
      setIsDownloading(false);
      setSelectMode(false);
      setSelectedPhotoIds(new Set());
    }
  }, [selectedPhotoIds, photos, selectedGallery, downloadOnWeb]);

  // Show loading while assignment status is being determined
  if (!isDemoMode && assignmentLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {/* Header only shows gallery list title — gallery detail is in the modal */}
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
        </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 120, 160) }}
        stickyHeaderIndices={!selectedGallery ? [0] : []}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await Promise.all([
                  fetchGalleriesRef.current?.(),
                  fetchAllClientIdsRef.current?.(),
                ]);
              } catch {}
              setRefreshing(false);
            }}
            tintColor={Colors.gold}
            colors={[Colors.gold]}
          />
        }
      >

        {!selectedGallery && (
          <BlurView intensity={80} tint="dark" style={styles.tabsBlurContainer}>
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
          </BlurView>
        )}

        {!selectedGallery && activeTab === 'my-galleries' && Object.keys(adminNames).length > 1 && (
          <View style={styles.adminFilterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminFilterScroll}>
              <Pressable
                style={[styles.adminFilterChip, selectedAdminId === null && styles.adminFilterChipActive]}
                onPress={() => setSelectedAdminId(null)}
              >
                <Text style={[styles.adminFilterChipText, selectedAdminId === null && styles.adminFilterChipTextActive]}>All</Text>
              </Pressable>
              {Object.entries(adminNames).map(([id, name]) => (
                <Pressable
                  key={id}
                  style={[styles.adminFilterChip, selectedAdminId === id && styles.adminFilterChipActive]}
                  onPress={() => setSelectedAdminId(id)}
                >
                  <Text style={[styles.adminFilterChipText, selectedAdminId === id && styles.adminFilterChipTextActive]} numberOfLines={1}>{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
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
            <RNAnimated.View style={[styles.unlockIcon, { transform: [{ scale: unlockScale }] }]}>
              <LinearGradient colors={[Colors.goldMuted, 'rgba(212,175,55,0.05)']} style={styles.unlockIconGradient}>
                <Lock size={32} color={Colors.gold} />
              </LinearGradient>
            </RNAnimated.View>
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
          ) : myGalleries.length === 0 ? (
            <View style={[styles.stateContainer, { justifyContent: 'flex-start', paddingTop: 40 }]}>
              <View style={{ alignItems: 'center', marginBottom: 40 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(212,175,55,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                  <Lock size={32} color={Colors.gold} />
                </View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.white, marginBottom: 12 }}>No Galleries Yet</Text>
                <Text style={{ fontSize: 15, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 }}>
                  You don't have any unlocked galleries. Get started by exploring the options below.
                </Text>
              </View>

              <View style={{ width: '100%', paddingHorizontal: 20, gap: 16 }}>
                <Pressable
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' }}
                  onPress={() => setActiveTab('unlock')}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(212,175,55,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                    <Unlock size={24} color={Colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>Unlock a Gallery</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Got an access code? Enter it here</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' }}
                  onPress={() => router.push('/(tabs)/bookings')}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(212,175,55,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                    <MaterialCommunityIcons name="calendar-month" size={24} color={Colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>Book a Session</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Schedule your next photoshoot</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' }}
                  onPress={() => router.push('/(tabs)/chat')}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(212,175,55,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                    <MaterialCommunityIcons name="message-text-outline" size={24} color={Colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>Contact Photographer</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Chat with us for custom inquiries</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.galleriesGrid}>
              {myGalleries.map((gallery, index) => {
                const isHero = index === 0;
                return (
                  <Pressable
                    key={gallery.id}
                    style={[styles.galleryTile, isHero && { aspectRatio: 16/9, marginBottom: 12 }]}
                    onPress={() => {
                      setSelectedGallery(gallery);
                      trackGalleryView(gallery.id, gallery.client_id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    {gallery.cover_photo_url ? (
                      <Image source={{ uri: gallery.cover_photo_url }} style={styles.galleryTileImage} contentFit="cover" transition={300} placeholder={{ blurhash: 'L6Pj0^i_.AyE_3t7t7R**0o#DgR4' }} cachePolicy="memory-disk" />
                    ) : (
                      <LinearGradient colors={[Colors.card, Colors.cardLight]} style={styles.galleryTileImage} />
                    )}
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={[styles.galleryTileOverlay, isHero && { height: '60%', bottom: 0, top: 'auto' }]} />
                    
                    {isHero && (
                      <View style={styles.heroBadge}>
                        <Text style={styles.heroBadgeText}>LATEST</Text>
                      </View>
                    )}
                    
                    <View style={styles.galleryTileInfo}>
                      <View style={styles.galleryTileTopRow}>
                        <View style={styles.galleryTypePill}>
                          <Text style={styles.galleryTypePillText} numberOfLines={1}>{gallery.shoot_type ?? 'My Gallery'}</Text>
                        </View>
                      </View>
                      <Text style={[styles.galleryTileName, isHero && { fontSize: 26 }]} numberOfLines={1}>{gallery.name}</Text>
                      {gallery.photographer_name && (
                        <Text style={styles.photographerTag} numberOfLines={1}>
                          📸 By {gallery.photographer_name}
                        </Text>
                      )}
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
                );
              })}
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
            <View style={{ flex: 1, minHeight: Dimensions.get('window').height * 0.8 }}>
              {/* Category filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PADDING, paddingVertical: 10, gap: 8 }}>
                {['All', 'Wedding', 'Portrait', 'Corporate', 'Event', 'Maternity', 'Newborn', 'Fashion'].map(cat => (
                  <Pressable
                    key={cat}
                    onPress={() => { setPortfolioCategory(cat); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 20,
                      backgroundColor: portfolioCategory === cat ? Colors.gold : 'rgba(255,255,255,0.08)',
                      borderWidth: 1,
                      borderColor: portfolioCategory === cat ? Colors.gold : 'rgba(255,255,255,0.12)',
                    }}
                  >
                    <Text style={{
                      color: portfolioCategory === cat ? '#000' : Colors.textMuted,
                      fontWeight: portfolioCategory === cat ? '700' : '500',
                      fontSize: 13,
                    }}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <FlashList
                data={portfolioCategory === 'All' ? portfolioItems : portfolioItems.filter(p => p.category === portfolioCategory)}
                numColumns={2}
                {...{ estimatedItemSize: 250 }}
                contentContainerStyle={{ paddingHorizontal: PADDING }}
                renderItem={({ item, index }: { item: PortfolioItem; index: number }) => (
                  <View style={{ padding: COL_GAP / 2 }}>
                    <PortfolioCard key={item.id} item={item} index={index} onLike={(id) => handleLikePhoto(id, true)} onPress={setSelectedPortfolioItem} />
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.stateContainer}>
                    <Text style={styles.stateText}>No {portfolioCategory} portfolio items yet.</Text>
                  </View>
                }
              />

              {/* Book This Package CTA */}
              {portfolioCategory !== 'All' && portfolioPackages.some(p => p.category === portfolioCategory) && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const pkg = portfolioPackages.find(p => p.category === portfolioCategory);
                    router.push({ pathname: '/(tabs)/bookings', params: { preselectCategory: portfolioCategory } });
                  }}
                  style={{
                    marginHorizontal: PADDING,
                    marginBottom: 16,
                    backgroundColor: Colors.gold,
                    borderRadius: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <ShoppingBag size={18} color="#000" />
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>Book {portfolioCategory} Package</Text>
                </Pressable>
              )}
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
            <View style={{ flex: 1, minHeight: Dimensions.get('window').height * 0.8 }}>
              <FlashList
                data={topRatedItems}
                numColumns={2}
                {...{ estimatedItemSize: 250 }}
                contentContainerStyle={{ paddingHorizontal: PADDING }}
                renderItem={({ item, index }: { item: PortfolioItem; index: number }) => (
                  <View style={{ padding: COL_GAP / 2 }}>
                    <PortfolioCard key={item.id} item={item} index={index} onLike={(id) => handleLikePhoto(id, true)} onPress={setSelectedPortfolioItem} />
                  </View>
                )}
              />
            </View>
          )
        )}

        
      </ScrollView>

      <Modal visible={!!selectedGallery} animationType="slide" onRequestClose={() => setSelectedGallery(null)}>
        <View style={styles.galleryModalContainer}>
          <BlurView intensity={120} tint="dark" style={styles.galleryModalHeaderBlur}>
            <SafeAreaView edges={['top']} style={styles.galleryModalHeaderSafe}>
              {selectedGallery && (
                <View style={[styles.premiumHeader, { paddingTop: 6 }]}>
                  <View style={styles.galleryDetailHeader}>
                    <Pressable onPress={() => {
                      if (selectMode) {
                        setSelectMode(false);
                        setSelectedPhotoIds(new Set());
                      } else {
                        setSelectedGallery(null);
                      }
                    }} hitSlop={12} style={styles.premiumHeaderButton}>
                      {selectMode ? <X size={22} color={Colors.white} /> : <ArrowLeft size={22} color={Colors.white} />}
                    </Pressable>
                    <View style={styles.galleryDetailTitle}>
                      <Text style={styles.premiumHeaderTitle} numberOfLines={1}>{selectMode ? `${selectedPhotoIds.size} Selected` : selectedGallery.name}</Text>
                      {!selectMode && (
                        <Text style={styles.galleryDetailSubPremium}>{photos.length} photos • {selectedGallery.shoot_type ?? 'My Gallery'}</Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      {selectMode ? (
                        <Pressable onPress={() => {
                          if (selectedPhotoIds.size === photos.length) {
                            setSelectedPhotoIds(new Set());
                          } else {
                            setSelectedPhotoIds(new Set(photos.map(p => p.id)));
                          }
                        }} style={styles.selectAllButton}>
                          <Text style={styles.selectAllButtonText}>{selectedPhotoIds.size === photos.length ? 'Deselect All' : 'Select All'}</Text>
                        </Pressable>
                      ) : (
                        <>
                          {canViewClean && (
                            <Pressable onPress={() => {
                              setSelectMode(true);
                              setSelectedPhotoIds(new Set());
                            }} style={styles.selectModeButton}>
                              <Text style={styles.selectModeButtonText}>Select</Text>
                            </Pressable>
                          )}
                          {canViewClean && (
                            <Pressable onPress={() => handleDownloadGallery(selectedGallery)} hitSlop={8} style={styles.premiumIconButton}>
                              <Download size={20} color={Colors.gold} />
                            </Pressable>
                          )}
                          <Pressable onPress={() => handleShareGallery(selectedGallery)} hitSlop={8} style={styles.premiumIconButton}>
                            <Share2 size={20} color={Colors.gold} />
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </SafeAreaView>
          </BlurView>
          <View style={{ flex: 1 }}>
            {photosLoading ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator color={Colors.gold} />
                <Text style={[styles.stateText, { marginTop: 12 }]}>Loading photos...</Text>
              </View>
            ) : photosError ? (
              <View style={styles.stateContainer}>
                <Text style={styles.stateText}>{photosError}</Text>
                <Pressable
                  style={{ marginTop: 16, backgroundColor: 'rgba(212,175,55,0.15)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' }}
                  onPress={() => {
                    if (selectedGallery) {
                      setPhotosLoading(true);
                      setPhotosError(null);
                      // Re-fetch photos
                      import('@/services/client').then(({ ClientService }) => {
                        ClientService.gallery.getPhotos(selectedGallery.id)
                          .then((data) => {
                            setPhotos(data as any[]);
                            setPhotosLoading(false);
                          })
                          .catch((e) => {
                            setPhotosError(e?.message || 'Failed to load photos');
                            setPhotosLoading(false);
                          });
                      });
                    }
                  }}
                >
                  <Text style={{ color: Colors.gold, fontWeight: '600' }}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <FlashList
                  data={photos}
                  numColumns={2}
                  {...{ estimatedItemSize: 250 }}
                  contentContainerStyle={{ paddingHorizontal: PADDING, paddingBottom: 24 }}
                  renderItem={({ item, index }: { item: PhotoRow; index: number }) => (
                    <View style={{ padding: COL_GAP / 2 }}>
                      <PhotoCard
                        photo={item}
                        index={index}
                        onLike={handleLikePhoto}
                        onOpenPhoto={handleOpenPhoto}
                        isLiked={likedPhotos.has(item.id)}
                        showWatermark={!canViewClean}
                        isBlurred={false}
                        accessCodeLink={accessCodeLink}
                        shareAppLink={galleryShareLink || shareAppLink}
                        isGalleryUnpaid={!!selectedGallery && !selectedGallery.is_paid && selectedGallery.is_locked}
                        selectMode={selectMode}
                        isSelected={selectedPhotoIds.has(item.id)}
                        onToggleSelect={handleToggleSelect}
                      />
                    </View>
                  )}
                  ListFooterComponent={
                    selectedGallery && !selectedGallery.is_paid && selectedGallery.is_locked ? (
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
                    ) : null
                  }
                />
              </View>
            )}
          </View>
          
          {selectMode && selectedPhotoIds.size > 0 && (
            <RNAnimated.View style={[styles.batchActionBar, { bottom: insets.bottom + 20 }]}>
              <Pressable onPress={handleDownloadSelected} style={styles.batchActionBtn} disabled={isDownloading}>
                {isDownloading ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <>
                    <Download size={20} color={Colors.background} />
                    <Text style={styles.batchActionText}>Download {selectedPhotoIds.size}</Text>
                  </>
                )}
              </Pressable>
            </RNAnimated.View>
          )}
        </View>
      </Modal>

      <Modal visible={!!selectedPhotoItem} transparent animationType="fade" onRequestClose={() => setSelectedPhotoItem(null)}>
        {selectedPhotoItem && (
          <FluidPhotoViewer
            photo={selectedPhotoItem}
            onClose={() => setSelectedPhotoItem(null)}
            onLike={handleLikePhoto}
            onDownload={handleDownloadPhotoItem}
            onShare={handleSharePhotoItem}
            isLiked={likedPhotos.has(selectedPhotoItem.id)}
            galleryName={selectedGallery?.name || 'Gallery'}
          />
        )}
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
                  {/* Book This Package button */}
                  {selectedPortfolioItem.category && portfolioPackages.some(p => p.category === selectedPortfolioItem.category) && (
                    <Pressable
                      onPress={() => {
                        setSelectedPortfolioItem(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push({ pathname: '/(tabs)/bookings', params: { preselectCategory: selectedPortfolioItem.category } });
                      }}
                      style={{
                        marginTop: 12,
                        backgroundColor: Colors.gold,
                        borderRadius: 12,
                        paddingVertical: 12,
                        paddingHorizontal: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <ShoppingBag size={16} color="#000" />
                      <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>Book {selectedPortfolioItem.category} Package</Text>
                    </Pressable>
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
  navBlurGradient: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99,
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
  tabsBlurContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(20,19,19,0.7)',
  },
  tabsContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tab: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderColor: 'rgba(212,175,55,0.9)',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  tabTextActive: {
    color: Colors.gold,
  },
  adminFilterContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  adminFilterScroll: {
    paddingHorizontal: 4,
    gap: 8,
  },
  adminFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  adminFilterChipActive: {
    backgroundColor: 'rgba(212,175,55,0.2)',
    borderColor: 'rgba(212,175,55,0.5)',
  },
  adminFilterChipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  adminFilterChipTextActive: {
    color: '#d4af37',
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
    aspectRatio: 4/5,
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
  photographerTag: {
    fontSize: 12,
    color: Colors.gold,
    marginBottom: 6,
    fontWeight: '500' as const,
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
  batchActionBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  batchActionBtn: {
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
    minWidth: 160,
    justifyContent: 'center',
  },
  batchActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  heroBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: Colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.background,
    letterSpacing: 1,
  },
  selectIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectIndicatorActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold,
  },
  selectIndicatorInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  // Premium header styles
  headerBlur: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(20,19,19,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  // Premium gallery modal styles
  galleryModalHeaderBlur: {
    backgroundColor: 'rgba(20,19,19,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.2)',
  },
  premiumHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  premiumHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  premiumIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  premiumHeaderTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: -0.3,
  },
  galleryDetailSubPremium: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  selectModeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  selectModeButtonText: {
    color: Colors.gold,
    fontWeight: '700',
    fontSize: 13,
  },
  selectAllButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  selectAllButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
