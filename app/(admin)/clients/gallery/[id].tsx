import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, Dimensions, ActivityIndicator, FlatList, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft, Grid, Lock, Unlock, Trash2, Megaphone, Check, Download, Eye, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 2;
const ITEM_SIZE = (width - SPACING * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

export default function GalleryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [gallery, setGallery] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [previewPhoto, setPreviewPhoto] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadGalleryDetails();
    loadStats();
  }, [id]);

  useEffect(() => {
    loadPhotos();
  }, [id, page]);

  const loadGalleryDetails = async () => {
    try {
      const galleries = await AdminService.gallery.list();
      const found = galleries.find((g: any) => g.id === id);
      if (found) {
        setGallery(found);
      }
    } catch (error) {
      console.error('Error loading gallery details:', error);
    }
  };

  const loadStats = async () => {
    try {
      const s = await AdminService.gallery.getStats(id);
      setStats(s);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadPhotos = async () => {
    if (!hasMore && page > 0) return;
    
    try {
      setLoadingPhotos(true);
      const { data, count } = await AdminService.gallery.getPhotos(id, page, 50);
      
      if (data && data.length > 0) {
        // Sign URLs for private bucket access
        const paths = data
          .map((p: any) => p.photo_url)
          .filter((p: string) => p && !p.startsWith('http'));
        const { data: signedUrls, error: signError } = await supabase.storage
          .from('client-photos')
          .createSignedUrls(paths, 3600); // 1 hour expiry

        let photosWithUrls = data;
        
        if (!signError && signedUrls) {
          const urlMap = new Map(signedUrls.map(s => [s.path, s.signedUrl]));
          photosWithUrls = data.map((p: any) => ({
            ...p,
            url: urlMap.get(p.photo_url) || (p.photo_url?.startsWith('http') ? p.photo_url : p.photo_url)
          }));
        } else {
           // Fallback to public URL if signing fails (e.g. public bucket)
           photosWithUrls = data.map((p: any) => {
             if (p.photo_url?.startsWith('http')) {
               return { ...p, url: p.photo_url };
             }
             const { data: publicData } = supabase.storage.from('client-photos').getPublicUrl(p.photo_url);
             return { ...p, url: publicData.publicUrl };
           });
        }

        setPhotos(prev => page === 0 ? photosWithUrls : [...prev, ...photosWithUrls]);
        if (data.length < 50) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoadingPhotos(false);
      setLoading(false);
    }
  };

  const handleToggleLock = async () => {
    if (!gallery) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newStatus = !gallery.is_locked;
    
    Alert.alert(
      newStatus ? 'Lock Gallery' : 'Unlock Gallery',
      `Are you sure you want to ${newStatus ? 'lock' : 'unlock'} this gallery?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              await AdminService.gallery.update(gallery.id, { is_locked: newStatus });
              setGallery({ ...gallery, is_locked: newStatus });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              Alert.alert('Error', 'Failed to update gallery status');
            }
          }
        }
      ]
    );
  };

  const handleDelete = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Gallery',
      'This action is irreversible. All photos and data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await AdminService.gallery.delete(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete gallery');
            }
          }
        }
      ]
    );
  };

  const handlePromote = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Promote Gallery',
      'Create an announcement for this gallery?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              await AdminService.gallery.promoteToAnnouncement(
                id,
                `New Gallery: ${gallery.title}`,
                `Check out the photos from ${gallery.title}!`
              );
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Announcement created!');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to promote');
            }
          }
        }
      ]
    );
  };

  const renderPhotoItem = ({ item, index }: { item: any, index: number }) => {
    // Use thumbnail for grid display, full URL for preview
    const thumbnailUrl = item.thumbnailUrl || item.url || item.photo_url;
    const fullImageUrl = item.url || item.photo_url;

    return (
      <Pressable 
        style={styles.photoItem}
        onPress={() => {
          setPreviewPhoto({ ...item, url: fullImageUrl });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.photoImage}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          priority="low"
        />
      </Pressable>
    );
  };

  if (loading && !gallery) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.white} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle} numberOfLines={1}>{gallery?.name || 'Gallery'}</Text>
          <Text style={styles.headerSub}>{gallery?.clients?.name || 'Client'} • {gallery?.access_code}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Download size={20} color={Colors.gold} />
            <Text style={styles.statValue}>{stats?.downloads_total || 0}</Text>
            <Text style={styles.statLabel}>Downloads</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Eye size={20} color={Colors.gold} />
            <Text style={styles.statValue}>{stats?.unique_viewers || 0}</Text>
            <Text style={styles.statLabel}>Views</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Grid size={20} color={Colors.gold} />
            <Text style={styles.statValue}>{stats?.photo_count || 0}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
        </View>

        {/* Actions Bar */}
        <View style={styles.actionsBar}>
          <Pressable style={styles.actionBtn} onPress={handleToggleLock}>
            {gallery?.is_locked ? <Unlock size={18} color={Colors.success} /> : <Lock size={18} color={Colors.warning} />}
            <Text style={styles.actionText}>{gallery?.is_locked ? 'Unlock' : 'Lock'}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={handlePromote}>
            <Megaphone size={18} color={Colors.gold} />
            <Text style={styles.actionText}>Promote</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: 'rgba(231, 76, 60, 0.1)' }]} onPress={handleDelete}>
            <Trash2 size={18} color={Colors.error} />
            <Text style={[styles.actionText, { color: Colors.error }]}>Delete</Text>
          </Pressable>
        </View>

        {/* Photos Grid */}
        <View style={styles.gridContainer}>
          <FlatList
            data={photos}
            renderItem={renderPhotoItem}
            keyExtractor={item => item.id}
            numColumns={COLUMN_COUNT}
            scrollEnabled={false} // Let parent ScrollView handle scrolling
            onEndReached={() => {
              if (hasMore && !loadingPhotos) setPage(p => p + 1);
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingPhotos ? <ActivityIndicator color={Colors.gold} style={{ padding: 20 }} /> : null}
          />
        </View>
      </ScrollView>

      {/* Full Screen Preview Modal */}
      <Modal visible={!!previewPhoto} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalClose} onPress={() => setPreviewPhoto(null)}>
            <X size={28} color="#fff" />
          </Pressable>
          {previewPhoto && (
            <Image
              source={{ uri: previewPhoto.url }}
              style={styles.fullImage}
              contentFit="contain"
            />
          )}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.card,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    margin: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  actionsBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: Colors.background,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  gridContainer: {
    minHeight: 500,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginRight: SPACING,
    marginBottom: SPACING,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#222',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
