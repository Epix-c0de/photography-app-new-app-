import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, Dimensions,
  ActivityIndicator, FlatList, Modal, Share, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  ArrowLeft, Grid, Lock, Unlock, Trash2, Megaphone, Check, Download, Eye, X,
  Share2, Image as ImageIcon, Send, Copy, ChevronLeft, ChevronRight,
  CheckSquare, Square, Star, MoreVertical, Heart,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
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
  const [refreshing, setRefreshing] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<any>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Cover photo setting
  const [settingCover, setSettingCover] = useState(false);

  useEffect(() => {
    loadAll();
  }, [id]);

  useEffect(() => {
    loadPhotos();
  }, [id, page]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadGalleryDetails(), loadStats()]);
    setLoading(false);
  };

  const loadGalleryDetails = async () => {
    try {
      const galleries = await AdminService.gallery.list();
      const found = galleries.find((g: any) => g.id === id);
      if (found) setGallery(found);
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
      console.log(`[GalleryDetail] getPhotos returned: ${data?.length || 0} photos for gallery ${id}`);
      if (data && data.length > 0) {
        console.log(`[GalleryDetail] First photo_url: ${data[0].photo_url}`);
      }

      if (data && data.length > 0) {
        // Build URLs: try signed first, fallback to public
        const urlMap = new Map<string, string>();

        const relativePhotos = data.filter((p: any) => p.photo_url && !p.photo_url.startsWith('http'));
        const httpPhotos = data.filter((p: any) => p.photo_url?.startsWith('http'));

        // Batch sign all relative paths
        if (relativePhotos.length > 0) {
          const paths = relativePhotos.map((p: any) => p.photo_url);
          
          // Try signed URLs first
          try {
            const { data: signedUrls, error: signError } = await supabase.storage
              .from('client-photos')
              .createSignedUrls(paths, 3600);

            if (!signError && signedUrls && signedUrls.length > 0) {
              for (const s of signedUrls) {
                if (s.path && s.signedUrl) {
                  urlMap.set(s.path, s.signedUrl);
                }
              }
            }
          } catch (e) {
            console.warn('[GalleryDetail] Signed URL batch failed:', e);
          }

          // Fallback: public URLs for any that failed
          for (const p of relativePhotos) {
            if (!urlMap.has(p.photo_url)) {
              try {
                const { data: pubData } = supabase.storage
                  .from('client-photos')
                  .getPublicUrl(p.photo_url);
                if (pubData?.publicUrl) {
                  urlMap.set(p.photo_url, pubData.publicUrl);
                }
              } catch (e) {}
            }
          }
        }

        // Map photos with resolved URLs
        const photosWithUrls = data.map((p: any) => {
          let url = urlMap.get(p.photo_url) || '';
          if (!url && p.photo_url?.startsWith('http')) {
            url = p.photo_url;
          }
          // Final fallback: try getting URL from the photo itself
          if (!url) {
            try {
              const { data: pubData } = supabase.storage
                .from('client-photos')
                .getPublicUrl(p.photo_url);
              if (pubData?.publicUrl) url = pubData.publicUrl;
            } catch (e) {}
          }
          return { ...p, url: url || '' };
        });

        console.log(`[GalleryDetail] Resolved URLs:`, photosWithUrls.map(p => ({ url: p.url?.substring(0, 80), photo_url: p.photo_url?.substring(0, 80) })));
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
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    loadGalleryDetails();
    loadStats();
    loadPhotos();
  }, [id]);

  // --- Actions ---

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
          },
        },
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
          },
        },
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
          },
        },
      ]
    );
  };

  const handleShareGallery = async () => {
    try {
      await Share.share({
        message: `Check out the gallery "${gallery?.name || 'Gallery'}" with ${photos.length} photos from Epix Visuals`,
        title: gallery?.name || 'Gallery',
      });
    } catch (e) {}
  };

  const handleCopyAccessCode = async () => {
    if (!gallery?.access_code) return;
    try {
      await Clipboard.setStringAsync(gallery.access_code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copied', `Access code "${gallery.access_code}" copied to clipboard`);
    } catch (e) {
      Alert.alert('Error', 'Failed to copy access code');
    }
  };

  const handleSendNotification = async () => {
    if (!gallery?.client_id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Send Notification',
      'Notify the client that their gallery is ready?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SMS',
          onPress: async () => {
            try {
              const { error } = await supabase.functions.invoke('send-access-code', {
                body: { client_id: gallery.client_id, gallery_id: gallery.id },
              });
              if (error) throw error;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Sent', 'Access code sent to client via SMS');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to send notification');
            }
          },
        },
      ]
    );
  };

  // --- Selection ---

  const toggleSelection = (photoId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(photos.map(p => p.id)));
    }
  };

  const handleBulkDelete = () => {
    Alert.alert(
      'Delete Photos',
      `Delete ${selectedIds.size} photo(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from storage
              const toDelete = photos.filter(p => selectedIds.has(p.id));
              const paths = toDelete.map(p => p.photo_url).filter(Boolean);
              if (paths.length > 0) {
                await supabase.storage.from('client-photos').remove(paths);
              }
              // Delete from DB
              for (const pid of selectedIds) {
                await supabase.from('gallery_photos').delete().eq('id', pid);
              }
              setPhotos(prev => prev.filter(p => !selectedIds.has(p.id)));
              setSelectedIds(new Set());
              setSelectionMode(false);
              loadStats();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              Alert.alert('Error', 'Failed to delete photos');
            }
          },
        },
      ]
    );
  };

  const handleSetCover = async (photoUrl: string) => {
    if (!gallery) return;
    setSettingCover(true);
    try {
      await AdminService.gallery.update(gallery.id, { cover_photo_url: photoUrl });
      setGallery({ ...gallery, cover_photo_url: photoUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Cover Updated', 'Gallery cover photo has been updated');
    } catch (e) {
      Alert.alert('Error', 'Failed to set cover photo');
    } finally {
      setSettingCover(false);
    }
  };

  const handleSharePhoto = async (photo: any) => {
    try {
      await Share.share({
        message: `Photo from ${gallery?.name || 'Gallery'} - Epix Visuals`,
        url: photo.url,
      });
    } catch (e) {}
  };

  // --- Preview navigation ---

  const openPreview = (photo: any, index: number) => {
    setPreviewPhoto(photo);
    setPreviewIndex(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const navigatePreview = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'next' ? previewIndex + 1 : previewIndex - 1;
    if (newIndex >= 0 && newIndex < photos.length) {
      setPreviewIndex(newIndex);
      setPreviewPhoto(photos[newIndex]);
    }
  };

  // --- Render ---

  const renderPhotoItem = ({ item, index }: { item: any; index: number }) => {
    const isSelected = selectedIds.has(item.id);
    const isCover = gallery?.cover_photo_url === item.photo_url;
    const hasUrl = !!item.url;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.photoItem,
          pressed && styles.photoItemPressed,
          isSelected && styles.photoItemSelected,
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleSelection(item.id);
          } else {
            openPreview(item, index);
          }
        }}
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
            setSelectedIds(new Set([item.id]));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }
        }}
      >
        {hasUrl ? (
          <Image
            source={{ uri: item.url }}
            style={styles.photoImage}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
            priority="low"
          />
        ) : (
          <View style={[styles.photoImage, styles.photoPlaceholder]}>
            <ImageIcon size={24} color={Colors.textMuted} />
            <Text style={styles.photoPlaceholderText}>No URL</Text>
          </View>
        )}

        {selectionMode && (
          <View style={styles.selectOverlay}>
            <View style={[styles.selectBadge, isSelected && styles.selectBadgeActive]}>
              {isSelected && <Check size={12} color="#080810" strokeWidth={3} />}
            </View>
          </View>
        )}

        {isCover && !selectionMode && (
          <View style={styles.coverBadge}>
            <Star size={10} color="#080810" fill="#080810" />
          </View>
        )}

        {!selectionMode && (
          <View style={styles.photoActions}>
            <Pressable
              style={styles.photoActionBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                handleSetCover(item.photo_url);
              }}
            >
              <Star size={12} color={isCover ? '#F59E0B' : 'rgba(255,255,255,0.6)'} fill={isCover ? '#F59E0B' : 'transparent'} />
            </Pressable>
            <Pressable
              style={styles.photoActionBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                handleSharePhoto(item);
              }}
            >
              <Share2 size={12} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        )}
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
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{gallery?.name || 'Gallery'}</Text>
          <Text style={styles.headerSub}>
            {gallery?.clients?.user_profiles?.name || gallery?.clients?.name || 'Client'}
            {' • '}
            <Text onPress={handleCopyAccessCode} style={styles.accessCodeLink}>
              {gallery?.access_code}
            </Text>
          </Text>
        </View>
        <Pressable style={styles.headerAction} onPress={handleShareGallery}>
          <Share2 size={20} color={Colors.gold} />
        </Pressable>
      </View>

      {/* Selection Bar */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <Pressable style={styles.selectionBtn} onPress={selectAll}>
            {selectedIds.size === photos.length ? (
              <CheckSquare size={18} color={Colors.gold} />
            ) : (
              <Square size={18} color={Colors.gold} />
            )}
          </Pressable>
          <Text style={styles.selectionCount}>{selectedIds.size} selected</Text>
          <View style={styles.selectionActions}>
            <Pressable style={styles.selectionActionBtn} onPress={handleBulkDelete}>
              <Trash2 size={16} color={Colors.error} />
            </Pressable>
            <Pressable
              style={styles.selectionActionBtn}
              onPress={() => { setSelectedIds(new Set()); setSelectionMode(false); }}
            >
              <X size={16} color={Colors.textMuted} />
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={photos}
        renderItem={renderPhotoItem}
        keyExtractor={item => item.id}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
        onEndReached={() => {
          if (hasMore && !loadingPhotos) setPage(p => p + 1);
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Download size={18} color={Colors.gold} />
                <Text style={styles.statValue}>{stats?.downloads_total || 0}</Text>
                <Text style={styles.statLabel}>Downloads</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Eye size={18} color={Colors.gold} />
                <Text style={styles.statValue}>{stats?.unique_viewers || 0}</Text>
                <Text style={styles.statLabel}>Views</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <ImageIcon size={18} color={Colors.gold} />
                <Text style={styles.statValue}>{photos.length}</Text>
                <Text style={styles.statLabel}>Photos</Text>
              </View>
            </View>

            {/* Actions */}
            {!selectionMode && (
              <View style={styles.actionsBar}>
                <Pressable style={styles.actionBtn} onPress={handleToggleLock}>
                  {gallery?.is_locked ? (
                    <Unlock size={16} color={Colors.success} />
                  ) : (
                    <Lock size={16} color={Colors.warning} />
                  )}
                  <Text style={styles.actionText}>{gallery?.is_locked ? 'Unlock' : 'Lock'}</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={handleSendNotification}>
                  <Send size={16} color={Colors.gold} />
                  <Text style={styles.actionText}>Notify</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={handlePromote}>
                  <Megaphone size={16} color={Colors.gold} />
                  <Text style={styles.actionText}>Promote</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleDelete}>
                  <Trash2 size={16} color={Colors.error} />
                </Pressable>
              </View>
            )}

            {/* Photo count label */}
            <View style={styles.photoLabelRow}>
              <Text style={styles.photoLabel}>Photos ({photos.length})</Text>
              {photos.length > 0 && !selectionMode && (
                <Pressable
                  style={styles.selectModeBtn}
                  onPress={() => { setSelectionMode(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <CheckSquare size={14} color={Colors.gold} />
                  <Text style={styles.selectModeText}>Select</Text>
                </Pressable>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          loadingPhotos ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.gold} />
              <Text style={styles.loadingText}>Loading photos...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <ImageIcon size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No photos yet</Text>
              <Text style={styles.emptySubtitle}>Upload photos to this gallery from the client page</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingPhotos && photos.length > 0 ? (
            <ActivityIndicator color={Colors.gold} style={{ padding: 20 }} />
          ) : null
        }
      />

      {/* Full Screen Preview Modal */}
      <Modal visible={!!previewPhoto} transparent animationType="fade">
        <View style={styles.modalContainer}>
          {/* Top bar */}
          <View style={[styles.modalTopBar, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.modalCounter}>
              {previewIndex + 1} / {photos.length}
            </Text>
            <View style={styles.modalTopActions}>
              <Pressable
                style={styles.modalActionBtn}
                onPress={() => {
                  if (previewPhoto) handleSetCover(previewPhoto.photo_url);
                }}
              >
                <Star size={20} color={Colors.gold} />
              </Pressable>
              <Pressable
                style={styles.modalActionBtn}
                onPress={() => {
                  if (previewPhoto) handleSharePhoto(previewPhoto);
                }}
              >
                <Share2 size={20} color={Colors.white} />
              </Pressable>
              <Pressable style={styles.modalActionBtn} onPress={() => setPreviewPhoto(null)}>
                <X size={24} color={Colors.white} />
              </Pressable>
            </View>
          </View>

          {/* Image */}
          {previewPhoto && (
            <Image
              source={{ uri: previewPhoto.url }}
              style={styles.fullImage}
              contentFit="contain"
              transition={200}
            />
          )}

          {/* Navigation arrows */}
          {previewIndex > 0 && (
            <Pressable style={[styles.navArrow, styles.navArrowLeft]} onPress={() => navigatePreview('prev')}>
              <ChevronLeft size={32} color="white" />
            </Pressable>
          )}
          {previewIndex < photos.length - 1 && (
            <Pressable style={[styles.navArrow, styles.navArrowRight]} onPress={() => navigatePreview('next')}>
              <ChevronRight size={32} color="white" />
            </Pressable>
          )}

          {/* Bottom info */}
          <View style={styles.modalBottomBar}>
            <Text style={styles.modalPhotoName} numberOfLines={1}>
              {previewPhoto?.file_name || `Photo ${previewIndex + 1}`}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, backgroundColor: Colors.card,
  },
  headerCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white, textAlign: 'center' },
  headerSub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  accessCodeLink: { color: Colors.gold, fontWeight: '600' },
  headerAction: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, backgroundColor: Colors.card,
  },

  // Selection bar
  selectionBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(212,175,55,0.1)', borderBottomWidth: 1, borderBottomColor: Colors.gold + '30',
  },
  selectionBtn: { padding: 4 },
  selectionCount: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600', color: Colors.white },
  selectionActions: { flexDirection: 'row', gap: 12 },
  selectionActionBtn: { padding: 6 },

  // Stats
  statsContainer: {
    flexDirection: 'row', backgroundColor: Colors.card, margin: 16, marginBottom: 8,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border },
  statValue: { fontSize: 18, fontWeight: '700', color: Colors.white },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },

  // Actions
  actionsBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: Colors.card, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnDanger: { borderColor: 'rgba(231,76,60,0.3)', backgroundColor: 'rgba(231,76,60,0.08)' },
  actionText: { fontSize: 11, fontWeight: '600', color: Colors.white },

  // Photo label
  photoLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  photoLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  selectModeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectModeText: { fontSize: 12, fontWeight: '600', color: Colors.gold },

  // Photo grid
  listContent: { paddingBottom: 40 },
  photoItem: {
    width: ITEM_SIZE, height: ITEM_SIZE,
    marginRight: SPACING, marginBottom: SPACING, position: 'relative',
  },
  photoItemPressed: { opacity: 0.8 },
  photoItemSelected: { opacity: 0.6 },
  photoImage: { width: '100%', height: '100%', backgroundColor: '#1a1a1a' },
  photoPlaceholder: {
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  photoPlaceholderText: { fontSize: 10, color: Colors.textMuted },

  selectOverlay: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'flex-start', alignItems: 'flex-end',
    padding: 4,
  },
  selectBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  selectBadgeActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },

  coverBadge: {
    position: 'absolute', top: 4, left: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.gold, justifyContent: 'center', alignItems: 'center',
  },

  photoActions: {
    position: 'absolute', bottom: 4, right: 4,
    flexDirection: 'row', gap: 4,
  },
  photoActionBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },

  // Loading/Empty
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textMuted },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' },
  modalTopBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  modalCounter: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  modalTopActions: { flexDirection: 'row', gap: 12 },
  modalActionBtn: { padding: 6 },

  fullImage: { flex: 1, width: '100%' },

  navArrow: {
    position: 'absolute', top: '50%', transform: [{ translateY: -20 }],
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  navArrowLeft: { left: 12 },
  navArrowRight: { right: 12 },

  modalBottomBar: {
    paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8,
  },
  modalPhotoName: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});
