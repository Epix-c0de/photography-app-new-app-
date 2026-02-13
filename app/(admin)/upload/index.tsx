import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Switch, 
  Alert, Platform, KeyboardAvoidingView, Image, Dimensions, ActivityIndicator,
  FlatList 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
// import { FlashList } from '@shopify/flash-list';
import { useNetInfo } from '@react-native-community/netinfo';
import * as Clipboard from 'expo-clipboard';
import { 
  Cloud, CloudOff, User, Phone, Image as ImageIcon, Check, X, 
  Calendar, CreditCard, Shield, Send, ArrowLeft, Camera, FileText, 
  RefreshCw, Copy, Wifi, WifiOff, Trash2, Smartphone, AlertTriangle 
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');

// Types
type ShootType = 'wedding' | 'portrait' | 'event' | 'commercial';

interface Client {
  id: string;
  name: string;
  phone: string;
  lastShoot?: string;
  totalGalleries: number;
}

interface Photo {
  id: string;
  uri: string;
  size?: number; // bytes
}

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const netInfo = useNetInfo();
  const { verifyAdminGuard } = useAuth();
  const [accessReady, setAccessReady] = useState<boolean>(false);
  
  // State: Mode
  const [outdoorMode, setOutdoorMode] = useState(false);
  
  // State: Client
  const [phoneNumber, setPhoneNumber] = useState('');
  const [clientData, setClientData] = useState<Client | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [checkingClient, setCheckingClient] = useState(false);
  
  // State: Gallery
  const [galleryTitle, setGalleryTitle] = useState('');
  const [shootType, setShootType] = useState<ShootType>('portrait');
  const [notes, setNotes] = useState('');
  const [delayedDelivery, setDelayedDelivery] = useState(false);
  const [releaseDate, setReleaseDate] = useState(new Date());
  
  // State: Photos
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  
  // State: Settings
  const [isPaid, setIsPaid] = useState(false);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.5);
  const [accessCode, setAccessCode] = useState('');
  const [sendNotificationAfterUpload, setSendNotificationAfterUpload] = useState(true);
  const [requirePaymentBeforeDownload, setRequirePaymentBeforeDownload] = useState(true);
  
  // State: Status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const generateAccessCode = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAccessCode(code);
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await verifyAdminGuard('upload_galleries');
      if (!ok) {
        router.replace('/admin-login');
        return;
      }
      setAccessReady(true);
    })();
  }, [router, verifyAdminGuard]);

  // Generate Access Code on mount
  useEffect(() => {
    generateAccessCode();
  }, [generateAccessCode]);

  // Mock Client Detection
  useEffect(() => {
    if (phoneNumber.length >= 10) {
      checkClient(phoneNumber);
    } else {
      setClientData(null);
      setIsNewClient(false);
    }
  }, [phoneNumber]);

  if (!accessReady) {
    return <View style={styles.container} />;
  }

  const copyAccessCode = async () => {
    await Clipboard.setStringAsync(accessCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Access code copied to clipboard');
  };

  const checkClient = async (phone: string) => {
    try {
      setCheckingClient(true);
      const { data, error } = await (AdminService as any);
      const { data: client, error: cError } = await (AdminService as any).clients.list();
      if (cError) {
        setIsNewClient(true);
        setClientData(null);
        return;
      }
      const found = (client as any[]).find((c) => c.phone === phone);
      if (found) {
        setClientData({
          id: found.id,
          name: found.name || 'Client',
          phone: found.phone || phone,
          lastShoot: undefined,
          totalGalleries: 0,
        });
        setIsNewClient(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setClientData(null);
        setIsNewClient(true);
      }
    } catch {
      setClientData(null);
      setIsNewClient(true);
    } finally {
      setCheckingClient(false);
    }
  };

  const pickImages = async () => {
    setIsPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 50,
      });

      if (!result.canceled) {
        const newPhotos = result.assets.map(asset => ({
          id: asset.assetId || Math.random().toString(),
          uri: asset.uri,
          size: asset.fileSize
        }));
        setPhotos(prev => [...prev, ...newPhotos]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick images');
    } finally {
      setIsPicking(false);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUpload = async () => {
    if (!phoneNumber) {
      Alert.alert('Missing Info', 'Please enter a client phone number.');
      return;
    }
    if (photos.length === 0 && !outdoorMode) {
      Alert.alert('No Photos', 'Please select at least one photo.');
      return;
    }

    setIsUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      let clientId = clientData?.id;
      if (!clientId) {
        const newClient = await AdminService.clients.create({
          name: clientData?.name || phoneNumber,
          phone: phoneNumber,
          email: undefined,
          notes
        } as any);
        clientId = newClient.id;
      }

      const galleryName = galleryTitle || `${shootType.charAt(0).toUpperCase() + shootType.slice(1)} ${new Date().getFullYear()}`;
      const scheduledRelease = delayedDelivery ? releaseDate.toISOString() : undefined;

      const gallery = await AdminService.gallery.create({
        clientId,
        name: galleryName,
        price: 0,
        shootType,
        scheduledRelease,
        accessCode,
        watermarkEnabled: !isPaid,
        isPaid,
        status: 'locked'
      });

      const totalUploads = photos.length; // pipeline generates variants
      let completed = 0;
      const updateProgress = () => {
        completed += 1;
        const progress = Math.min(1, completed / Math.max(1, totalUploads));
        setUploadProgress(progress);
      };

      for (const photo of photos) {
        await AdminService.gallery.uploadPhoto(gallery.id, photo);
        updateProgress();
      }

      if (sendNotificationAfterUpload) {
        const { data: clientRow, error: clientFetchError } = await (supabase as any)
          .from('clients')
          .select('user_id, name')
          .eq('id', clientId)
          .single();
        if (!clientFetchError && clientRow?.user_id) {
          await AdminService.notifications.create(clientRow.user_id, {
            type: 'gallery_uploaded',
            title: 'Your Photos Are Ready!',
            body: `Hello ${clientRow.name || 'Client'}, your ${shootType} photos are now available.`,
            data: { galleryId: gallery.id }
          });
        }
      }

      setIsUploading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Gallery created and photos uploaded!');
      router.back();
    } catch (error: any) {
      setIsUploading(false);
      Alert.alert('Upload Failed', error?.message || 'An error occurred during upload.');
    }
  };

  // Render Helpers
  const renderPhotoItem = ({ item }: { item: Photo }) => (
    <View style={styles.photoItem}>
      <Image source={{ uri: item.uri }} style={styles.photoThumb} />
      <Pressable 
        style={styles.removePhotoBtn}
        onPress={() => removePhoto(item.id)}
      >
        <X size={12} color="#FFF" />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.white} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Upload Client Photos</Text>
          <Text style={styles.headerSub}>Create or update gallery</Text>
        </View>
        <View style={[styles.statusBadge, !netInfo.isConnected && styles.statusBadgeOffline]}>
          {netInfo.isConnected ? (
            <Wifi size={14} color={Colors.success} />
          ) : (
            <WifiOff size={14} color={Colors.error} />
          )}
          <Text style={[styles.statusText, !netInfo.isConnected && styles.statusTextOffline]}>
            {netInfo.isConnected ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Outdoor Mode Toggle */}
          <View style={styles.modeToggleContainer}>
            <View style={styles.modeInfo}>
              <Cloud size={20} color={outdoorMode ? Colors.gold : Colors.textMuted} />
              <View>
                <Text style={[styles.modeTitle, outdoorMode && { color: Colors.gold }]}>Outdoor Shoot Mode</Text>
                <Text style={styles.modeSub}>Field optimized, offline-first</Text>
              </View>
            </View>
            <Switch
              value={outdoorMode}
              onValueChange={setOutdoorMode}
              trackColor={{ false: '#333', true: Colors.gold }}
              thumbColor="#FFF"
            />
          </View>



          {/* Client Identification */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CLIENT IDENTIFICATION</Text>
            <View style={styles.inputWrapper}>
              <Phone size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Client Phone Number"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                autoFocus={true}
              />
              {checkingClient && <ActivityIndicator size="small" color={Colors.gold} />}
            </View>

            {clientData && (
              <View style={styles.clientCard}>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{clientData.name}</Text>
                  <Text style={styles.clientMeta}>Last shoot: {clientData.lastShoot} • {clientData.totalGalleries} galleries</Text>
                </View>
                <View style={styles.clientBadge}>
                  <Check size={14} color={Colors.background} />
                  <Text style={styles.clientBadgeText}>Found</Text>
                </View>
              </View>
            )}
            
            {isNewClient && !checkingClient && phoneNumber.length >= 10 && (
              <View style={styles.newClientCard}>
                <UserPlusBadge />
                <Text style={styles.newClientText}>New client will be created automatically</Text>
              </View>
            )}
          </View>

          {/* Gallery Setup (Hidden in Outdoor Mode) */}
          {!outdoorMode && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>GALLERY DETAILS</Text>
                <View style={styles.inputWrapper}>
                  <FileText size={20} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={`Title (e.g., Wedding - ${new Date().getFullYear()})`}
                    placeholderTextColor={Colors.textMuted}
                    value={galleryTitle}
                    onChangeText={setGalleryTitle}
                  />
                </View>
                
                <View style={styles.typeSelector}>
                  {(['wedding', 'portrait', 'event', 'commercial'] as ShootType[]).map((type) => (
                    <Pressable
                      key={type}
                      style={[styles.typeChip, shootType === type && styles.typeChipActive]}
                      onPress={() => {
                        setShootType(type);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={[styles.typeText, shootType === type && styles.typeTextActive]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PHOTOS ({photos.length})</Text>
                <Pressable 
                  style={styles.uploadArea}
                  onPress={pickImages}
                >
                  <Camera size={32} color={Colors.gold} />
                  <Text style={styles.uploadText}>Tap to select photos</Text>
                  <Text style={styles.uploadSub}>Supports multi-select</Text>
                </Pressable>
                
                {photos.length > 0 && (
                  <View style={styles.photoList}>
                    <FlatList
                      data={photos}
                      renderItem={renderPhotoItem}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingVertical: 10 }}
                    />
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SETTINGS & AUTOMATION</Text>
                
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <CreditCard size={18} color={isPaid ? Colors.success : Colors.textMuted} />
                    <Text style={styles.settingLabel}>Payment Status</Text>
                  </View>
                  <Pressable 
                    onPress={() => setIsPaid(!isPaid)}
                    style={[styles.toggleBtn, isPaid && styles.toggleBtnActive]}
                  >
                    <Text style={styles.toggleText}>{isPaid ? 'PAID' : 'UNPAID'}</Text>
                  </Pressable>
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Send size={18} color={sendNotificationAfterUpload ? Colors.gold : Colors.textMuted} />
                    <Text style={styles.settingLabel}>Send Notification After Upload</Text>
                  </View>
                  <Switch
                    value={sendNotificationAfterUpload}
                    onValueChange={setSendNotificationAfterUpload}
                    trackColor={{ false: '#333', true: Colors.gold }}
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <AlertTriangle size={18} color={requirePaymentBeforeDownload ? Colors.gold : Colors.textMuted} />
                    <Text style={styles.settingLabel}>Require Payment Before Download</Text>
                  </View>
                  <Switch
                    value={requirePaymentBeforeDownload}
                    onValueChange={setRequirePaymentBeforeDownload}
                    trackColor={{ false: '#333', true: Colors.gold }}
                  />
                </View>

                {!isPaid && (
                  <View style={styles.watermarkConfig}>
                    <Shield size={16} color={Colors.gold} style={{ marginRight: 8 }} />
                    <Text style={styles.watermarkText}>Watermark enabled for unpaid gallery</Text>
                  </View>
                )}

                <View style={styles.divider} />

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Calendar size={18} color={Colors.textMuted} />
                    <Text style={styles.settingLabel}>Delayed Release</Text>
                  </View>
                  <Switch
                    value={delayedDelivery}
                    onValueChange={setDelayedDelivery}
                    trackColor={{ false: '#333', true: Colors.gold }}
                  />
                </View>

                <View style={styles.divider} />
                
                <View style={styles.accessCodeContainer}>
                  <View>
                    <Text style={styles.accessCodeLabel}>ACCESS CODE</Text>
                    <Text style={styles.accessCodeValue}>{accessCode}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Pressable style={styles.iconBtn} onPress={generateAccessCode}>
                      <RefreshCw size={20} color={Colors.textMuted} />
                    </Pressable>
                    <Pressable style={styles.iconBtn} onPress={copyAccessCode}>
                      <Copy size={20} color={Colors.gold} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* SMS Preview */}
          <View style={styles.smsPreview}>
            <Smartphone size={16} color={Colors.textMuted} />
            <Text style={styles.smsText} numberOfLines={2}>
              SMS: Hello {clientData?.name || '{Client}'}, your photos are ready! Code: {accessCode}. View at lenzart.com
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable 
              style={[
                styles.primaryBtn, 
                (!phoneNumber || (photos.length === 0 && !outdoorMode)) && styles.primaryBtnDisabled
              ]}
              onPress={handleUpload}
              disabled={isUploading || (!phoneNumber || (photos.length === 0 && !outdoorMode))}
            >
              {isUploading ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <LinearGradient
                  colors={(!phoneNumber || (photos.length === 0 && !outdoorMode)) ? ['#333', '#333'] : [Colors.gold, Colors.goldDark]}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              {!isUploading && (
                <Text style={styles.primaryBtnText}>
                  {outdoorMode ? 'Save Shoot & Sync Later' : 'Upload & Create Gallery'}
                </Text>
              )}
            </Pressable>
            
            <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function UserPlusBadge() {
  return (
    <View style={styles.iconBadge}>
      <User size={14} color={Colors.gold} />
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
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  statusBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.2)',
  },
  statusBadgeOffline: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderColor: 'rgba(231, 76, 60, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  statusTextOffline: {
    color: Colors.error,
  },
  scrollContent: {
    padding: 20,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  modeSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 12,
    letterSpacing: 1,
  },
  toolsGrid: {
    gap: 12,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toolIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  toolContent: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  toolSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: Colors.white,
    fontSize: 16,
    height: '100%',
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  clientInfo: {},
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 4,
  },
  clientMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  clientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clientBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.background,
  },
  newClientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 12,
  },
  newClientText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  typeText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  typeTextActive: {
    color: Colors.background,
    fontWeight: '700',
  },
  uploadArea: {
    height: 140,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gold,
    marginTop: 12,
    marginBottom: 4,
  },
  uploadSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  photoList: {
    height: 80,
  },
  photoItem: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: Colors.white,
    fontWeight: '500',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  toggleBtnActive: {
    backgroundColor: Colors.success,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  watermarkConfig: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  watermarkText: {
    fontSize: 13,
    color: Colors.gold,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  accessCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accessCodeLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '700',
    marginBottom: 4,
  },
  accessCodeValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  smsText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
  },
  secondaryBtn: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
