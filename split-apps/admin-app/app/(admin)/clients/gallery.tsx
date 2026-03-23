import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, FlatList, Modal, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { 
  ArrowLeft, Trash2, Send, Lock, CreditCard, CheckCircle, XCircle, Eye, X
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { AdminService } from '@/services/admin';
import { DeliveryService } from '@/services/delivery';
import { supabase } from '@/lib/supabase';

type GalleryPhoto = {
  id: string;
  gallery_id: string;
  storage_path: string;
  url: string;
  thumbnailUrl: string;
  filename: string;
  size: number;
  uploaded_at: string;
  is_paid: boolean;
  access_code: string;
  client_name: string;
  gallery_title: string;
};

export default function ClientGalleryScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { verifyAdminGuard } = useAuth();

  const clientId = params.clientId as string;
  const clientName = params.clientName as string;

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryPhoto | null>(null);
  const PAGE_SIZE = 50;

  const loadClientPhotos = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(0);
        setHasMore(true);
      } else {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
      }
      
      const currentPage = reset ? 0 : page;

      // 0. Fetch client details (phone) - only on initial load
      if (reset) {
        const { data: client } = await supabase
          .from('clients')
          .select('phone')
          .eq('id', clientId)
          .single();
          
        if (client) setClientPhone(client.phone);
      }

      // 1. Fetch galleries for this client
      // We need gallery info for every page to map IDs, but we can cache it or just re-fetch (it's small)
      // Optimization: Fetch galleries once and store in ref or state if needed, but for now re-fetching is fine as it's fast
      const galleries = await AdminService.gallery.getByClient(clientId);
      
      if (!galleries || galleries.length === 0) {
        setPhotos([]);
        setLoading(false);
        setLoadingMore(false);
        setHasMore(false);
        return;
      }

      const galleryIds = galleries.map(g => g.id);
      const galleryMap = new Map(galleries.map(g => [g.id, g]));

      // 2. Fetch photos with pagination
      const { data: galleryPhotos, count } = await AdminService.gallery.getPhotos(
        galleryIds, 
        currentPage, 
        PAGE_SIZE
      );
      
      if (!galleryPhotos || galleryPhotos.length === 0) {
        if (reset) setPhotos([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // 3. Sign URLs for this batch (Thumbnails + Full)
      const paths = galleryPhotos.map((p: any) => p.photo_url).filter(p => !!p);
      
      if (paths.length === 0) {
        if (reset) setPhotos([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // 3. Sign URLs for this batch
      // Note: createSignedUrls (plural) does not support transform options in the current Supabase JS SDK.
      // We will use the full watermarked image for both thumbnail and full view.
      const { data: signedUrls, error: signError } = await supabase.storage
          .from('client-photos')
          .createSignedUrls(paths, 3600);

      if (signError) {
        console.error('Error signing URLs:', signError);
        if ((signError as any).message?.includes('Bucket not found')) {
             Alert.alert('Configuration Error', 'Storage bucket "client-photos" is missing.');
        }
        throw signError;
      }

      const urlMap = new Map(signedUrls?.map(s => [s.path, s.signedUrl]) || []);

      // Fetch thumbnails in parallel
      const thumbnailPromises = galleryPhotos.map(async (photo: any) => {
        const photoNameParts = photo.photo_url.split('.');
        const photoNameNoExt = photoNameParts.slice(0, -1).join('.');
        const thumbnailPath = `${photoNameNoExt}_thumb.png`;
        
        try {
          const { data: thumbData, error: thumbError } = await supabase.storage
            .from('thumbnails')
            .createSignedUrl(thumbnailPath, 3600);

          if (!thumbError && thumbData?.signedUrl) {
            console.log(`[Admin Gallery] ✓ Loaded thumbnail for ${photo.file_name}`);
            return thumbData.signedUrl;
          }
        } catch (err) {
          console.warn(`[Admin Gallery] Thumbnail not found for ${photo.file_name}`);
        }
        
        // Fallback to full image
        return urlMap.get(photo.photo_url) || '';
      });

      const thumbnailUrls = await Promise.all(thumbnailPromises);

      const mappedPhotos = galleryPhotos.map((photo: any, index: number) => {
        const gallery = galleryMap.get(photo.gallery_id);
        const url = urlMap.get(photo.photo_url) || '';
        
        return {
          id: photo.id,
          gallery_id: photo.gallery_id,
          storage_path: photo.photo_url,
          url: url,
          thumbnailUrl: thumbnailUrls[index] || url,
          filename: photo.file_name || photo.photo_url.split('/').pop() || 'photo.jpg',
          size: photo.file_size || 0,
          uploaded_at: photo.created_at,
          is_paid: gallery?.is_paid ?? false,
          access_code: gallery?.access_code ?? '',
          client_name: clientName,
          gallery_title: gallery?.name ?? 'Unknown Gallery'
        };
      });
      
      if (reset) {
        setPhotos(mappedPhotos);
      } else {
        setPhotos(prev => [...prev, ...mappedPhotos]);
      }

      setHasMore(mappedPhotos.length === PAGE_SIZE);
      setPage(currentPage + 1);

    } catch (error) {
      console.error('Error loading photos:', error);
      Alert.alert('Error', 'Failed to load photos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [clientId, clientName, page, hasMore, loadingMore]);

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotos(prev => 
      prev.includes(photoId)
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const deleteSelectedPhotos = useCallback(async () => {
    if (selectedPhotos.length === 0) return;

    Alert.alert(
      'Delete Photos',
      `Are you sure you want to delete ${selectedPhotos.length} photo(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const photosToDelete = photos.filter(p => selectedPhotos.includes(p.id));
              const paths = photosToDelete.map(p => p.storage_path);
              
              // 1. Delete from storage
              const { error: storageError } = await supabase.storage
                .from('client-photos')
                .remove(paths);
                
              if (storageError) throw storageError;

              // 2. Delete from database
              const { error: dbError } = await supabase
                .from('gallery_photos')
                .delete()
                .in('id', selectedPhotos);
                
              if (dbError) throw dbError;

              setPhotos(prev => prev.filter(photo => !selectedPhotos.includes(photo.id)));
              setSelectedPhotos([]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Photos deleted successfully');
            } catch (error) {
              console.error('Error deleting photos:', error);
              Alert.alert('Error', 'Failed to delete photos');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [selectedPhotos]);

  const resendAccessCode = useCallback(async (accessCode: string) => {
    try {
      if (!clientPhone) {
        await Clipboard.setStringAsync(accessCode);
        Alert.alert('Copied', `No phone number found for ${clientName}. Access code ${accessCode} copied to clipboard.`);
        return;
      }

      Alert.alert(
        'Send Access Code',
        `Send code ${accessCode} to ${clientName} (${clientPhone})?`,
        [
          { text: 'Copy Only', onPress: async () => {
              await Clipboard.setStringAsync(accessCode);
              Alert.alert('Copied', 'Access code copied to clipboard');
            }
          },
          { text: 'Send SMS', onPress: async () => {
              try {
                setLoading(true);
                const result = await DeliveryService.sendAccessCode(clientId, clientPhone);
                if (result.success) {
                  Alert.alert('Success', `Access code sent via ${result.method}`);
                } else {
                  Alert.alert('Failed', `Could not send code: ${result.error?.message || 'Unknown error'}`);
                }
              } catch (e: any) {
                Alert.alert('Error', e.message);
              } finally {
                setLoading(false);
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to process request');
    }
  }, [clientName, clientPhone, clientId]);

  const togglePaymentStatus = useCallback(async (photoId: string, currentStatus: boolean) => {
    try {
      const photo = photos.find(p => p.id === photoId);
      if (!photo) return;

      const newStatus = !currentStatus;
      
      // Update gallery payment status
      const { error } = await supabase
        .from('galleries')
        .update({ is_paid: newStatus })
        .eq('id', photo.gallery_id);

      if (error) throw error;

      // Update UI (all photos in this gallery)
      setPhotos(prev => prev.map(p => 
        p.gallery_id === photo.gallery_id ? { ...p, is_paid: newStatus } : p
      ));
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert('Updated', `Gallery payment status marked as ${newStatus ? 'Paid' : 'Unpaid'}`);
    } catch (error) {
      console.error('Error updating payment status:', error);
      Alert.alert('Error', 'Failed to update payment status');
    }
  }, [photos]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let mounted = true;

    (async () => {
      const ok = await verifyAdminGuard('upload_galleries');
      if (!ok) {
        if (mounted) router.replace('/admin-login');
        return;
      }
      
      if (mounted) {
        loadClientPhotos(true);
        
        unsub = AdminService.gallery.subscribeToPhotos(() => {
          // simple refresh on update
          loadClientPhotos(true);
        });
      }
    })();

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [router, verifyAdminGuard, loadClientPhotos]);

  const renderHeader = () => (
    <View>
      {/* Gallery Actions */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Gallery Management</Text>
        
        <View style={styles.actionButtons}>
          <Pressable 
            style={styles.actionButton}
            onPress={() => {
              const code = photos[0]?.access_code;
              if (!code) return;
              resendAccessCode(code);
            }}
          >
            <Send size={16} color={Colors.gold} />
            <Text style={styles.actionButtonText}>Resend Access Code</Text>
          </Pressable>

          <Pressable 
            style={styles.actionButton}
            onPress={() => {
              // Toggle gallery lock status
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Lock/Unlock', 'Gallery lock status updated');
            }}
          >
            <Lock size={16} color={Colors.warning} />
            <Text style={styles.actionButtonText}>Toggle Lock</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <Text style={styles.sectionTitle}>All Photos</Text>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 100 }} />;
    return (
      <View style={{ padding: 20, alignItems: 'center', marginBottom: 100 }}>
        <ActivityIndicator size="small" color={Colors.gold} />
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1a1a1a', '#2d2d2d']} style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </Pressable>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{clientName}’s Gallery</Text>
          <Text style={styles.headerSubtitle}>{photos.length} photos loaded</Text>
        </View>

        {selectedPhotos.length > 0 && (
          <Pressable style={styles.deleteButton} onPress={deleteSelectedPhotos}>
            <Trash2 size={18} color={Colors.error} />
            <Text style={styles.deleteButtonText}>Delete ({selectedPhotos.length})</Text>
          </Pressable>
        )}
      </LinearGradient>

      <FlatList
        data={photos}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable 
            style={[
              styles.photoCard,
              selectedPhotos.includes(item.id) && styles.photoCardSelected
            ]}
            onPress={() => togglePhotoSelection(item.id)}
            onLongPress={() => togglePhotoSelection(item.id)}
          >
            <Image 
              source={{ uri: item.thumbnailUrl }} 
              style={styles.photoImage} 
              contentFit="cover" 
              transition={200} 
              cachePolicy="memory-disk"
            />
            
            {/* Selection Indicator */}
            {selectedPhotos.includes(item.id) && (
              <View style={styles.selectionIndicator}>
                <CheckCircle size={20} color={Colors.gold} />
              </View>
            )}

            {/* Payment Status */}
            <View style={styles.paymentBadge}>
              {item.is_paid ? (
                <CheckCircle size={12} color={Colors.success} />
              ) : (
                <XCircle size={12} color={Colors.error} />
              )}
              <Text style={[
                styles.paymentText,
                { color: item.is_paid ? Colors.success : Colors.error }
              ]}>
                {item.is_paid ? 'Paid' : 'Unpaid'}
              </Text>
            </View>

            {/* Photo Info */}
            <View style={styles.photoInfo}>
              <Text style={styles.photoName} numberOfLines={1}>{item.filename}</Text>
              <Text style={styles.photoSize}>
                {(item.size / 1024 / 1024).toFixed(1)} MB
              </Text>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <Pressable 
                style={styles.quickAction}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedImage(item);
                }}
              >
                <Eye size={12} color={Colors.gold} />
              </Pressable>

              <Pressable 
                style={styles.quickAction}
                onPress={() => togglePaymentStatus(item.id, item.is_paid)}
              >
                <CreditCard size={12} color={Colors.gold} />
              </Pressable>
              
              <Pressable 
                style={styles.quickAction}
                onPress={() => resendAccessCode(item.access_code)}
              >
                <Send size={12} color={Colors.gold} />
              </Pressable>
            </View>
          </Pressable>
        )}
        contentContainerStyle={styles.photosGrid}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        onEndReached={() => loadClientPhotos(false)}
        onEndReachedThreshold={0.5}
        onRefresh={() => {
          setRefreshing(true);
          loadClientPhotos(true);
        }}
        refreshing={refreshing}
      />

      {/* Batch Operations Bar */}
      {selectedPhotos.length > 0 && (
        <View style={styles.floatingBatchBar}>
          <View style={styles.batchButtons}>
            <Pressable 
              style={[styles.batchButton, styles.markPaidButton]}
              onPress={async () => {
                try {
                  const selectedGalleryIds = [...new Set(photos
                    .filter(p => selectedPhotos.includes(p.id))
                    .map(p => p.gallery_id))];
                  
                  if (selectedGalleryIds.length === 0) return;

                  const { error } = await supabase
                    .from('galleries')
                    .update({ is_paid: true })
                    .in('id', selectedGalleryIds);
                    
                  if (error) throw error;

                  setPhotos(prev => prev.map(photo => 
                    selectedGalleryIds.includes(photo.gallery_id)
                      ? { ...photo, is_paid: true } 
                      : photo
                  ));
                  setSelectedPhotos([]);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Success', 'Selected galleries marked as paid');
                } catch (error) {
                  console.error('Error marking paid:', error);
                  Alert.alert('Error', 'Failed to update payment status');
                }
              }}
            >
              <CheckCircle size={16} color={Colors.success} />
              <Text style={styles.batchButtonText}>Mark Paid</Text>
            </Pressable>

            <Pressable 
              style={[styles.batchButton, styles.markUnpaidButton]}
              onPress={async () => {
                try {
                  const selectedGalleryIds = [...new Set(photos
                    .filter(p => selectedPhotos.includes(p.id))
                    .map(p => p.gallery_id))];
                  
                  if (selectedGalleryIds.length === 0) return;

                  const { error } = await supabase
                    .from('galleries')
                    .update({ is_paid: false })
                    .in('id', selectedGalleryIds);
                    
                  if (error) throw error;

                  setPhotos(prev => prev.map(photo => 
                    selectedGalleryIds.includes(photo.gallery_id)
                      ? { ...photo, is_paid: false } 
                      : photo
                  ));
                  setSelectedPhotos([]);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Success', 'Selected galleries marked as unpaid');
                } catch (error) {
                  console.error('Error marking unpaid:', error);
                  Alert.alert('Error', 'Failed to update payment status');
                }
              }}
            >
              <XCircle size={16} color={Colors.error} />
              <Text style={styles.batchButtonText}>Mark Unpaid</Text>
            </Pressable>
          </View>
        </View>
      )}
      {/* Full Screen Image Modal */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setSelectedImage(null)}
          />
          
          <View style={styles.modalContent}>
            {selectedImage && (
              <>
                <Image
                  source={{ uri: selectedImage.url }}
                  placeholder={{ uri: selectedImage.thumbnailUrl }}
                  style={styles.modalImage}
                  contentFit="contain"
                  transition={200}
                  cachePolicy="memory-disk"
                />
                
                <View style={styles.modalHeader}>
                  <Pressable 
                    style={styles.closeButton}
                    onPress={() => setSelectedImage(null)}
                  >
                    <X size={24} color="#fff" />
                  </Pressable>
                </View>

                <View style={styles.modalFooter}>
                  <Text style={styles.modalTitle}>{selectedImage.filename}</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedImage.gallery_title} • {(selectedImage.size / 1024 / 1024).toFixed(1)} MB
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  modalHeader: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  modalFooter: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#ccc',
    fontSize: 12,
  },
  floatingBatchBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    backgroundColor: Colors.error + '20',
    borderRadius: 8,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  actionsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  photosSection: {
    padding: 20,
  },
  photosGrid: {
    gap: 12,
    paddingBottom: 20,
  },
  photoCard: {
    flex: 1,
    margin: 6,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  photoCardSelected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold + '10',
  },
  photoImage: {
    width: '100%',
    height: 150,
    backgroundColor: Colors.border,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 4,
  },
  paymentBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  paymentText: {
    fontSize: 10,
    fontWeight: '600',
  },
  photoInfo: {
    padding: 8,
  },
  photoName: {
    fontSize: 10,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  photoSize: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  quickActions: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  quickAction: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 6,
    padding: 4,
  },
  batchSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  batchButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  batchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 8,
  },
  markPaidButton: {
    backgroundColor: Colors.success + '20',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  markUnpaidButton: {
    backgroundColor: Colors.error + '20',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  batchButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
