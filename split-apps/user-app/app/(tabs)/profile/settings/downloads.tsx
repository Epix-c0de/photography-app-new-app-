import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Download, Calendar, Image as ImageIcon, RefreshCw, Lock, Eye, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import SettingsHeader from '@/components/SettingsHeader';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

interface GalleryItem {
  id: string;
  name: string;
  cover_photo_url: string | null;
  photo_count: number;
  access_code: string;
  is_locked: boolean;
  unlocked_at?: string;
  downloaded_at?: string;
}

export default function Downloads() {
  const router = useRouter();
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      let user: any = null;
      try {
        const result = await supabase.auth.getUser();
        user = result.data?.user;
      } catch {
        throw new Error('Failed to get user');
      }
      if (!user) return;

      // Fetch unlocked galleries with cover photos and photo counts
      const { data: unlocked, error: unlockError } = await supabase
        .from('unlocked_galleries')
        .select('id, gallery_id, unlocked_at')
        .eq('user_id', user.id)
        .order('unlocked_at', { ascending: false });

      if (unlockError) {
        console.error('Error loading unlocked galleries:', unlockError);
      }

      const galleryIds = (unlocked || []).map((u: any) => u.gallery_id).filter(Boolean);
      if (galleryIds.length === 0) {
        setGalleries([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch gallery details
      const { data: galleryData, error: galleryError } = await supabase
        .from('galleries')
        .select('id, name, cover_photo_url, access_code, is_locked')
        .in('id', galleryIds);

      if (galleryError) {
        console.error('Error loading galleries:', galleryError);
      }

      // Fetch photo counts
      const { data: photoCounts } = await supabase
        .from('gallery_photos')
        .select('gallery_id')
        .in('gallery_id', galleryIds);

      const countMap = new Map<string, number>();
      (photoCounts || []).forEach((p: any) => {
        countMap.set(p.gallery_id, (countMap.get(p.gallery_id) || 0) + 1);
      });

      // Fetch download history for these galleries
      const { data: downloads } = await supabase
        .from('download_history')
        .select('gallery_id, downloaded_at')
        .eq('user_id', user.id)
        .in('gallery_id', galleryIds)
        .order('downloaded_at', { ascending: false });

      const downloadMap = new Map<string, string>();
      (downloads || []).forEach((d: any) => {
        if (!downloadMap.has(d.gallery_id)) {
          downloadMap.set(d.gallery_id, d.downloaded_at);
        }
      });

      // Build signed cover URLs
      const coverPaths: { id: string; path: string }[] = [];
      (galleryData || []).forEach((g: any) => {
        if (g.cover_photo_url && !g.cover_photo_url.startsWith('http')) {
          coverPaths.push({ id: g.id, path: g.cover_photo_url });
        }
      });

      const signedCoverMap = new Map<string, string>();
      if (coverPaths.length > 0) {
        const paths = coverPaths.map(c => c.path);
        const { data: signedUrls } = await supabase.storage
          .from('client-photos')
          .createSignedUrls(paths, 3600);
        if (signedUrls) {
          signedUrls.forEach((s: any) => {
            if (s.path && s.signedUrl) signedCoverMap.set(s.path, s.signedUrl);
          });
        }
      }

      // Combine everything
      const unlockMap = new Map((unlocked || []).map((u: any) => [u.gallery_id, u.unlocked_at]));
      const result: GalleryItem[] = (galleryData || []).map((g: any) => {
        let coverUrl = g.cover_photo_url || '';
        if (coverUrl && !coverUrl.startsWith('http')) {
          coverUrl = signedCoverMap.get(coverUrl) || coverUrl;
        }
        return {
          id: g.id,
          name: g.name || 'Untitled Gallery',
          cover_photo_url: coverUrl,
          photo_count: countMap.get(g.id) || 0,
          access_code: g.access_code || '',
          is_locked: g.is_locked,
          unlocked_at: unlockMap.get(g.id),
          downloaded_at: downloadMap.get(g.id),
        };
      });

      setGalleries(result);
    } catch (error) {
      console.error('Failed to load downloads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const openGallery = (item: GalleryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/gallery?galleryId=${item.id}`);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: GalleryItem }) => (
    <Pressable style={styles.card} onPress={() => openGallery(item)}>
      <View style={styles.cardImageWrapper}>
        {item.cover_photo_url ? (
          <Image
            source={{ uri: item.cover_photo_url }}
            style={styles.cardImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback]}>
            <Text style={styles.cardImageFallbackText}>{item.name[0]}</Text>
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.cardGradient}
        />
        <View style={styles.cardOverlay}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.cardMeta}>
            <View style={styles.cardMetaItem}>
              <ImageIcon size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.cardMetaText}>{item.photo_count} photos</Text>
            </View>
            {item.downloaded_at && (
              <View style={styles.cardMetaItem}>
                <Download size={12} color={Colors.gold} />
                <Text style={[styles.cardMetaText, { color: Colors.gold }]}>Downloaded</Text>
              </View>
            )}
            {!item.downloaded_at && (
              <View style={styles.cardMetaItem}>
                <Eye size={12} color="rgba(255,255,255,0.6)" />
                <Text style={styles.cardMetaText}>View only</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.cardFooterLeft}>
          {item.unlocked_at && (
            <Text style={styles.cardDate}>Unlocked {formatDate(item.unlocked_at)}</Text>
          )}
          {item.access_code && (
            <View style={styles.accessCodeBadge}>
              <Text style={styles.accessCodeText}>{item.access_code}</Text>
            </View>
          )}
        </View>
        <ArrowRight size={16} color={Colors.gold} />
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsHeader title="Downloads" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsHeader title="Downloads" />

      {galleries.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Download size={40} color={Colors.gold} />
          </View>
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptyDesc}>
            Download photos from your unlocked galleries to access them here
          </Text>
          <Pressable
            style={styles.browseButton}
            onPress={() => router.push('/(tabs)/gallery')}
          >
            <Text style={styles.browseButtonText}>Browse Galleries</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{galleries.length}</Text>
              <Text style={styles.statLabel}>Galleries</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {galleries.reduce((sum, g) => sum + g.photo_count, 0)}
              </Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {galleries.filter(g => g.downloaded_at).length}
              </Text>
              <Text style={styles.statLabel}>Downloaded</Text>
            </View>
          </View>
          <FlatList
            data={galleries}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.gold,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  list: {
    padding: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardImageWrapper: {
    height: 200,
    width: '100%',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageFallback: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageFallbackText: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.gold,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  cardFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  accessCodeBadge: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  accessCodeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gold,
    letterSpacing: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#080810',
  },
});
