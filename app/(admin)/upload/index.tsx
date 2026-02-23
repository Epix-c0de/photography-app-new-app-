import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Switch, 
  Alert, Platform, KeyboardAvoidingView, Image, Dimensions, ActivityIndicator,
  FlatList, TouchableOpacity 
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useNetInfo } from '@react-native-community/netinfo';
import * as Clipboard from 'expo-clipboard';
import { 
  Cloud, CloudOff, User, Phone, Image as ImageIcon, Check, X, 
  Calendar, CreditCard, Shield, Send, ArrowLeft, Camera, FileText, 
  Copy, Wifi, WifiOff, Trash2, Smartphone, AlertTriangle,
  MessageCircle, Mail, Upload, Download, Eye, EyeOff, Hash, DollarSign, Search, ChevronDown, ChevronUp
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');

// Types
type ShootType = 'wedding' | 'portrait' | 'event' | 'commercial' | 'family' | 'maternity' | 'newborn' | 'boudoir';

type DeliveryMethod = 'sms' | 'whatsapp' | 'email' | 'in_app';

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  lastShoot?: string;
  totalGalleries: number;
}

interface Photo {
  id: string;
  uri: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
}

interface UploadProgress {
  total: number;
  completed: number;
  currentFile?: string;
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
  const [temporaryClientName, setTemporaryClientName] = useState('');
  const [email, setEmail] = useState('');
  const [clientData, setClientData] = useState<Client | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [checkingClient, setCheckingClient] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [isClientListExpanded, setIsClientListExpanded] = useState(true);
  
  // State: Gallery
  const [galleryTitle, setGalleryTitle] = useState('');
  const [shootType, setShootType] = useState<ShootType>('portrait');
  const [notes, setNotes] = useState('');
  const [delayedDelivery, setDelayedDelivery] = useState(false);
  const [releaseDate, setReleaseDate] = useState(new Date());
  const [price, setPrice] = useState('');
  
  // State: Photos
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  
  // State: Delivery Methods
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(['sms', 'in_app']);
  const [customMessage, setCustomMessage] = useState('');
  const [showSmsPreview, setShowSmsPreview] = useState(true);
  
