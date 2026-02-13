import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Image, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, Trash2, Send, Lock, CreditCard, CheckCircle, XCircle 
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

type GalleryPhoto = {
  id: string;
  url: string;
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

  const loadClientPhotos = useCallback(async () => {
    try {
      // In a real implementation, this would query your database
      // For now, we'll use mock data
      const mockPhotos: GalleryPhoto[] = [
        {
          id: '1',
          url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
          filename: 'wedding-portrait-1.jpg',
          size: 2457600,
          uploaded_at: '2024-01-15T10:30:00Z',
          is_paid: true,
          access_code: 'WED123',
          client_name: clientName,
          gallery_title: 'Wedding Day'
        },
        {
          id: '2',
          url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400',
          filename: 'wedding-ceremony-1.jpg',
          size: 3670016,
          uploaded_at: '2024-01-15T10:35:00Z',
          is_paid: false,
          access_code: 'WED123',
          client_name: clientName,
          gallery_title: 'Wedding Day'
        },
        {
          id: '3',
          url: 'https://images.unsplash.com/photo-1551836026-dac5bfc985f3?w=400',
          filename: 'reception-1.jpg',
          size: 4194304,
          uploaded_at: '2024-01-15T10:40:00Z',
          is_paid: true,
          access_code: 'WED123',
          client_name: clientName,
          gallery_title: 'Wedding Day'
        },
      ];

      setPhotos(mockPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
      Alert.alert('Error', 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [clientId, clientName]);

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
              // In a real implementation, delete from database/storage
              setPhotos(prev => prev.filter(photo => !selectedPhotos.includes(photo.id)));
              setSelectedPhotos([]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Photos deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete photos');
            }
          }
        }
      ]
    );
  }, [selectedPhotos]);

  const resendAccessCode = useCallback(async (accessCode: string) => {
    try {
      // In a real implementation, send SMS/email with access code
      await Clipboard.setStringAsync(accessCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Access Code Copied', `Access code ${accessCode} has been copied to clipboard and is ready to be sent to ${clientName}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy access code');
    }
  }, [clientName]);

  const togglePaymentStatus = useCallback(async (photoId: string, currentStatus: boolean) => {
    try {
      // In a real implementation, update payment status in database
      setPhotos(prev => prev.map(photo => 
        photo.id === photoId ? { ...photo, is_paid: !currentStatus } : photo
      ));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      Alert.alert('Error', 'Failed to update payment status');
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await verifyAdminGuard('upload_galleries');
      if (!ok) {
        router.replace('/admin-login');
        return;
      }
      loadClientPhotos();
    })();
  }, [router, verifyAdminGuard, loadClientPhotos]);

  if (loading) {
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
          <Text style={styles.headerSubtitle}>{photos.length} photos</Text>
        </View>

        {selectedPhotos.length > 0 && (
          <Pressable style={styles.deleteButton} onPress={deleteSelectedPhotos}>
            <Trash2 size={18} color={Colors.error} />
            <Text style={styles.deleteButtonText}>Delete ({selectedPhotos.length})</Text>
          </Pressable>
        )}
      </LinearGradient>

      <ScrollView style={styles.content}>
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

        {/* Photos Grid */}
        <View style={styles.photosSection}>
          <Text style={styles.sectionTitle}>All Photos</Text>
          
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
                <Image source={{ uri: item.url }} style={styles.photoImage} />
                
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
          />
        </View>

        {/* Batch Operations */}
        {selectedPhotos.length > 0 && (
          <View style={styles.batchSection}>
            <Text style={styles.sectionTitle}>Batch Operations</Text>
            
            <View style={styles.batchButtons}>
              <Pressable 
                style={[styles.batchButton, styles.markPaidButton]}
                onPress={() => {
                  // Mark selected as paid
                  setPhotos(prev => prev.map(photo => 
                    selectedPhotos.includes(photo.id) 
                      ? { ...photo, is_paid: true } 
                      : photo
                  ));
                  setSelectedPhotos([]);
                }}
              >
                <CheckCircle size={16} color={Colors.success} />
                <Text style={styles.batchButtonText}>Mark Paid</Text>
              </Pressable>

              <Pressable 
                style={[styles.batchButton, styles.markUnpaidButton]}
                onPress={() => {
                  // Mark selected as unpaid
                  setPhotos(prev => prev.map(photo => 
                    selectedPhotos.includes(photo.id) 
                      ? { ...photo, is_paid: false } 
                      : photo
                  ));
                  setSelectedPhotos([]);
                }}
              >
                <XCircle size={16} color={Colors.error} />
                <Text style={styles.batchButtonText}>Mark Unpaid</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  content: {
    flex: 1,
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
