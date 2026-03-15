import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  Alert, Image, FlatList, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Switch, Linking
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import {
  User, ArrowLeft, ChevronUp, ChevronDown,
  Wifi, WifiOff, Cloud, DollarSign, FileText, Hash, Copy,
  Trash2, CreditCard, Mail, Smartphone, AlertTriangle, Shield, Calendar,
  Check, Send, MessageCircle, Phone, X, Search, Camera
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { AdminService } from '@/services/admin';
import { supabase } from '@/lib/supabase';
import { useBranding } from '@/contexts/BrandingContext';
import { useAuth } from '@/contexts/AuthContext';

type DeliveryMethod = 'sms' | 'whatsapp' | 'email' | 'in_app';
type ShootType = 'wedding' | 'portrait' | 'event' | 'commercial' | 'other';

type Client = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  totalGalleries?: number;
  lastShoot?: string;
};

type Photo = {
  id: string;
  uri: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
};

export default function ClientPhotoUploadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user, verifyAdminGuard } = useAuth();
  const { brandName: activeBrand, appDisplayName: activeAppName, shareAppLink: appLink, accessCodeLink: accessLink } = useBranding();

  // Access guard
  const [accessReady, setAccessReady] = useState(false);

  // Network
  const [netInfo, setNetInfo] = useState<{ isConnected: boolean | null }>({ isConnected: true });

  // Client state
  const [clients, setClients] = useState<Client[]>([]);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [temporaryClientName, setTemporaryClientName] = useState('');
  const [isNewClient, setIsNewClient] = useState(false);
  const [checkingClient, setCheckingClient] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [isClientListExpanded, setIsClientListExpanded] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Gallery config
  const [galleryTitle, setGalleryTitle] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [shootType, setShootType] = useState<ShootType>('portrait');
  const [delayedDelivery, setDelayedDelivery] = useState(false);
  const [releaseDate, setReleaseDate] = useState(new Date());
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(['sms']);
  const [sendNotificationAfterUpload, setSendNotificationAfterUpload] = useState(true);
  const [requirePaymentBeforeDownload, setRequirePaymentBeforeDownload] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [outdoorMode, setOutdoorMode] = useState(false);

  // Photos
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isPicking, setIsPicking] = useState(false);

  // Upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; completed: number; currentFile: string }>({ total: 0, completed: 0, currentFile: '' });
  const [uploadStatus, setUploadStatus] = useState('');
  const [initializedGallery, setInitializedGallery] = useState<{
    id: string;
    sessionId: string;
    accessCode: string;
  } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);



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

  // Generate access code on gallery title change (from upload.tsx)
  useEffect(() => {
    if (galleryTitle.trim()) {
      const prefix = galleryTitle.split(' ')[0].toUpperCase().slice(0, 3);
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      setAccessCode(`${prefix}-${randomDigits}`);
    }
  }, [galleryTitle]);

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
      return mapped;
    } catch (error) {
      console.error('Failed to load clients:', error);
      return [];
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
    loadClients().then((loadedClients) => {
      if (userId && loadedClients) {
        const client = loadedClients.find(c => c.id === userId);
        if (client) {
          selectClient(client);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    });
  }, [accessReady, loadClients, userId]);

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
    : clients;
  const selectedClientCount = clientData ? 1 : 0;
  const selectedClientLabel = `${selectedClientCount} client${selectedClientCount === 1 ? '' : 's'} selected`;

  const pickImages = async () => {
    setIsPicking(true);
    try {
      const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = status;
      }
      
      const hasAccess = finalStatus === 'granted';
      if (!hasAccess) {
        Alert.alert('Permission Required', 'Please grant photo library access to select images.');
        setIsPicking(false);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 100,
        // Removed quality and exif to prevent silent failures on Android
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

        try {
          await AdminService.gallery.uploadPhotoDirect(
            galleryId,
            photo,
            !isPaid,
            currentIndex + 1
          );
        } catch (error) {
          console.error(`Failed to upload photo ${photo.fileName}:`, error);
          throw error;
        }

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

  const handleSendSMS = async () => {
    if (!phoneNumber || !accessCode) return;
    const deepLink = `${accessLink}${accessCode}`;
    const message = `Hello ${clientData?.name || resolveClientName()}, your photos are ready! \n\nDirect Link: ${deepLink}\n\nUse code: ${accessCode} to unlock if the link doesn't open. \n\nDownload App: ${appLink}`;
    const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;

    try {
      const supported = await Linking.canOpenURL(smsUrl);
      if (supported) {
        await Linking.openURL(smsUrl);
        await supabase.from('sms_logs').insert({
          owner_admin_id: user?.id,
          client_id: clientData?.id,
          phone_number: phoneNumber,
          message: message,
          status: 'queued',
        });
        Alert.alert('SMS Composer Opened', 'SMS composer has been opened with the prefilled message.');
      } else {
        Alert.alert('Error', 'SMS is not supported on this device.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open SMS composer.');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!phoneNumber || !accessCode) return;
    const deepLink = `${accessLink}${accessCode}`;
    const message = `Hello ${clientData?.name || resolveClientName()}, your photos are ready! \n\nDirect Link: ${deepLink}\n\nUse code: ${accessCode} to unlock if the link doesn't open. \n\nDownload App: ${appLink}`;
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
        Alert.alert('WhatsApp Opened', 'WhatsApp has been opened with the prefilled message.');
      } else {
        Alert.alert('Error', 'WhatsApp is not installed or supported on this device.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open WhatsApp.');
    }
  };

  const handleSetupGallery = async () => {
    if (!phoneNumber) {
      Alert.alert('Missing Info', 'Please enter a client phone number.');
      return;
    }

    setIsInitializing(true);
    setUploadStatus('Initializing gallery record...');

    try {
      // 1. Create or find client
      let clientId = clientData?.id;
      if (!clientId) {
        const resolvedName = resolveClientName();
        setUploadStatus('Creating client...');
        const newClient = await AdminService.clients.create({
          name: resolvedName,
          phone: phoneNumber,
          email: email || undefined,
          notes
        } as any);
        clientId = newClient.id;
        setClientData({
          id: newClient.id,
          name: newClient.name || phoneNumber,
          phone: newClient.phone || phoneNumber,
          email: newClient.email ?? undefined,
          totalGalleries: 0
        });
      }

      // 2. Create gallery directly (no Edge Functions)
      setUploadStatus('Creating gallery...');
      const galleryName = galleryTitle || `${shootType.charAt(0).toUpperCase() + shootType.slice(1)} ${new Date().getFullYear()}`;

      const result = await AdminService.gallery.createSimple({
        clientId: clientId!,
        name: galleryName,
        price: price ? parseFloat(price) : 0,
        shootType,
        isPaid,
        accessCode,
      });

      setInitializedGallery({
        id: result.id,
        sessionId: result.session_id,
        accessCode: result.access_code
      });
      setAccessCode(result.access_code);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `Gallery created! Access code: ${result.access_code}. You can now select and upload photos.`);
    } catch (error: any) {
      console.error('Setup failed:', error);
      Alert.alert('Setup Failed', error?.message || 'Could not initialize gallery.');
    } finally {
      setIsInitializing(false);
      setUploadStatus('');
    }
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

    const galleryName = galleryTitle || `${shootType.charAt(0).toUpperCase() + shootType.slice(1)} ${new Date().getFullYear()}`;

    // Check for duplicate gallery name for this client
    if (clientData?.id) {
      try {
        const { data: existingGalleries, error } = await supabase
          .from('galleries')
          .select('name')
          .eq('client_id', clientData.id)
          .ilike('name', galleryName.trim());

        if (error) throw error;

        if (existingGalleries && existingGalleries.length > 0) {
          Alert.alert(
            'Duplicate Gallery',
            `A gallery named "${galleryName.trim()}" already exists for this client. Are you sure you want to create another?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue Anyway', style: 'destructive', onPress: () => proceedWithUpload(galleryName) }
            ]
          );
          return;
        }
      } catch (error) {
        console.warn('Failed to check for duplicate galleries:', error);
      }
    }

    await proceedWithUpload(galleryName);
  };

  const proceedWithUpload = async (galleryName: string) => {
    const totalPhotos = photos.length;
    setIsUploading(true);
    setUploadProgress({ total: totalPhotos, completed: 0, currentFile: '' });
    setUploadStatus('Creating client and gallery...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // 1. Use pre-initialized or create new
      let clientId: string | undefined = clientData?.id;
      let galleryId = initializedGallery?.id;
      let sessionId = initializedGallery?.sessionId;
      // Hoist galleryName so notification block can access it
      if (!galleryId || !sessionId) {
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

        // 2. Create gallery directly (no Edge Functions)
        setUploadStatus('Creating gallery...');
        const gallery = await AdminService.gallery.createSimple({
          clientId: clientId!,
          name: galleryName,
          price: price ? parseFloat(price) : 0,
          shootType,
          isPaid,
          accessCode,
        });
        galleryId = gallery.id;
        sessionId = gallery.session_id;
        setAccessCode(gallery.access_code);
      }

      const finalGalleryId = galleryId as string;
      const finalAccessCode = initializedGallery?.accessCode || accessCode;

      // 3. Upload photos directly (no Edge Functions)
      setUploadStatus('Uploading photos...');

      await uploadGalleryPhotosWithConcurrency(finalGalleryId, photos, 3);

      // 4. Send notifications (non-critical — don't let this crash the upload)
      if (sendNotificationAfterUpload) {
        setUploadStatus('Sending notifications...');
        try {
          const resolvedName = clientData?.name || resolveClientName();
          
          await AdminService.notifications.create(clientId as string, {
            clientId: clientId as string,
            galleryId: finalGalleryId,
            type: 'gallery_ready',
            title: `Hello ${resolvedName} 👋, your ${galleryName} gallery is ready!`,
            body: `Your photos from ${galleryName} are now available. Tap to view your gallery.`,
            data: { galleryId: finalGalleryId, accessCode: finalAccessCode, clientName: resolvedName }
          });
        } catch (notifError: any) {
          console.warn('Notification sending failed (non-critical):', notifError?.message);
          // Don't throw — upload already succeeded
        }
      }


      setAccessCode(finalAccessCode);
      setIsUploading(false);
      setUploadStatus('');
      setShowUploadModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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
      // TEMPORARILY show the raw error for debugging
      const debugInfo = `RAW ERROR:\n${message}\n\nStatus: ${status}\n\nStack: ${error?.stack?.substring(0, 200) || 'none'}`;
      
      setIsUploading(false);
      setUploadStatus('');
      Alert.alert('Upload Failed', debugInfo);
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
                <ScrollView 
                  style={styles.clientList} 
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                >
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
                </ScrollView>
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

                {/* ─── Create Gallery Button ─── */}
                {!initializedGallery ? (
                  <Pressable
                    style={[
                      styles.setupGalleryBtn,
                      (isInitializing || !phoneNumber) && styles.primaryBtnDisabled
                    ]}
                    onPress={handleSetupGallery}
                    disabled={isInitializing || !phoneNumber}
                  >
                    {isInitializing ? (
                      <ActivityIndicator color={Colors.background} size="small" />
                    ) : (
                      <>
                        <LinearGradient
                          colors={!phoneNumber ? ['#333', '#333'] : ['#2563eb', '#1d4ed8']}
                          style={StyleSheet.absoluteFillObject}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        />
                        <Hash size={18} color={Colors.white} />
                        <Text style={styles.setupGalleryBtnText}>Create Gallery &amp; Get Access Code</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <View style={styles.galleryReadyBadge}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.galleryReadyText}>
                      Gallery Ready — Code: {initializedGallery.accessCode}
                    </Text>
                    <Pressable onPress={copyAccessCode}>
                      <Copy size={14} color={Colors.success} />
                    </Pressable>
                  </View>
                )}
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
          {(isUploading || isInitializing) && (() => {
            const pct = uploadProgress.total > 0
              ? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
              : 0;
            const isCreatingGallery = uploadStatus.toLowerCase().includes('creating') || uploadStatus.toLowerCase().includes('client') || uploadStatus.toLowerCase().includes('initializ');
            return (
              <View style={styles.uploadProgressContainer}>
                {/* Status label */}
                <Text style={styles.uploadStatus}>{uploadStatus || 'Starting...'}</Text>

                {/* Big percentage */}
                <Text style={styles.uploadPct}>{pct}%</Text>

                {/* Progress bar */}
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      isCreatingGallery && styles.progressFillSetup,
                      { width: `${isCreatingGallery ? 5 : pct}%` }
                    ]}
                  />
                </View>

                {/* Photo counter */}
                <Text style={styles.progressText}>
                  {isCreatingGallery
                    ? 'Preparing gallery record...'
                    : `${uploadProgress.completed} of ${uploadProgress.total} photos uploaded`}
                </Text>

                {/* Current file */}
                {uploadProgress.currentFile ? (
                  <Text style={styles.currentFile} numberOfLines={1}>
                    {uploadProgress.currentFile}
                  </Text>
                ) : null}
              </View>
            );
          })()}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.primaryBtn,
                (isUploading || (photos.length === 0 && !outdoorMode)) && styles.primaryBtnDisabled
              ]}
              onPress={handleUpload}
              disabled={isUploading || (photos.length === 0 && !outdoorMode)}
            >
              {isUploading ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <LinearGradient
                  colors={
                    (photos.length === 0 && !outdoorMode)
                      ? ['#333', '#333']
                      : initializedGallery
                        ? [Colors.success, '#16a34a']
                        : [Colors.gold, Colors.goldDark]
                  }
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              {!isUploading && (
                <Text style={styles.primaryBtnText}>
                  {outdoorMode
                    ? 'Save Shoot & Sync Later'
                    : initializedGallery
                      ? `Upload ${photos.length} Photo${photos.length !== 1 ? 's' : ''} → (Fast)`
                      : 'Upload & Create Gallery'}
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

      {/* Upload Success Modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconWrapper}>
              <Check size={40} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>Gallery Uploaded!</Text>
            <Text style={styles.successMessage}>
              Your gallery is live and notifications are queued.
            </Text>

            <View style={styles.successActions}>
              <Pressable style={styles.actionBtnRow} onPress={handleSendSMS}>
                <Send size={16} color={Colors.white} />
                <Text style={styles.actionBtnText}>Send SMS natively</Text>
              </Pressable>

              <Pressable style={[styles.actionBtnRow, { backgroundColor: '#25D366', borderColor: '#25D366' }]} onPress={handleSendWhatsApp}>
                <MessageCircle size={16} color={Colors.white} />
                <Text style={styles.actionBtnText}>Send via WhatsApp</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.doneBtn}
              onPress={() => {
                setShowUploadModal(false);
                router.back();
              }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    marginBottom: 28,
    backgroundColor: '#161616',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
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
    borderColor: 'rgba(212, 175, 55, 0.1)',
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
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 12,
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
    maxHeight: 300,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  typeChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typeChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  deliveryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  deliveryChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
  setupGalleryBtn: {
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  setupGalleryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  galleryReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  galleryReadyText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  uploadPct: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.gold,
    textAlign: 'center',
    marginVertical: 8,
    letterSpacing: -1,
  },
  progressFillSetup: {
    backgroundColor: '#f59e0b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  successModal: {
    backgroundColor: '#161616',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 20,
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.2)',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  successActions: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
    borderRadius: 16,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 16,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