  // State: Settings
  const [isPaid, setIsPaid] = useState(false);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.5);
  const [accessCode, setAccessCode] = useState('');
  const [sendNotificationAfterUpload, setSendNotificationAfterUpload] = useState(true);
  const [requirePaymentBeforeDownload, setRequirePaymentBeforeDownload] = useState(true);
  
  // State: Status
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ total: 0, completed: 0 });
  const [uploadStatus, setUploadStatus] = useState('');

  const normalizePhone = (value: string) => value.replace(/[^\d+]/g, '');

  const generateLocalAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 6 + Math.floor(Math.random() * 3);
    let code = '';
    for (let i = 0; i < length; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const loadClients = useCallback(async () => {
    try {
      setLoadingClients(true);
      setCheckingClient(true);
      const list = await AdminService.clients.list();
      const mapped = (list || []).map((client: any) => ({
        id: client.id,
        name: client.name || 'Client',
        phone: client.phone || '',
        email: client.email || undefined,
        lastShoot: client.last_shoot_date || undefined,
        totalGalleries: 0
      }));
      setClients(mapped);
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoadingClients(false);
      setCheckingClient(false);
    }
  }, []);

  const checkClient = useCallback((phone: string) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      setClientData(null);
      setIsNewClient(false);
      return;
    }
    const found = clients.find((client) => normalizePhone(client.phone || '') === normalizedPhone);
    if (found) {
      setClientData(found);
      setIsNewClient(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setClientData(null);
      setIsNewClient(true);
    }
  }, [clients]);

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


  useEffect(() => {
    if (phoneNumber.length >= 10) {
      checkClient(phoneNumber);
    } else {
      setClientData(null);
      setIsNewClient(false);
    }
  }, [phoneNumber, checkClient]);

  useEffect(() => {
    if (!accessReady) return;
    loadClients();
  }, [accessReady, loadClients]);

  const copyAccessCode = async () => {
    if (!accessCode) {
      Alert.alert('No Access Code', 'Access code is available after a successful upload.');
      return;
    }
    await Clipboard.setStringAsync(accessCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Access code copied to clipboard');
  };

  const selectClient = (client: Client) => {
    setClientData(client);
    setPhoneNumber(client.phone || '');
    setEmail(client.email || '');
    setIsNewClient(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const createClientFromPhone = async () => {
    if (!phoneNumber || creatingClient) return;
    try {
      setCreatingClient(true);
      const newClient = await AdminService.clients.create({
        name: clientData?.name || phoneNumber,
        phone: phoneNumber,
        email: email || undefined,
        notes
      } as any);
      const mapped: Client = {
        id: newClient.id,
        name: newClient.name || phoneNumber,
        phone: newClient.phone || phoneNumber,
        email: newClient.email || undefined,
        lastShoot: undefined,
        totalGalleries: 0
      };
      setClients(prev => [mapped, ...prev.filter(c => c.id !== mapped.id)]);
      setClientData(mapped);
      setIsNewClient(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert('Client Creation Failed', error?.message || 'Unable to create client.');
    } finally {
      setCreatingClient(false);
    }
  };

  const normalizedClientSearch = clientSearch.trim().toLowerCase();
  const filteredClients = normalizedClientSearch
    ? clients.filter(client =>
        client.name.toLowerCase().includes(normalizedClientSearch) ||
        normalizePhone(client.phone || '').includes(normalizedClientSearch)
      )
    : clients.slice(0, 6);
  const selectedClientCount = clientData ? 1 : 0;
  const selectedClientLabel = `${selectedClientCount} client${selectedClientCount === 1 ? '' : 's'} selected`;

  const pickImages = async () => {
    setIsPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const hasAccess = permission.status === 'granted' || permission.accessPrivileges === 'limited';
      if (!hasAccess) {
        Alert.alert('Permission Required', 'Please grant photo library access to select images.');
        return;
      }

      const mimeFromExtension = (extension: string) => {
        const ext = extension.toLowerCase();
        const map: Record<string, string> = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          heic: 'image/heic',
          heif: 'image/heif',
          tiff: 'image/tiff',
          tif: 'image/tiff',
          bmp: 'image/bmp',
          gif: 'image/gif',
          dng: 'image/x-adobe-dng',
          cr2: 'image/x-canon-cr2',
          cr3: 'image/x-canon-cr3',
          nef: 'image/x-nikon-nef',
          arw: 'image/x-sony-arw',
          raf: 'image/x-fuji-raf',
          orf: 'image/x-olympus-orf',
          rw2: 'image/x-panasonic-rw2',
          pef: 'image/x-pentax-pef',
          sr2: 'image/x-sony-sr2',
          srw: 'image/x-samsung-srw',
          '3fr': 'image/x-hasselblad-3fr'
        };
        return map[ext] || null;
      };

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
        exif: true,
        selectionLimit: 100,
      });

      if (result.canceled || !result.assets?.length) {
        Alert.alert('No Photos Selected', 'Please choose at least one photo to upload.');
        return;
      }

      if (result.assets?.length) {
        const newPhotos = (
          await Promise.all(
            result.assets.map(async (asset) => {
              if (!asset.uri) return null;
              if (asset.type === 'video') return null;
              let fileSize = asset.fileSize || 0;
              if (!fileSize) {
                try {
                  const fileInfo = await FileSystem.getInfoAsync(asset.uri);
                  fileSize = fileInfo.exists ? (fileInfo as any).size || 0 : 0;
                } catch {
                  fileSize = 0;
                }
              }
              const fileName = asset.fileName || asset.uri.split('/').pop() || `photo_${Date.now()}`;
              const extension = fileName.split('.').pop() || '';
              const mimeType = asset.mimeType || mimeFromExtension(extension) || 'application/octet-stream';

              return {
                id: asset.assetId || Math.random().toString(),
                uri: asset.uri,
                fileName: fileName,
                fileSize: fileSize,
                mimeType: mimeType,
                width: asset.width,
                height: asset.height
              };
            })
          )
        ).filter(Boolean) as Photo[];

        if (!newPhotos.length) {
          Alert.alert('No Valid Photos', 'We could not process the selected photos.');
          return;
        }

        setPhotos(prev => [...prev, ...newPhotos]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to pick images');
    } finally {
      setIsPicking(false);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleDeliveryMethod = (method: DeliveryMethod) => {
    setDeliveryMethods(prev => 
      prev.includes(method)
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTotalFileSize = () => {
    return photos.reduce((total, photo) => total + photo.fileSize, 0);
  };

  const resolveClientName = () => {
    return (
      temporaryClientName.trim()
      || clientData?.name
      || phoneNumber.trim()
      || email.trim()
      || 'Client'
    );
  };

  const applyTemplate = (template: string, values: Record<string, string>) => {
    return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
  };

  const uploadGalleryPhotosWithConcurrency = async (
    galleryId: string,
    clientId: string,
    items: Photo[],
    concurrency: number
  ) => {
    let completed = 0;
    const total = items.length;
    let index = 0;

    const worker = async () => {
      while (index < total) {
        const currentIndex = index;
        index += 1;
        const photo = items[currentIndex];

        setUploadProgress(prev => ({
          total,
          completed: prev.completed,
          currentFile: `Uploading ${currentIndex + 1}/${total}: ${photo.fileName}`
        }));

        await AdminService.gallery.uploadPhoto(galleryId, clientId, photo, currentIndex + 1);

        completed += 1;
        setUploadProgress(prev => ({
          total,
          completed,
          currentFile: prev.currentFile
        }));
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
    await Promise.all(workers);
  };

  const uploadTempPhotosWithConcurrency = async (
    temporaryName: string,
    temporaryIdentifier: string | null,
    accessCode: string,
    items: Photo[],
    concurrency: number
  ) => {
    let completed = 0;
    const total = items.length;
    let index = 0;

    const worker = async () => {
      while (index < total) {
        const currentIndex = index;
        index += 1;
        const photo = items[currentIndex];

        setUploadProgress(prev => ({
          total,
          completed: prev.completed,
          currentFile: `Uploading ${currentIndex + 1}/${total}: ${photo.fileName}`
        }));

        await AdminService.tempUploads.uploadPhoto({
          temporaryName,
          temporaryIdentifier,
          accessCode,
          file: photo,
          uploadOrder: currentIndex + 1
        });

        completed += 1;
        setUploadProgress(prev => ({
          total,
          completed,
          currentFile: prev.currentFile
        }));
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
    await Promise.all(workers);
  };

  const handleTemporaryUpload = async () => {
    const resolvedName = resolveClientName();
    if (!resolvedName) {
      Alert.alert('Missing Info', 'Please enter a temporary client name.');
      return;
    }
    if (photos.length === 0 && !outdoorMode) {
      Alert.alert('No Photos', 'Please select at least one photo.');
      return;
    }

    const tempAccessCode = generateLocalAccessCode();
    const normalizedIdentifier = normalizePhone(phoneNumber) || (email || '').trim().toLowerCase() || null;
    const totalPhotos = photos.length;

    setUploadProgress({ total: totalPhotos, completed: 0, currentFile: '' });
    setUploadStatus('Uploading temporary photos...');

    await uploadTempPhotosWithConcurrency(
      resolvedName,
      normalizedIdentifier,
      tempAccessCode,
      photos,
      3
    );

    setAccessCode(tempAccessCode);
    setIsUploading(false);
    setUploadStatus('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Temporary Upload Ready', `Share this access code with the client: ${tempAccessCode}`);
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

    const totalPhotos = photos.length;
    setIsUploading(true);
    setUploadProgress({ total: totalPhotos, completed: 0, currentFile: '' });
    setUploadStatus('Creating client and gallery...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      // 1. Create or find client
      let clientId = clientData?.id;
      if (!clientId) {
        setUploadStatus('Creating new client...');
        const resolvedName = resolveClientName();
        const newClient = await AdminService.clients.create({
          name: resolvedName,
          phone: phoneNumber,
          email: email || undefined,
          notes
        } as any);
        clientId = newClient.id;
      }

      // 2. Create gallery
      setUploadStatus('Creating gallery...');
      const galleryName = galleryTitle || `${shootType.charAt(0).toUpperCase() + shootType.slice(1)} ${new Date().getFullYear()}`;
      const scheduledRelease = delayedDelivery ? releaseDate.toISOString() : undefined;

      const gallery = await AdminService.gallery.create({
        clientId,
        name: galleryName,
        price: price ? parseFloat(price) : 0,
        shootType,
        scheduledRelease,
        watermarkEnabled: !isPaid,
        isPaid: isPaid,
        status: isPaid ? 'unlocked' : 'locked'
      });

      // 3. Upload photos
      setUploadStatus('Uploading photos...');

      await uploadGalleryPhotosWithConcurrency(gallery.id, clientId, photos, 3);

      // 4. Send notifications
      if (sendNotificationAfterUpload && deliveryMethods.length > 0) {
        setUploadStatus('Sending notifications...');
        
        const { data: clientRow, error: clientFetchError } = await supabase
          .from('clients')
          .select('user_id, name, phone, email')
          .eq('id', clientId)
          .single();

        if (!clientFetchError && clientRow) {
          let resolvedUserId = clientRow.user_id;
          if (!resolvedUserId && clientRow.phone) {
            const { data: profileMatch } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('phone', clientRow.phone)
              .maybeSingle();
            if (profileMatch?.id) {
              await supabase
                .from('clients')
                .update({ user_id: profileMatch.id })
                .eq('id', clientId);
              resolvedUserId = profileMatch.id;
            }
          }

          const resolvedName = clientRow.name || resolveClientName();
          const templateValues = {
            Client: resolvedName,
            Name: resolvedName,
            Code: gallery.access_code,
            AccessCode: gallery.access_code,
            Gallery: galleryName,
            ShootType: shootType
          };
          const registeredMessage = `Hello ${resolvedName}, your ${shootType} photos are ready! Access code: ${gallery.access_code}. View at epixvisualsstudios.co`;
          const newClientMessage = `Welcome ${resolvedName}, your ${shootType} photos are ready! Download the app and use access code ${gallery.access_code} at epixvisualsstudios.co`;
          const baseMessage = resolvedUserId ? registeredMessage : newClientMessage;
          const notificationMessage = customMessage
            ? applyTemplate(customMessage, templateValues)
            : baseMessage;

          // Create notification record only if client has a user_id
          if (resolvedUserId) {
            await supabase.from('notifications').insert({
              user_id: resolvedUserId,
              type: 'photo_gallery_ready',
              title: 'Your Photos Are Ready!',
              body: notificationMessage,
              access_code: gallery.access_code,
              gallery_id: gallery.id,
              client_id: clientId,
              data: { 
                galleryId: gallery.id,
                accessCode: gallery.access_code,
                clientName: clientRow.name,
                galleryTitle: galleryName
              },
              sent_status: 'sent'
            });
          }

          // Send via selected delivery methods
          if (deliveryMethods.includes('sms') && clientRow.phone) {
            // Send SMS via edge function
            const { error } = await supabase.functions.invoke('send_sms', {
              body: {
                phoneNumber: clientRow.phone,
                message: notificationMessage
              }
            });
            if (error) {
              console.error('Failed to send SMS:', error);
            }
          }

          if (deliveryMethods.includes('whatsapp') && clientRow.phone) {
            // WhatsApp integration would go here
            console.log('WhatsApp notification would be sent to:', clientRow.phone);
          }

          if (deliveryMethods.includes('email') && clientRow.email) {
            // Email integration would go here
            console.log('Email notification would be sent to:', clientRow.email);
          }
        }
      }

      setAccessCode(gallery.access_code);
      setIsUploading(false);
      setUploadStatus('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Success!', 
        `Gallery created with ${photos.length} photos!${deliveryMethods.includes('sms') ? ' SMS sent.' : ''}`,
        [
          {
            text: 'View Gallery',
            onPress: () => router.push({
              pathname: '/(admin)/clients/gallery',
              params: { 
                clientId: clientId,
                clientName: clientData?.name || 'Client'
              }
            })
          },
          {
            text: 'Done',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error: any) {
      const message = error?.message || '';
      const status = error?.status || error?.code;
      const lowerMessage = message.toLowerCase();
      const isAuthError = message.includes('Not authenticated')
        || message.includes('Auth session missing')
        || status === 401;

      if (isAuthError) {
        try {
          await handleTemporaryUpload();
          return;
        } catch (tempError: any) {
          setIsUploading(false);
          setUploadStatus('');
          Alert.alert('Temporary Upload Failed', tempError?.message || 'Unable to create a temporary upload.');
          return;
        }
      }

      let friendlyMessage = message || 'An error occurred during upload.';
      if (lowerMessage.includes('bucket') && lowerMessage.includes('not found')) {
        friendlyMessage = 'Storage bucket "client-photos" is missing. Please create it in Supabase Storage.';
      } else if (lowerMessage.includes('row-level security') || lowerMessage.includes('permission denied') || status === 403) {
        friendlyMessage = 'Upload blocked by permissions. Ensure the admin profile exists and storage policies allow admin uploads.';
      } else if (lowerMessage.includes('42p17') || lowerMessage.includes('infinite recursion')) {
        friendlyMessage = 'Upload blocked by a recursive RLS policy. Apply the gallery_photos policy fix migration.';
      } else if (lowerMessage.includes('schema cache') || lowerMessage.includes('does not exist')) {
        friendlyMessage = 'Required database tables are missing. Run the latest Supabase migrations.';
      }

      setIsUploading(false);
      setUploadStatus('');
      Alert.alert('Upload Failed', friendlyMessage);
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

  if (!accessReady) {
    return <View style={styles.container} />;
  }

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

            <View style={styles.inputWrapper}>
              <User size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Temporary Client Name"
                placeholderTextColor={Colors.textMuted}
                value={temporaryClientName}
                onChangeText={setTemporaryClientName}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Search size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Search clients by name or phone"
                placeholderTextColor={Colors.textMuted}
                value={clientSearch}
                onChangeText={setClientSearch}
              />
              {loadingClients && <ActivityIndicator size="small" color={Colors.gold} />}
            </View>

            <View style={styles.clientsHeader}>
              <Text style={styles.clientsHeaderText}>Clients</Text>
              <View style={styles.clientsHeaderRight}>
                <View style={styles.clientCountBadge}>
                  <Text style={styles.clientCountText}>{selectedClientLabel}</Text>
                </View>
                <Pressable
                  onPress={() => setIsClientListExpanded(prev => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={isClientListExpanded ? 'Collapse clients list' : 'Expand clients list'}
                  accessibilityState={{ expanded: isClientListExpanded }}
                  accessibilityHint="Toggles the clients list visibility"
                >
                  {isClientListExpanded ? (
                    <ChevronUp size={18} color={Colors.textMuted} />
                  ) : (
                    <ChevronDown size={18} color={Colors.textMuted} />
                  )}
                </Pressable>
              </View>
            </View>

            <View
              style={[
                styles.clientsCollapsible,
                !isClientListExpanded && styles.clientsCollapsibleCollapsed
              ]}
              nativeID="clients-list-collapsible"
              accessibilityElementsHidden={!isClientListExpanded}
              pointerEvents={isClientListExpanded ? 'auto' : 'none'}
            >
              {filteredClients.length > 0 && (
                <View style={styles.clientList}>
                  {filteredClients.map((client) => (
                    <Pressable
                      key={client.id}
                      style={styles.clientListItem}
                      onPress={() => selectClient(client)}
                    >
                      <View>
                        <Text style={styles.clientListName}>{client.name}</Text>
                        <Text style={styles.clientListPhone}>{client.phone || 'No phone'}</Text>
                      </View>
                      <Text style={styles.clientListAction}>Use</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {normalizedClientSearch.length > 0 && filteredClients.length === 0 && (
                <View style={styles.clientEmpty}>
                  <Text style={styles.clientEmptyText}>No matching clients</Text>
                </View>
              )}
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

                {/* Price Input */}
                <View style={styles.inputWrapper}>
                  <DollarSign size={20} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Price (optional)"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    value={price}
                    onChangeText={setPrice}
                  />
                </View>
              </View>
            )}
            
            {isNewClient && !checkingClient && phoneNumber.length >= 10 && (
              <View style={styles.newClientCard}>
                <UserPlusBadge />
                <View style={styles.newClientInfo}>
                  <Text style={styles.newClientText}>No client found for this number</Text>
                  <Pressable
                    style={[styles.createClientBtn, creatingClient && styles.createClientBtnDisabled]}
                    onPress={createClientFromPhone}
                    disabled={creatingClient}
                  >
                    <Text style={styles.createClientBtnText}>{creatingClient ? 'Creating...' : 'Create Client'}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Client Email (for new clients) */}
            {isNewClient && (
              <View style={styles.inputWrapper}>
                <Mail size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Client Email (optional)"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
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
                <Text style={styles.sectionLabel}>PHOTOS ({photos.length}) • {formatFileSize(getTotalFileSize())}</Text>
                <Pressable 
                  style={styles.uploadArea}
                  onPress={pickImages}
                  disabled={isPicking}
                >
                  {isPicking ? (
                    <ActivityIndicator size="small" color={Colors.gold} />
                  ) : (
                    <>
                      <Camera size={32} color={Colors.gold} />
                      <Text style={styles.uploadText}>Tap to select photos</Text>
                      <Text style={styles.uploadSub}>Supports up to 100 photos</Text>
                    </>
                  )}
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
                    <View style={styles.photoStats}>
                      <Text style={styles.photoStatsText}>
                        {photos.length} photos • {formatFileSize(getTotalFileSize())}
                      </Text>
                      <Pressable 
                        style={styles.clearPhotosBtn}
                        onPress={() => {
                          Alert.alert(
                            'Clear All Photos',
                            'Are you sure you want to remove all selected photos?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { 
                                text: 'Clear All', 
                                style: 'destructive',
                                onPress: () => setPhotos([])
                              }
                            ]
                          );
                        }}
                      >
                        <Trash2 size={14} color={Colors.error} />
                        <Text style={styles.clearPhotosText}>Clear All</Text>
                      </Pressable>
                    </View>
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

              {/* Delivery Methods */}
              <View style={styles.deliverySection}>
                <Text style={styles.deliveryLabel}>DELIVERY METHODS</Text>
                <View style={styles.deliveryGrid}>
                  <Pressable 
                    style={[styles.deliveryChip, deliveryMethods.includes('sms') && styles.deliveryChipActive]}
                    onPress={() => toggleDeliveryMethod('sms')}
                  >
                    <MessageCircle size={16} color={deliveryMethods.includes('sms') ? Colors.white : Colors.textMuted} />
                    <Text style={[styles.deliveryText, deliveryMethods.includes('sms') && styles.deliveryTextActive]}>
                      SMS
                    </Text>
                  </Pressable>
                  
                  <Pressable 
                    style={[styles.deliveryChip, deliveryMethods.includes('whatsapp') && styles.deliveryChipActive]}
                    onPress={() => toggleDeliveryMethod('whatsapp')}
                  >
                    <MessageCircle size={16} color={deliveryMethods.includes('whatsapp') ? Colors.white : Colors.textMuted} />
                    <Text style={[styles.deliveryText, deliveryMethods.includes('whatsapp') && styles.deliveryTextActive]}>
                      WhatsApp
                    </Text>
                  </Pressable>
                  
                  <Pressable 
                    style={[styles.deliveryChip, deliveryMethods.includes('email') && styles.deliveryChipActive]}
                    onPress={() => toggleDeliveryMethod('email')}
                  >
                    <Mail size={16} color={deliveryMethods.includes('email') ? Colors.white : Colors.textMuted} />
                    <Text style={[styles.deliveryText, deliveryMethods.includes('email') && styles.deliveryTextActive]}>
                      Email
                    </Text>
                  </Pressable>
                  
                  <Pressable 
                    style={[styles.deliveryChip, deliveryMethods.includes('in_app') && styles.deliveryChipActive]}
                    onPress={() => toggleDeliveryMethod('in_app')}
                  >
                    <Smartphone size={16} color={deliveryMethods.includes('in_app') ? Colors.white : Colors.textMuted} />
                    <Text style={[styles.deliveryText, deliveryMethods.includes('in_app') && styles.deliveryTextActive]}>
                      In-App
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Custom Message */}
              {deliveryMethods.length > 0 && (
                <View style={styles.customMessageSection}>
                  <Text style={styles.sectionLabel}>CUSTOM MESSAGE</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Custom notification message (optional)"
                    placeholderTextColor={Colors.textMuted}
                    value={customMessage}
                    onChangeText={setCustomMessage}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              )}
              
              <View style={styles.divider} />
              
              {accessCode ? (
                <View style={styles.accessCodeContainer}>
                  <View>
                    <Text style={styles.accessCodeLabel}>ACCESS CODE</Text>
                    <Text style={styles.accessCodeValue}>{accessCode}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Pressable style={styles.iconBtn} onPress={copyAccessCode}>
                      <Copy size={20} color={Colors.gold} />
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
            </>
          )}

          {/* SMS Preview */}
          <View style={styles.smsPreview}>
            <Smartphone size={16} color={Colors.textMuted} />
            <Text style={styles.smsText} numberOfLines={2}>
              SMS: Hello {clientData?.name || '{Client}'}, your photos are ready! Code: {accessCode}. View at epixvisualsstudios.co
            </Text>
          </View>

          {/* Upload Progress */}
          {isUploading && (
            <View style={styles.uploadProgressContainer}>
              <Text style={styles.uploadStatus}>{uploadStatus}</Text>
              {uploadProgress.currentFile && (
                <Text style={styles.currentFile} numberOfLines={1}>
                  {uploadProgress.currentFile}
                </Text>
              )}
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${(uploadProgress.completed / Math.max(1, uploadProgress.total)) * 100}%` 
                    }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {uploadProgress.completed} / {uploadProgress.total} photos uploaded
              </Text>
            </View>
          )}

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
  clientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    minWidth: 320,
  },
  clientsHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  clientsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientCountBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  clientCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  clientsCollapsible: {
    marginTop: 8,
    overflow: 'hidden',
    maxHeight: 420,
    opacity: 1,
    transitionProperty: 'max-height, opacity',
    transitionDuration: '300ms',
    transitionTimingFunction: 'ease',
  },
  clientsCollapsibleCollapsed: {
    maxHeight: 0,
    opacity: 0,
    marginTop: 0,
  },
  clientList: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  clientListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  clientListName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  clientListPhone: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  clientListAction: {
    fontSize: 12,
    color: Colors.gold,
    fontWeight: '700',
  },
  clientEmpty: {
    marginTop: 10,
    paddingHorizontal: 12,
  },
  clientEmptyText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
    paddingBottom: 16,
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
  newClientInfo: {
    flex: 1,
    gap: 8,
  },
  newClientText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  createClientBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.gold,
  },
  createClientBtnDisabled: {
    backgroundColor: '#555',
  },
  createClientBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.background,
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
    marginTop: 4,
  },
  photoList: {
    height: 80,
  },
  photoStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  photoStatsText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  clearPhotosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
  },
  clearPhotosText: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '500',
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
  deliverySection: {
    marginBottom: 20,
  },
  deliveryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 12,
    letterSpacing: 1,
  },
  deliveryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deliveryChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  deliveryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  deliveryTextActive: {
    color: Colors.white,
  },
  customMessageSection: {
    marginBottom: 20,
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
  uploadProgressContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  uploadStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  currentFile: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
