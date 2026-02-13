import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Dimensions, Alert, Share, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Unlock, Search, Heart, Download, Eye, X, Share2, ShoppingBag, ArrowLeft, CreditCard } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ScreenCapture from 'expo-screen-capture';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { ClientService, type Photo as ClientPhoto } from '@/services/client';
import { useBranding } from '@/contexts/BrandingContext';
import { useAuth } from '@/contexts/AuthContext';
import PaymentModal from '@/components/PaymentModal';

const { width } = Dimensions.get('window');
const COL_GAP = 8;
const PADDING = 16;
const COL_WIDTH = (width - PADDING * 2 - COL_GAP) / 2;

type TabType = 'my-galleries' | 'top-rated' | 'unlock';

type GalleryRow = Database['public']['Tables']['galleries']['Row'];
type PhotoRow = ClientPhoto;

function PhotoCard({ photo, index, onLike, isLiked, showWatermark }: { photo: PhotoRow; index: number; onLike: (id: string) => void; isLiked: boolean; showWatermark: boolean }) {
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
    onLike(photo.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, friction: 3, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 0, duration: 600, delay: 400, useNativeDriver: true }),
    ]).start();
  }, [heartScale, onLike, photo.id]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Check out this amazing photo from ${brandName}!`,
        url: photo.url,
      });
    } catch (error) {
      console.error('Failed to share photo:', error);
    }
  }, [brandName, photo.url]);

  const aspectRatio = (photo.width ?? 1) / (photo.height ?? 1);
  const imageHeight = COL_WIDTH / aspectRatio;
  const opacity = Math.max(0, Math.min(100, watermarkOpacity)) / 100;
  const displayText = (watermarkText || '').trim();
  const fontSize = watermarkSize === 'small' ? 12 : watermarkSize === 'large' ? 22 : 16;
  const rotation = `${-1 * watermarkRotation}deg`;
  const shouldShowWatermark = showWatermark && photo.variant === 'watermarked' && opacity > 0 && displayText.length > 0;


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
      <Pressable onPress={handleDoubleTap} onLongPress={handleShare}>
        <Image
          source={{ uri: photo.url }}
          style={[styles.photoImage, { height: imageHeight }]}
          contentFit="cover"
        />
        {shouldShowWatermark && (
          <View style={styles.watermarkOverlay} pointerEvents="none">
            {watermarkPosition === 'grid' ? (
              <View style={styles.watermarkGrid}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <Text
                    key={`${photo.id}-wm-${i}`}
                    style={[
                      styles.watermarkText,
                      { color: `rgba(255,255,255,${opacity * 0.55})`, fontSize, transform: [{ rotate: rotation }] },
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
                        color: `rgba(255,255,255,${opacity * 0.55})`,
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
                  { color: `rgba(255,255,255,${opacity * 0.55})`, fontSize, transform: [{ rotate: rotation }] },
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

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { brandName, blockScreenshots, setActiveAdminId } = useBranding();
  const [activeTab, setActiveTab] = useState<TabType>('my-galleries');
  const [accessCode, setAccessCode] = useState<string>('');
  const [selectedGallery, setSelectedGallery] = useState<GalleryRow | null>(null);
  const [likedPhotos, setLikedPhotos] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const unlockAnim = useRef(new Animated.Value(0)).current;
  const [clientId, setClientId] = useState<string | null>(null);
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [galleriesLoading, setGalleriesLoading] = useState(true);
  const [galleriesError, setGalleriesError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentGallery, setPaymentGallery] = useState<GalleryRow | null>(null);

  const favoritesCount = likedPhotos.size;

  const handleLikePhoto = useCallback((id: string) => {
    setLikedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
      .order('created_at', { ascending: false });

    if (error || !data) {
      setGalleries([]);
      setGalleriesError('Failed to load galleries.');
      setGalleriesLoading(false);
      return;
    }

    setGalleries(data);
    setGalleriesLoading(false);
  }, [clientId, fetchClientId]);

  const fetchPhotosForGallery = useCallback(async (galleryId: string) => {
    setPhotosLoading(true);
    setPhotosError(null);

    try {
      const data = await ClientService.gallery.getPhotos(galleryId);
      setPhotos(data);
    } catch (error) {
      setPhotos([]);
      setPhotosError('Failed to load photos.');
      console.error('Failed to load photos:', error);
    } finally {
      setPhotosLoading(false);
    }
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!accessCode.trim()) {
      Alert.alert('Enter Code', 'Please enter your gallery access code.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(unlockAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(unlockAnim, { toValue: 0, duration: 300, delay: 1500, useNativeDriver: true }),
    ]).start();
    const { data, error } = await supabase
      .from('galleries')
      .select('*')
      .eq('access_code', accessCode.trim())
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      Alert.alert('Invalid Code', 'We could not find a gallery for that access code.');
      return;
    }

    setAccessCode('');
    setSelectedGallery(data);
  }, [accessCode, unlockAnim]);

  const handlePayGallery = useCallback((gallery: GalleryRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPaymentGallery(gallery);
    setPaymentModalVisible(true);
  }, []);

  const handleShareGallery = useCallback(async (gallery: GalleryRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Check out my "${gallery.name}" gallery from ${brandName}!`,
      });
    } catch (error) {
      console.error('Failed to share gallery:', error);
    }
  }, [brandName]);

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

  useEffect(() => {
    fetchClientId().then(() => fetchGalleries());
  }, [fetchClientId, fetchGalleries]);

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

  const myGalleries = useMemo(() => {
    const filtered = galleries.filter((g) => !g.is_locked || g.is_paid);
    if (searchQuery.trim()) {
      return filtered.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
  }, [galleries, searchQuery]);

  const lockedGalleries = useMemo(
    () => galleries.filter((g) => g.is_locked && !g.is_paid),
    [galleries]
  );

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
              <Pressable onPress={() => handleShareGallery(selectedGallery)} hitSlop={8}>
                <Share2 size={20} color={Colors.gold} />
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.headerTitle}>Gallery</Text>
              <View style={styles.searchContainer}>
                <Search size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search galleries..."
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
          <View style={styles.tabs}>
            {(['my-galleries', 'top-rated', 'unlock'] as TabType[]).map((tab) => (
              <Pressable
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => { setActiveTab(tab); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'my-galleries' ? 'My Galleries' : tab === 'top-rated' ? 'Portfolio' : 'Unlock'}
                </Text>
              </Pressable>
            ))}
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
            <Pressable style={styles.unlockButton} onPress={handleUnlock}>
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

            {lockedGalleries.length > 0 && (
              <View style={styles.lockedList}>
                <Text style={styles.lockedListTitle}>Pending Galleries</Text>
                {lockedGalleries.map((gallery) => (
                  <Pressable key={gallery.id} style={styles.lockedItem} onPress={() => gallery.price ? handlePayGallery(gallery) : undefined}>
                    {gallery.cover_photo_url ? (
                      <Image source={{ uri: gallery.cover_photo_url }} style={styles.lockedItemImage} />
                    ) : (
                      <LinearGradient colors={[Colors.card, Colors.cardLight]} style={styles.lockedItemImage} />
                    )}
                    <View style={styles.lockedItemInfo}>
                      <Text style={styles.lockedItemTitle}>{gallery.name}</Text>
                      <Text style={styles.lockedItemMeta}>{gallery.shoot_type ?? 'Gallery'}</Text>
                    </View>
                    {gallery.price ? (
                      <View style={styles.payChip}>
                        <CreditCard size={12} color={Colors.background} />
                        <Text style={styles.payChipText}>KES {gallery.price.toLocaleString()}</Text>
                      </View>
                    ) : (
                      <Lock size={16} color={Colors.textMuted} />
                    )}
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
                    <Text style={styles.galleryTileName} numberOfLines={1}>{gallery.name}</Text>
                    <View style={styles.galleryTileMeta}>
                      <Text style={styles.galleryTileCount}>{gallery.shoot_type ?? 'Gallery'}</Text>
                      <View style={styles.galleryTileActions}>
                        <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation?.(); handleShareGallery(gallery); }}>
                          <Share2 size={14} color={Colors.textSecondary} />
                        </Pressable>
                        <Eye size={14} color={Colors.textSecondary} />
                        <Download size={14} color={Colors.textSecondary} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )
        )}

        {(activeTab === 'top-rated' || selectedGallery) && (
          photosLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator color={Colors.gold} />
            </View>
          ) : photosError ? (
            <View style={styles.stateContainer}>
              <Text style={styles.stateText}>{photosError}</Text>
            </View>
          ) : (
            <View style={styles.masonryGrid}>
              <View style={styles.masonryColumn}>
                {leftColumn.map((photo, i) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    index={i * 2}
                    onLike={handleLikePhoto}
                    isLiked={likedPhotos.has(photo.id)}
                    showWatermark={!canViewClean}
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
                    isLiked={likedPhotos.has(photo.id)}
                    showWatermark={!canViewClean}
                  />
                ))}
              </View>
            </View>
          )
        )}
      </ScrollView>

      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        gallery={paymentGallery}
        clientPhone={user?.phone}
        onSuccess={() => {
          // Refresh galleries to show unlocked status
          fetchGalleries();
          if (paymentGallery) {
            setSelectedGallery({ ...paymentGallery, is_paid: true, is_locked: false });
          }
        }}
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
  tabs: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.goldMuted,
    borderColor: Colors.gold,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textMuted,
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
    height: 200,
    borderRadius: 16,
    overflow: 'hidden' as const,
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
  galleryTileName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
    marginBottom: 6,
  },
  galleryTileMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryTileCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  galleryTileActions: {
    flexDirection: 'row' as const,
    gap: 12,
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
    backgroundColor: 'rgba(0,0,0,0.3)',
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
});
