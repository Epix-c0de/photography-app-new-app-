import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  Alert, Image, FlatList, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Switch, Linking
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch {
  // Not available on web
}
import * as Clipboard from 'expo-clipboard';
import {
  User, ArrowLeft, ChevronUp, ChevronDown,
  Wifi, WifiOff, Cloud, DollarSign, FileText, Hash, Copy,
  Trash2, CreditCard, Mail, Smartphone, AlertTriangle, Shield, Calendar,
  Check, Send, MessageCircle, Phone, X, Search, Camera, Images, Share2
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { SMSService } from '@/services/sms';
import { AdminService } from '@/services/admin';
import { supabase } from '@/lib/supabase';
import { useBranding } from '@/contexts/BrandingContext';
import { useAuth } from '@/contexts/AuthContext';
import QRCode from 'react-native-qrcode-svg';

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
  originalSize?: number;
  mimeType: string;
  width?: number;
  height?: number;
  mediaType?: 'image' | 'video';
  compressed?: boolean;
};

async function getFileSize(uri: string): Promise<number> {
  if (Platform.OS === 'web') {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      return blob.size;
    } catch { return 0; }
  }
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? (info as any).size || 0 : 0;
}

async function compressImage(uri: string): Promise<{ uri: string; width: number; height: number; size: number; compressed: boolean }> {
  const originalSize = await getFileSize(uri);

  // Try native ImageManipulator first (iOS/Android)
  if (ImageManipulator) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 2400 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: false }
      );
      const compressedSize = await getFileSize(result.uri);
      if (compressedSize < originalSize) {
        return { uri: result.uri, width: result.width, height: result.height, size: compressedSize, compressed: true };
      }
    } catch (e) {
      console.warn('[Compress] Native manipulation failed, trying web fallback:', e);
    }
  }

  // Web fallback: use browser Canvas API for compression
  if (Platform.OS === 'web') {
    try {
      const compressedUri = await webCompressImage(uri, 2400, 0.82);
      const compressedSize = await getFileSize(compressedUri);
      if (compressedSize < originalSize) {
        const img = await new Promise<HTMLImageElement>((resolve) => {
          const el = new window.Image();
          el.onload = () => resolve(el);
          el.src = uri;
        });
        return { uri: compressedUri, width: img.naturalWidth, height: img.naturalHeight, size: compressedSize, compressed: true };
      }
    } catch (e) {
      console.warn('[Compress] Web compression failed:', e);
    }
  }

  return { uri, width: 0, height: 0, size: originalSize, compressed: false };
}

function webCompressImage(uri: string, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          resolve(URL.createObjectURL(blob));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = uri;
  });
}

export default function ClientPhotoUploadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId, clientId: clientIdParam, phoneNumber: phoneParam } = useLocalSearchParams<{ userId: string; clientId: string; phoneNumber: string }>();
  const { user, verifyAdminGuard } = useAuth();
  const { brandName: activeBrand, appDisplayName: activeAppName, shareAppLink: appLink, accessCodeLink: accessLink } = useBranding();

  // Access guard
  const [accessReady, setAccessReady] = useState(false);

  // Network
  const [netInfo, setNetInfo] = useState<{ isConnected: boolean | null }>({ isConnected: true });

  // Client state
  const [clients, setClients] = useState<Client[]>([]);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(phoneParam || '');
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
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(['sms', 'in_app']);
  const [sendNotificationAfterUpload, setSendNotificationAfterUpload] = useState(true);
  const [requirePaymentBeforeDownload, setRequirePaymentBeforeDownload] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [outdoorMode, setOutdoorMode] = useState(false);

  // Wizard step
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pendingCount, setPendingCount] = useState(0);

  // Photos
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isPicking, setIsPicking] = useState(false);

  // Upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; completed: number; currentFile: string }>({ total: 0, completed: 0, currentFile: '' });
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [uploadBytes, setUploadBytes] = useState<{ uploaded: number; total: number }>({ uploaded: 0, total: 0 });
  const [uploadEta, setUploadEta] = useState<string>('');
  const [initializedGallery, setInitializedGallery] = useState<{
    id: string;
    sessionId: string;
    accessCode: string;
  } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);



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
      return;
    }
    if (!phoneNumber && clientData?.id) {
      setIsNewClient(false);
      return;
    }
    setClientData(null);
    setIsNewClient(false);
  }, [phoneNumber, checkClient, clientData?.id]);

  useEffect(() => {
    if (!accessReady) return;
    loadClients().then((loadedClients) => {
      const preselectId = clientIdParam || userId;
      if (preselectId && loadedClients) {
        const client = loadedClients.find(c => c.id === preselectId);
        if (client) {
          selectClient(client);
          setPhoneNumber(client.phone || '');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Skip step 1 — go directly to step 2 since client is pre-selected
          setStep(2);
        }
      }
    });
    import('@/lib/outdoor-upload-queue').then(({ getPendingClientCount }) => {
      getPendingClientCount().then(setPendingCount);
    });
  }, [accessReady, loadClients, clientIdParam, userId]);

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
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        selectionLimit: 100,
        videoMaxDuration: 300,
      });

      if (result.canceled || !result.assets?.length) {
        Alert.alert('No Media Selected', 'Please choose at least one photo or video to upload.');
        return;
      }

      if (result.assets?.length) {
        setUploadStatus('Processing files...');
        const newPhotos = (
          await Promise.all(
            result.assets.map(async (asset) => {
              if (!asset.uri) return null;

              const isVideo = asset.type === 'video';
              const fileName = asset.fileName || asset.uri.split('/').pop() || `file_${Date.now()}`;
              const extension = fileName.split('.').pop() || '';
              const mimeType = asset.mimeType || (isVideo ? 'video/mp4' : mimeFromExtension(extension) || 'application/octet-stream');

              let fileSize = asset.fileSize || 0;
              if (!fileSize) {
                try {
                  fileSize = await getFileSize(asset.uri);
                } catch { fileSize = 0; }
              }

              let processedUri = asset.uri;
              let width = asset.width;
              let height = asset.height;
              let didCompress = false;

              if (!isVideo) {
                setUploadStatus(`Compressing ${fileName}...`);
                const originalSize = asset.fileSize || await getFileSize(asset.uri);
                const compressed = await compressImage(asset.uri);
                processedUri = compressed.uri;
                didCompress = compressed.compressed;
                fileSize = compressed.size || fileSize;
                if (compressed.width) width = compressed.width;
                if (compressed.height) height = compressed.height;
                console.log(`[Compress] ${fileName}: ${(originalSize / 1024).toFixed(0)}KB → ${(fileSize / 1024).toFixed(0)}KB (${compressed.compressed ? 'compressed' : 'unchanged'})`);
              } else if (fileSize > 100 * 1024 * 1024) {
                Alert.alert('Large Video', `${fileName} is ${(fileSize / (1024 * 1024)).toFixed(0)}MB. Upload may be slow.`);
              }

              return {
                id: asset.assetId || Math.random().toString(),
                uri: processedUri,
                fileName,
                fileSize,
                originalSize: didCompress ? (asset.fileSize || await getFileSize(asset.uri)) : undefined,
                mimeType,
                width,
                height,
                mediaType: isVideo ? 'video' as const : 'image' as const,
                compressed: didCompress,
              };
            })
          )
        ).filter(Boolean) as Photo[];

        setUploadStatus('');
        if (!newPhotos.length) {
          Alert.alert('No Valid Files', 'We could not process the selected files.');
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
    _concurrency: number,
    clientId?: string
  ) => {
    const total = items.length;
    const failed: string[] = [];
    const startTime = Date.now();
    let completed = 0;
    let bytesUploaded = 0;
    const totalBytes = items.reduce((s, p) => s + (p.fileSize || 0), 0);

    setUploadBytes({ uploaded: 0, total: totalBytes });

    // Live progress timer — updates UI every 500ms
    const progressTimer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const speedMBps = elapsed > 0 ? (bytesUploaded / (1024 * 1024)) / elapsed : 0;
      const remainingBytes = totalBytes - bytesUploaded;
      const remaining = speedMBps > 0 ? remainingBytes / (speedMBps * 1024 * 1024) : 0;
      const mins = Math.floor(remaining / 60);
      const secs = Math.floor(remaining % 60);
      setUploadEta(mins > 0 ? `${mins}m ${secs}s` : secs > 0 ? `${secs}s` : '');
      setUploadSpeed(speedMBps);
      setUploadBytes({ uploaded: bytesUploaded, total: totalBytes });
    }, 500);

    // Sequential upload — one file at a time for reliable progress
    for (let i = 0; i < total; i++) {
      const photo = items[i];

      setUploadProgress({
        total,
        completed,
        currentFile: `Uploading ${i + 1}/${total}: ${photo.fileName}`,
      });

      try {
        console.log(`[UploadLoop] Uploading photo ${i + 1}/${total}: ${photo.fileName} (${((photo.fileSize || 0) / 1024).toFixed(1)}KB)`);
        await AdminService.gallery.uploadPhotoDirect(
          galleryId,
          photo,
          !isPaid,
          i + 1,
          clientId
        );
        bytesUploaded += photo.fileSize || 0;
        console.log(`[UploadLoop] ✓ Photo ${i + 1}/${total} done: ${photo.fileName}`);
      } catch (error: any) {
        const errMsg = error?.message || String(error);
        console.error(`[UploadLoop] ✗ Photo ${i + 1}/${total} FAILED: ${photo.fileName}`, errMsg);
        failed.push(`${photo.fileName}: ${errMsg}`);
      }

      completed += 1;

      // Immediate update after each file
      const elapsed = (Date.now() - startTime) / 1000;
      const speedMBps = elapsed > 0 ? (bytesUploaded / (1024 * 1024)) / elapsed : 0;
      const remainingBytes = totalBytes - bytesUploaded;
      const remaining = speedMBps > 0 ? remainingBytes / (speedMBps * 1024 * 1024) : 0;
      const mins = Math.floor(remaining / 60);
      const secs = Math.floor(remaining % 60);
      setUploadEta(mins > 0 ? `${mins}m ${secs}s` : secs > 0 ? `${secs}s` : '');
      setUploadSpeed(speedMBps);
      setUploadBytes({ uploaded: bytesUploaded, total: totalBytes });
      setUploadProgress({
        total,
        completed,
        currentFile: `Uploading ${i + 1}/${total}: ${photo.fileName}`,
      });
    }

    clearInterval(progressTimer);

    // Final state
    setUploadSpeed(0);
    setUploadEta('');

    if (failed.length > 0) {
      const summary = failed.slice(0, 5).join('\n');
      const extra = failed.length > 5 ? `\n...and ${failed.length - 5} more` : '';
      Alert.alert('Upload Errors', `${failed.length} of ${total} files failed:\n\n${summary}${extra}`);
    }
    return { failed };
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
    const failed: string[] = [];

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
          await AdminService.tempUploads.uploadPhoto({
            temporaryName,
            temporaryIdentifier,
            accessCode,
            file: photo,
            uploadOrder: currentIndex + 1
          });
        } catch (error) {
          console.error(`Failed to upload temp photo ${photo.fileName}:`, error);
          failed.push(photo.fileName);
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

    if (failed.length > 0) {
      Alert.alert('Partial Upload', `${failed.length} of ${total} files failed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '...' : ''}`);
    }
    return { failed };
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
    if (!phoneNumber && !clientData?.id) {
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
          phone: phoneNumber || '',
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

      const autoLock = await AsyncStorage.getItem('admin_autoLockGalleries');
      const shouldLock = autoLock !== null ? autoLock === 'true' : true;

      const result = await AdminService.gallery.createSimple({
        clientId: clientId!,
        name: galleryName,
        price: isPaid && price ? parseFloat(price) : 0,
        shootType,
        isPaid,
        accessCode,
        isLocked: shouldLock,
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
    if (!phoneNumber && !clientData?.id) {
      Alert.alert('Missing Info', 'Please enter a client phone number.');
      return;
    }
    if (photos.length === 0 && !outdoorMode) {
      Alert.alert('No Photos', 'Please select at least one photo.');
      return;
    }

    // Outdoor mode: save client info locally for later sync
    if (outdoorMode) {
      const { queueClient } = await import('@/lib/outdoor-upload-queue');
      await queueClient({
        name: resolveClientName(),
        phone: phoneNumber,
        email: email || undefined,
        notes: galleryTitle || shootType ? `Shoot: ${shootType}, Gallery: ${galleryTitle || 'Not set'}` : undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Client Saved Offline',
        `${resolveClientName()} (${phoneNumber}) saved locally.\nWill sync to your client list when you're back online.`,
      );
      router.back();
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
    const totalBytes = photos.reduce((s, p) => s + (p.fileSize || 0), 0);
    console.log(`[Upload] Starting upload: ${totalPhotos} photos, ${(totalBytes / (1024 * 1024)).toFixed(1)}MB total, gallery="${galleryName}"`);
    setIsUploading(true);
    setUploadProgress({ total: totalPhotos, completed: 0, currentFile: 'Preparing...' });
    setUploadStatus('Creating client and gallery...');
    setUploadBytes({ uploaded: 0, total: totalBytes });
    setUploadSpeed(0);
    setUploadEta('');
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

        const autoLock = await AsyncStorage.getItem('admin_autoLockGalleries');
        const shouldLock = autoLock !== null ? autoLock === 'true' : true;

        const gallery = await AdminService.gallery.createSimple({
          clientId: clientId!,
          name: galleryName,
          price: isPaid && price ? parseFloat(price) : 0,
          shootType,
          isPaid,
          accessCode,
          isLocked: shouldLock,
        });
        galleryId = gallery.id;
        sessionId = gallery.session_id;
        setAccessCode(gallery.access_code);
      }

      const finalGalleryId = galleryId as string;
      const finalAccessCode = initializedGallery?.accessCode || accessCode;

      // 3. Upload photos directly (no Edge Functions)
      setUploadStatus('Uploading photos...');

      await uploadGalleryPhotosWithConcurrency(finalGalleryId, photos, 3, clientId);

      // 4. Send via selected delivery methods
      if (sendNotificationAfterUpload && deliveryMethods.length > 0) {
        setUploadStatus('Sending notifications...');
        const resolvedName = clientData?.name || resolveClientName();
        const links = await SMSService.utils.getAdminLinks();
        const appLinkBase = links?.access_code_delivery_link || links?.share_app_link || accessLink;
        const deepLink = `${appLinkBase}${finalAccessCode}`;
        const smsBody = `Hello ${resolvedName}, your ${galleryName} photos are ready!\n\nView here: ${deepLink}\n\nUse code: ${finalAccessCode} to unlock.\n\nEpix Visuals Studios`;
        const whatsappBody = `Hello ${resolvedName}, your ${galleryName} photos are ready!\n\nView here: ${deepLink}\n\nUse code: ${finalAccessCode} to unlock.`;

        // In-App Notification
        if (deliveryMethods.includes('in_app')) {
          try {
            const templates = await SMSService.templates.list();
            const titleTpl = templates?.find(t => t.name === 'In-App Notification Title')?.body
              || `Hello ${resolvedName}, your ${galleryName} gallery is ready!`;
            const bodyTpl = templates?.find(t => t.name === 'In-App Notification Body')?.body
              || `Your photos from ${galleryName} are now available. Tap to view your gallery.`;
            const compiledTitle = SMSService.utils.compileTemplate(titleTpl, {
              client_name: resolvedName, gallery_name: galleryName,
              access_code: finalAccessCode, app_link: appLinkBase, business_name: 'Epix Visuals Studios'
            });
            const compiledBody = SMSService.utils.compileTemplate(bodyTpl, {
              client_name: resolvedName, gallery_name: galleryName,
              access_code: finalAccessCode, app_link: appLinkBase, business_name: 'Epix Visuals Studios'
            });
            await AdminService.notifications.create(clientId as string, {
              clientId: clientId as string, galleryId: finalGalleryId,
              type: 'gallery_ready', title: compiledTitle, body: compiledBody,
              data: { galleryId: finalGalleryId, accessCode: finalAccessCode, clientName: resolvedName }
            });
            await supabase.rpc('update_delivery_status', {
              p_gallery_id: finalGalleryId, p_client_id: clientId, p_field: 'notification_sent', p_value: true
            });
          } catch (e: any) { console.warn('In-app notification failed:', e?.message); }
        }

        // SMS
        if (deliveryMethods.includes('sms') && phoneNumber) {
          try {
            const templates = await SMSService.templates.list();
            const smsTpl = templates?.find(t => t.name === 'Gallery Ready (SMS)')?.body || smsBody;
            const compiledSms = SMSService.utils.compileTemplate(smsTpl, {
              client_name: resolvedName, access_code: finalAccessCode,
              gallery_name: galleryName, app_link: appLinkBase, business_name: 'Epix Visuals Studios'
            });
            await supabase.functions.invoke('send_sms', {
              body: { phoneNumber, message: compiledSms }
            });
            await supabase.from('sms_logs').insert({
              owner_admin_id: user?.id, client_id: clientId,
              phone_number: phoneNumber, message: compiledSms, status: 'sent',
            });
            await supabase.rpc('update_delivery_status', {
              p_gallery_id: finalGalleryId, p_client_id: clientId, p_field: 'sms_sent', p_value: true
            });
          } catch (e: any) { console.warn('SMS failed:', e?.message); }
        }

        // WhatsApp
        if (deliveryMethods.includes('whatsapp') && phoneNumber) {
          try {
            await supabase.functions.invoke('send-whatsapp', {
              body: {
                phone_number: phoneNumber, message: whatsappBody,
                photographer_id: user?.id, client_id: clientId, gallery_id: finalGalleryId,
              }
            });
          } catch (e: any) { console.warn('WhatsApp failed:', e?.message); }
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
  const renderPhotoItem = ({ item, index }: { item: Photo; index: number }) => (
    <View style={styles.photoItem}>
      <Image source={{ uri: item.uri }} style={styles.photoThumb} resizeMode="cover" />
      <View style={styles.photoIndex}>
        <Text style={styles.photoIndexText}>{index + 1}</Text>
      </View>
      {item.compressed && (
        <View style={styles.compressedBadge}>
          <Text style={styles.compressedBadgeText}>ZIP</Text>
        </View>
      )}
      {uploadProgress.currentFile && uploadProgress.currentFile.includes(item.fileName) && (
        <View style={styles.photoUploading}>
          <ActivityIndicator size="small" color={Colors.gold} />
        </View>
      )}
      <Pressable
        style={styles.removePhotoBtn}
        onPress={() => removePhoto(item.id)}
      >
        <X size={10} color="#FFF" />
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
          <ArrowLeft size={22} color={Colors.white} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Upload Photos</Text>
          <Text style={styles.headerSub}>Create or update gallery</Text>
        </View>
        <View style={[styles.statusBadge, !netInfo.isConnected && styles.statusBadgeOffline]}>
          {netInfo.isConnected ? (
            <View style={styles.statusDotOnline} />
          ) : (
            <View style={styles.statusDotOffline} />
          )}
          <Text style={[styles.statusText, !netInfo.isConnected && styles.statusTextOffline]}>
            {netInfo.isConnected ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Step Progress Bar */}
      <View style={styles.progressSteps}>
        {([1, 2, 3] as const).map((s) => (
          <View key={s} style={styles.progressStepRow}>
            <View style={[styles.progressDot, step >= s && styles.progressDotActive, step === s && styles.progressDotCurrent]}>
              {step > s ? <Check size={12} color={Colors.background} /> : <Text style={[styles.progressDotText, step >= s && styles.progressDotTextActive]}>{s}</Text>}
            </View>
            <Text style={[styles.progressLabel, step >= s && styles.progressLabelActive]}>
              {s === 1 ? 'Client' : s === 2 ? 'Gallery' : 'Photos'}
            </Text>
            {s < 3 && <View style={[styles.progressLine, step > s && styles.progressLineActive]} />}
          </View>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── STEP 1: Client ─── */}
          {step === 1 && (
            <>
          {/* Offline Mode Card */}
          <Pressable
            style={[styles.offlineCard, outdoorMode && styles.offlineCardActive]}
            onPress={() => setOutdoorMode(v => !v)}
          >
            <View style={[styles.offlineIconWrap, outdoorMode && styles.offlineIconWrapActive]}>
              {outdoorMode ? (
                <WifiOff size={20} color={Colors.gold} />
              ) : (
                <Wifi size={20} color={Colors.success} />
              )}
            </View>
            <View style={styles.offlineCardContent}>
              <Text style={[styles.offlineCardTitle, outdoorMode && { color: Colors.gold }]}>
                {outdoorMode ? 'Offline Mode' : 'Online Mode'}
              </Text>
              <Text style={styles.offlineCardSub}>
                {outdoorMode
                  ? `${pendingCount} client${pendingCount !== 1 ? 's' : ''} queued for sync`
                  : pendingCount > 0
                    ? `${pendingCount} client${pendingCount !== 1 ? 's' : ''} pending sync`
                    : 'Connected — photos upload in real-time'}
              </Text>
            </View>
            <Switch
              value={outdoorMode}
              onValueChange={setOutdoorMode}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212,175,55,0.4)' }}
              thumbColor={outdoorMode ? Colors.gold : '#666'}
            />
          </Pressable>

          {/* Client Search Card */}
          <View style={styles.stepCard}>
            <View style={styles.stepCardHeader}>
              <View style={styles.stepCardIcon}>
                <User size={16} color={Colors.gold} />
              </View>
              <Text style={styles.stepCardTitle}>Client Info</Text>
              {clientData && (
                <View style={styles.stepCardBadge}>
                  <Check size={10} color={Colors.background} />
                  <Text style={styles.stepCardBadgeText}>Selected</Text>
                </View>
              )}
            </View>

            {/* Phone Input */}
            <View style={styles.modernInputWrap}>
              <Phone size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.modernInput}
                placeholder="Phone number"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                autoFocus
              />
              {checkingClient && <ActivityIndicator size="small" color={Colors.gold} />}
            </View>

            {/* Client Name */}
            <View style={styles.modernInputWrap}>
              <User size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.modernInput}
                placeholder="Client name"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={temporaryClientName}
                onChangeText={setTemporaryClientName}
              />
            </View>

            {/* Quick Client Search */}
            <View style={styles.modernInputWrap}>
              <Search size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.modernInput}
                placeholder="Search existing clients..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={clientSearch}
                onChangeText={setClientSearch}
              />
              {loadingClients && <ActivityIndicator size="small" color={Colors.gold} />}
            </View>

            {/* Client List */}
            {clientSearch.length > 0 && filteredClients.length > 0 && (
              <View style={styles.modernClientList}>
                {filteredClients.slice(0, 5).map((client) => (
                  <Pressable
                    key={client.id}
                    style={[styles.modernClientItem, clientData?.id === client.id && styles.modernClientItemActive]}
                    onPress={() => selectClient(client)}
                  >
                    <View style={styles.modernClientAvatar}>
                      <Text style={styles.modernClientAvatarText}>
                        {(client.name || 'C')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.modernClientInfo}>
                      <Text style={styles.modernClientName}>{client.name}</Text>
                      <Text style={styles.modernClientPhone}>{client.phone || 'No phone'}</Text>
                    </View>
                    <Text style={[styles.modernClientAction, clientData?.id === client.id && { color: Colors.gold }]}>
                      {clientData?.id === client.id ? 'Selected' : 'Use'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Selected Client Card */}
            {clientData && (
              <View style={styles.selectedClientCard}>
                <View style={styles.selectedClientAvatar}>
                  <Text style={styles.selectedClientAvatarText}>
                    {(clientData.name || 'C')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.selectedClientInfo}>
                  <Text style={styles.selectedClientName}>{clientData.name}</Text>
                  <Text style={styles.selectedClientMeta}>
                    {clientData.phone} • {clientData.totalGalleries || 0} galleries
                  </Text>
                </View>
                <Pressable onPress={() => { setClientData(null); setPhoneNumber(''); }}>
                  <X size={16} color={Colors.textMuted} />
                </Pressable>
              </View>
            )}

            {/* New Client Prompt */}
            {isNewClient && !checkingClient && phoneNumber.length >= 10 && (
              <View style={styles.newClientPrompt}>
                <View style={styles.newClientPromptLeft}>
                  <AlertTriangle size={14} color={Colors.gold} />
                  <Text style={styles.newClientPromptText}>New client — will be created</Text>
                </View>
              </View>
            )}

            {/* Email (for new clients) */}
            {isNewClient && (
              <View style={[styles.modernInputWrap, { marginTop: 8 }]}>
                <Mail size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.modernInput}
                  placeholder="Email (optional)"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            )}

            {/* Price */}
            <View style={styles.modernInputWrap}>
              <DollarSign size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.modernInput}
                placeholder="Price (optional)"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="decimal-pad"
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>

          {/* Step 1 nav */}
          <View style={styles.wizardNav}>
            <Pressable style={styles.wizardNavBtn} onPress={() => router.back()}>
              <Text style={styles.wizardNavBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.wizardNavBtnPrimary, (!phoneNumber && !clientData?.id) && styles.primaryBtnDisabled]}
              onPress={() => setStep(outdoorMode ? 3 : 2)}
              disabled={!phoneNumber && !clientData?.id}
            >
              <Text style={styles.wizardNavBtnPrimaryText}>
                {outdoorMode ? 'Next: Review →' : 'Next: Gallery →'}
              </Text>
            </Pressable>
          </View>
            </>
          )}

          {/* ─── STEP 2: Gallery ─── */}
          {step === 2 && (
            <>
          {!outdoorMode && (
            <>
              {/* Gallery Details Card */}
              <View style={styles.stepCard}>
                <View style={styles.stepCardHeader}>
                  <View style={styles.stepCardIcon}>
                    <Images size={16} color={Colors.gold} />
                  </View>
                  <Text style={styles.stepCardTitle}>Gallery Setup</Text>
                  {initializedGallery && (
                    <View style={styles.stepCardBadge}>
                      <Check size={10} color={Colors.background} />
                      <Text style={styles.stepCardBadgeText}>Ready</Text>
                    </View>
                  )}
                </View>

                {/* Gallery Title */}
                <View style={styles.modernInputWrap}>
                  <FileText size={16} color={Colors.textMuted} />
                  <TextInput
                    style={styles.modernInput}
                    placeholder={`Title (e.g., Wedding - ${new Date().getFullYear()})`}
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={galleryTitle}
                    onChangeText={setGalleryTitle}
                  />
                </View>

                {/* Shoot Type Chips */}
                <Text style={styles.chipLabel}>Shoot Type</Text>
                <View style={styles.modernChipGrid}>
                  {(['wedding', 'portrait', 'event', 'commercial'] as ShootType[]).map((type) => {
                    const icons: Record<string, string> = { wedding: '💍', portrait: '📸', event: '🎉', commercial: '💼' };
                    return (
                      <Pressable
                        key={type}
                        style={[styles.modernChip, shootType === type && styles.modernChipActive]}
                        onPress={() => {
                          setShootType(type);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text style={styles.modernChipIcon}>{icons[type]}</Text>
                        <Text style={[styles.modernChipText, shootType === type && styles.modernChipTextActive]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Access Code Display */}
                {initializedGallery && (
                  <View style={styles.accessCodeModern}>
                    <View style={styles.accessCodeLeft}>
                      <Text style={styles.accessCodeModernLabel}>ACCESS CODE</Text>
                      <Text style={styles.accessCodeModernValue}>{initializedGallery.accessCode}</Text>
                    </View>
                    <View style={styles.accessCodeActions}>
                      <Pressable style={styles.accessCodeBtn} onPress={copyAccessCode}>
                        <Copy size={16} color={Colors.gold} />
                      </Pressable>
                      <Pressable style={styles.accessCodeBtn}>
                        <Share2 size={16} color={Colors.gold} />
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Create Gallery Button */}
                {!initializedGallery ? (
                  <Pressable
                    style={[
                      styles.modernPrimaryBtn,
                      (isInitializing || (!phoneNumber && !clientData?.id)) && styles.primaryBtnDisabled
                    ]}
                    onPress={handleSetupGallery}
                    disabled={isInitializing || (!phoneNumber && !clientData?.id)}
                  >
                    {isInitializing ? (
                      <View style={styles.btnLoadingRow}>
                        <ActivityIndicator color={Colors.background} size="small" />
                        <Text style={styles.modernPrimaryBtnText}>Creating...</Text>
                      </View>
                    ) : (
                      <>
                        <Hash size={16} color={Colors.background} />
                        <Text style={styles.modernPrimaryBtnText}>Create Gallery & Get Code</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <View style={styles.galleryReadyModern}>
                    <Check size={16} color={Colors.success} />
                    <Text style={styles.galleryReadyModernText}>Gallery created successfully</Text>
                  </View>
                )}
              </View>

              {/* Auto Settings Card */}
              <View style={styles.stepCard}>
                <View style={styles.stepCardHeader}>
                  <View style={styles.stepCardIcon}>
                    <FileText size={16} color="#3B82F6" />
                  </View>
                  <Text style={styles.stepCardTitle}>Auto Settings</Text>
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Shield size={16} color={Colors.textMuted} />
                    <Text style={styles.settingLabel}>Auto-lock gallery</Text>
                  </View>
                  <View style={[styles.settingBadge, { backgroundColor: 'rgba(46,204,113,0.12)' }]}>
                    <Text style={[styles.settingBadgeText, { color: Colors.success }]}>On</Text>
                  </View>
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <FileText size={16} color={Colors.textMuted} />
                    <Text style={styles.settingLabel}>Watermark unpaid photos</Text>
                  </View>
                  <View style={[styles.settingBadge, { backgroundColor: !isPaid ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.06)' }]}>
                    <Text style={[styles.settingBadgeText, { color: !isPaid ? Colors.gold : Colors.textMuted }]}>
                      {isPaid ? 'Off' : 'On'}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Step 2 nav */}
          <View style={styles.wizardNav}>
            <Pressable style={styles.wizardNavBtn} onPress={() => setStep(1)}>
              <Text style={styles.wizardNavBtnText}>← Back</Text>
            </Pressable>
            <Pressable
              style={[styles.wizardNavBtnPrimary, !initializedGallery && !outdoorMode && styles.primaryBtnDisabled]}
              onPress={() => setStep(3)}
              disabled={!initializedGallery && !outdoorMode}
            >
              <Text style={styles.wizardNavBtnPrimaryText}>
                {outdoorMode ? 'Next: Photos →' : initializedGallery ? 'Next: Photos →' : 'Create Gallery first'}
              </Text>
            </Pressable>
          </View>
            </>
          )}

          {/* ─── STEP 3: Photos & Delivery ─── */}
          {step === 3 && (
            <>
          {!outdoorMode && (
            <>
              {/* Photos Card */}
              <View style={styles.stepCard}>
                <View style={styles.stepCardHeader}>
                  <View style={styles.stepCardIcon}>
                    <Camera size={16} color={Colors.gold} />
                  </View>
                  <Text style={styles.stepCardTitle}>Photos</Text>
                  {photos.length > 0 && (
                    <View style={styles.stepCardBadge}>
                      <Text style={styles.stepCardBadgeText}>{photos.length}</Text>
                    </View>
                  )}
                </View>

                {/* Video Upload Coming Soon Banner */}
                <View style={styles.comingSoonBanner}>
                  <Text style={styles.comingSoonBannerIcon}>🎬</Text>
                  <View style={styles.comingSoonBannerContent}>
                    <Text style={styles.comingSoonBannerTitle}>Video Upload Coming Soon</Text>
                    <Text style={styles.comingSoonBannerDesc}>HD video upload with compression — arriving in a future update</Text>
                  </View>
                </View>

                <Pressable style={styles.modernUploadArea} onPress={pickImages} disabled={isPicking}>
                  {isPicking ? (
                    <View style={styles.uploadAreaLoading}>
                      <ActivityIndicator size="small" color={Colors.gold} />
                      <Text style={styles.modernUploadText}>Processing...</Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.uploadIconWrap}>
                        <Camera size={28} color={Colors.gold} />
                      </View>
                      <Text style={styles.modernUploadText}>Tap to select photos</Text>
                      <Text style={styles.modernUploadSub}>RAW, JPEG, PNG — Up to 100 files</Text>
                    </>
                  )}
                </Pressable>

                {photos.length > 0 && (
                  <View style={styles.photoGridContainer}>
                    <FlatList
                      data={photos}
                      renderItem={({ item, index }) => renderPhotoItem({ item, index })}
                      numColumns={3}
                      keyExtractor={(item) => item.id}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingVertical: 8 }}
                      scrollEnabled={false}
                    />
                    <View style={styles.photoGridFooter}>
                      <Text style={styles.photoGridFooterText}>
                        {photos.length} photo{photos.length !== 1 ? 's' : ''} • {formatFileSize(getTotalFileSize())}
                        {photos.some(p => p.compressed) ? ` • ${photos.filter(p => p.compressed).length} compressed` : ''}
                      </Text>
                      <Pressable
                        onPress={() => Alert.alert('Clear All', 'Remove all selected photos?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Clear', style: 'destructive', onPress: () => setPhotos([]) }
                        ])}
                      >
                        <Text style={styles.photoGridClear}>Clear All</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>

              {/* Delivery Settings Card */}
              <View style={[styles.stepCard, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }]}>
                <View style={styles.stepCardHeader}>
                  <View style={[styles.stepCardIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                    <Send size={16} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepCardTitle}>Delivery</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
                      Configure how photos reach your client
                    </Text>
                  </View>
                  {isPaid && (
                    <View style={{ backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, color: '#22C55E', fontWeight: '600' }}>PAID</Text>
                    </View>
                  )}
                  {!isPaid && (
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, color: Colors.textMuted, fontWeight: '600' }}>FREE</Text>
                    </View>
                  )}
                </View>

                {/* Payment Status */}
                <View style={[styles.settingRow, { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 }]}>
                  <View style={styles.settingInfo}>
                    <CreditCard size={16} color={isPaid ? Colors.success : Colors.textMuted} />
                    <View>
                      <Text style={styles.settingLabel}>Payment Required</Text>
                      <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                        {isPaid ? `Client pays KES ${price || '0'} to unlock clean photos` : 'Free gallery — all photos accessible'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={isPaid}
                    onValueChange={setIsPaid}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(34,197,94,0.4)' }}
                    thumbColor={isPaid ? '#22C55E' : '#666'}
                  />
                </View>

                {/* Price Input (shown when Paid) */}
                {isPaid && (
                  <View style={[styles.priceInputRow, { marginTop: 8 }]}>
                    <View style={[styles.priceInputWrap, { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' }]}>
                      <DollarSign size={16} color={Colors.gold} />
                      <TextInput
                        style={[styles.priceInput, { flex: 1 }]}
                        placeholder="0.00"
                        placeholderTextColor={Colors.textMuted}
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="decimal-pad"
                      />
                      <Text style={[styles.priceCurrency, { marginRight: 8 }]}>KES</Text>
                    </View>
                  </View>
                )}

                {/* Custom Message */}
                <View style={[styles.customMessageWrap, { marginTop: 12 }]}>
                  <Text style={[styles.chipLabel, { marginBottom: 6 }]}>CUSTOM MESSAGE (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.customMessageInput, { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12 }]}
                    placeholder="Add a personal note for the client..."
                    placeholderTextColor={Colors.textMuted}
                    value={customMessage}
                    onChangeText={setCustomMessage}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                {/* Notification Toggle */}
                <View style={[styles.settingRow, { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 }]}>
                  <View style={styles.settingInfo}>
                    <Send size={16} color={sendNotificationAfterUpload ? Colors.gold : Colors.textMuted} />
                    <View>
                      <Text style={styles.settingLabel}>Notify client after upload</Text>
                      <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                        {sendNotificationAfterUpload
                          ? `Send via ${deliveryMethods.map(m => m === 'in_app' ? 'In-App' : m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}`
                          : 'No notification will be sent'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={sendNotificationAfterUpload}
                    onValueChange={setSendNotificationAfterUpload}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212,175,55,0.4)' }}
                    thumbColor={sendNotificationAfterUpload ? Colors.gold : '#666'}
                  />
                </View>

                {/* Require Payment Toggle */}
                <View style={[styles.settingRow, { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 }]}>
                  <View style={styles.settingInfo}>
                    <AlertTriangle size={16} color={requirePaymentBeforeDownload ? Colors.gold : Colors.textMuted} />
                    <View>
                      <Text style={styles.settingLabel}>Require payment before download</Text>
                      <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                        {requirePaymentBeforeDownload ? 'Client must pay before downloading HD photos' : 'Downloads available immediately'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={requirePaymentBeforeDownload}
                    onValueChange={setRequirePaymentBeforeDownload}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212,175,55,0.4)' }}
                    thumbColor={requirePaymentBeforeDownload ? Colors.gold : '#666'}
                  />
                </View>

                {/* Delayed Release Toggle */}
                <View style={[styles.settingRow, { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 }]}>
                  <View style={styles.settingInfo}>
                    <Calendar size={16} color={delayedDelivery ? Colors.gold : Colors.textMuted} />
                    <View>
                      <Text style={styles.settingLabel}>Delayed release</Text>
                      <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                        {delayedDelivery ? `Release on ${releaseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Gallery available immediately'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={delayedDelivery}
                    onValueChange={setDelayedDelivery}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(212,175,55,0.4)' }}
                    thumbColor={delayedDelivery ? Colors.gold : '#666'}
                  />
                </View>

                {/* Release Date Picker (shown when delayed) */}
                {delayedDelivery && (
                  <View style={[styles.releaseDateRow, { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 10 }]}>
                    <Text style={styles.releaseDateLabel}>Release on</Text>
                    <Pressable
                      style={[styles.releaseDateBtn, { backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Calendar size={14} color={Colors.gold} />
                      <Text style={[styles.releaseDateText, { marginLeft: 6 }]}>
                        {releaseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Delivery Method Chips */}
                <Text style={[styles.chipLabel, { marginTop: 14 }]}>DELIVERY CHANNELS</Text>
                <View style={[styles.modernChipGrid, { gap: 8 }]}>
                  {([
                    { key: 'sms', icon: '💬', label: 'SMS', desc: 'Text message with link' },
                    { key: 'whatsapp', icon: '📱', label: 'WhatsApp', desc: 'WhatsApp message' },
                    { key: 'email', icon: '✉️', label: 'Email', desc: 'Email delivery', comingSoon: true },
                    { key: 'in_app', icon: '🔔', label: 'In-App', desc: 'Push notification' },
                  ] as const).map((method) => (
                    <Pressable
                      key={method.key}
                      style={[
                        styles.modernChip,
                        deliveryMethods.includes(method.key) && styles.modernChipActive,
                        method.comingSoon && styles.modernChipDisabled,
                        { flex: 1, minWidth: '45%' }
                      ]}
                      onPress={() => {
                        if (method.comingSoon) {
                          Alert.alert('Coming Soon', 'Email delivery will be available in a future update.');
                          return;
                        }
                        toggleDeliveryMethod(method.key);
                      }}
                    >
                      <Text style={styles.modernChipIcon}>{method.icon}</Text>
                      <Text style={[
                        styles.modernChipText,
                        deliveryMethods.includes(method.key) && styles.modernChipTextActive,
                        method.comingSoon && styles.modernChipTextDisabled,
                      ]}>
                        {method.label}
                      </Text>
                      {method.comingSoon && (
                        <View style={styles.comingSoonBadge}>
                          <Text style={styles.comingSoonText}>SOON</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>

                {/* Access Code */}
                {accessCode && (
                  <View style={[styles.accessCodeModern, { marginTop: 14, backgroundColor: 'rgba(212,175,55,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)' }]}>
                    <View style={styles.accessCodeLeft}>
                      <Text style={styles.accessCodeModernLabel}>ACCESS CODE</Text>
                      <Text style={[styles.accessCodeModernValue, { fontSize: 20, letterSpacing: 2 }]}>{accessCode}</Text>
                    </View>
                    <Pressable style={[styles.accessCodeBtn, { backgroundColor: 'rgba(212,175,55,0.12)' }]} onPress={copyAccessCode}>
                      <Copy size={16} color={Colors.gold} />
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Upload Progress (shown during upload) */}
              {isUploading && (
                <View style={styles.stepCard}>
                  <View style={styles.stepCardHeader}>
                    <View style={styles.stepCardIcon}>
                      <Send size={16} color={Colors.gold} />
                    </View>
                    <Text style={styles.stepCardTitle}>Upload Progress</Text>
                  </View>

                  {uploadStatus ? (
                    <Text style={styles.uploadStatusText}>{uploadStatus}</Text>
                  ) : null}

                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: uploadProgress.total > 0 ? `${(uploadProgress.completed / uploadProgress.total) * 100}%` : '0%' },
                      ]}
                    />
                  </View>

                  <View style={styles.progressInfoRow}>
                    <Text style={styles.progressInfoText}>
                      {uploadProgress.completed} / {uploadProgress.total} files
                    </Text>
                    <Text style={styles.progressInfoText}>
                      {uploadSpeed > 0
                        ? uploadSpeed >= 1
                          ? `${uploadSpeed.toFixed(1)} MB/s`
                          : `${(uploadSpeed * 1024).toFixed(0)} KB/s`
                        : ''}
                    </Text>
                    {uploadEta ? (
                      <Text style={styles.progressInfoText}>ETA: {uploadEta}</Text>
                    ) : null}
                  </View>

                  {uploadBytes.total > 0 && (
                    <View style={styles.progressInfoRow}>
                      <Text style={styles.progressInfoText}>
                        {(uploadBytes.uploaded / (1024 * 1024)).toFixed(1)} MB / {(uploadBytes.total / (1024 * 1024)).toFixed(1)} MB
                      </Text>
                    </View>
                  )}

                  {uploadProgress.currentFile ? (
                    <Text style={styles.progressCurrentFile} numberOfLines={1}>
                      {uploadProgress.currentFile}
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Upload Actions */}
              <View style={styles.actions}>
                <Pressable
                  style={[
                    styles.modernPrimaryBtn,
                    (isUploading || (photos.length === 0 && !outdoorMode)) && styles.primaryBtnDisabled
                  ]}
                  onPress={handleUpload}
                  disabled={isUploading || (photos.length === 0 && !outdoorMode)}
                >
                  {isUploading ? (
                    <View style={styles.btnLoadingRow}>
                      <ActivityIndicator color={Colors.gold} size="small" />
                      <Text style={styles.modernPrimaryBtnText}>Uploading...</Text>
                    </View>
                  ) : (
                    <>
                      <Send size={16} color={Colors.background} />
                      <Text style={styles.modernPrimaryBtnText}>
                        {initializedGallery
                          ? `Upload ${photos.length} Photo${photos.length !== 1 ? 's' : ''}`
                          : `Upload & Create Gallery`}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}

          {/* Outdoor Mode: Save Client Button */}
          {outdoorMode && (
            <View style={styles.actions}>
              <Pressable
                style={[styles.modernPrimaryBtn, isUploading && styles.primaryBtnDisabled]}
                onPress={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <View style={styles.btnLoadingRow}>
                    <ActivityIndicator color={Colors.gold} size="small" />
                    <Text style={styles.modernPrimaryBtnText}>Saving...</Text>
                  </View>
                ) : (
                  <>
                    <User size={16} color={Colors.background} />
                    <Text style={styles.modernPrimaryBtnText}>Save Client Offline</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Step 3 nav */}
          <View style={styles.wizardNav}>
            <Pressable style={styles.wizardNavBtn} onPress={() => setStep(outdoorMode ? 1 : 2)}>
              <Text style={styles.wizardNavBtnText}>← Back</Text>
            </Pressable>
          </View>
            </>
          )}

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
              {deliveryMethods.length > 0
                ? `Sent via ${deliveryMethods.map(m => m === 'in_app' ? 'In-App' : m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}`
                : 'Gallery is live. Send access code manually.'}
            </Text>

            {accessCode && (
              <View style={styles.successAccessCode}>
                <Text style={styles.successAccessLabel}>Access Code</Text>
                <Text style={styles.successAccessValue}>{accessCode}</Text>
                <Pressable onPress={copyAccessCode}>
                  <Copy size={16} color={Colors.gold} />
                </Pressable>
              </View>
            )}

            {accessCode && (
              <View style={styles.qrWrapper}>
                <QRCode
                  value={`${accessLink}${accessCode}`}
                  size={120}
                  color={Colors.white}
                  backgroundColor="transparent"
                />
                <Text style={styles.qrHint}>Scan to open gallery</Text>
              </View>
            )}

            <View style={styles.successActions}>
              {!deliveryMethods.includes('sms') && (
                <Pressable style={styles.actionBtnRow} onPress={handleSendSMS}>
                  <Send size={16} color={Colors.white} />
                  <Text style={styles.actionBtnText}>Send SMS</Text>
                </Pressable>
              )}
              {!deliveryMethods.includes('whatsapp') && (
                <Pressable style={[styles.actionBtnRow, { backgroundColor: '#25D366', borderColor: '#25D366' }]} onPress={handleSendWhatsApp}>
                  <MessageCircle size={16} color={Colors.white} />
                  <Text style={styles.actionBtnText}>Send WhatsApp</Text>
                </Pressable>
              )}
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

      {/* Simple Date Picker Modal */}
      <Modal visible={showDatePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModal}>
            <View style={styles.stepCardHeader}>
              <View style={styles.stepCardIcon}>
                <Calendar size={16} color={Colors.gold} />
              </View>
              <Text style={styles.stepCardTitle}>Select Release Date</Text>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <X size={18} color={Colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.dateOptions}>
              {[
                { label: '1 Week', days: 7 },
                { label: '2 Weeks', days: 14 },
                { label: '1 Month', days: 30 },
                { label: '2 Months', days: 60 },
                { label: '3 Months', days: 90 },
              ].map((opt) => {
                const d = new Date();
                d.setDate(d.getDate() + opt.days);
                const isSelected = releaseDate.toDateString() === d.toDateString();
                return (
                  <Pressable
                    key={opt.label}
                    style={[styles.dateOptionBtn, isSelected && styles.dateOptionBtnActive]}
                    onPress={() => {
                      setReleaseDate(d);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={[styles.dateOptionLabel, isSelected && styles.dateOptionLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.dateOptionDate, isSelected && styles.dateOptionDateActive]}>
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.customDateRow}>
              <Text style={styles.chipLabel}>CUSTOM DATE</Text>
              <TextInput
                style={styles.customDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                value={releaseDate.toISOString().split('T')[0]}
                onChangeText={(text) => {
                  const d = new Date(text);
                  if (!isNaN(d.getTime())) setReleaseDate(d);
                }}
                keyboardType="numbers-and-punctuation"
              />
            </View>
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
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(46, 204, 113, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.15)',
  },
  statusBadgeOffline: {
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    borderColor: 'rgba(231, 76, 60, 0.15)',
  },
  statusDotOnline: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.success,
  },
  statusDotOffline: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.error,
  },
  statusText: {
    fontSize: 11,
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
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  photoSizeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 10,
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
    backgroundColor: 'rgba(212,175,55,0.03)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.15)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadAreaLoading: {
    alignItems: 'center',
    gap: 12,
  },
  uploadAreaContent: {
    alignItems: 'center',
    gap: 8,
  },
  uploadIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(212,175,55,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.gold,
  },
  uploadSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 2,
  },
  photoList: {
    flex: 1,
  },
  photoStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  photoStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoStatsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  statsDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  clearPhotosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.15)',
  },
  clearPhotosText: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '600',
  },
  photoItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    margin: 4,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.card,
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.card,
  },
  photoIndex: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIndexText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  photoUploading: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(212,175,55,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.background,
    letterSpacing: 0.3,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  uploadProgressContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  uploadStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    textAlign: 'center',
  },
  currentFile: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  uploadSpeedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  uploadSpeedText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  uploadSpeedDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
  },
  uploadFileList: {
    width: '100%',
    marginTop: 12,
    gap: 6,
  },
  uploadFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
  },
  uploadFileDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadFileDotDone: {
    backgroundColor: Colors.success,
  },
  uploadFileDotCurrent: {
    backgroundColor: Colors.gold,
  },
  uploadFileName: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  uploadFileNameDone: {
    color: Colors.success,
  },
  uploadFileSize: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
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
    marginBottom: 20,
    lineHeight: 22,
  },
  successAccessCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    width: '100%',
  },
  successAccessLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  successAccessValue: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.gold,
    letterSpacing: 2,
  },
  qrWrapper: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  qrHint: {
    fontSize: 11,
    color: Colors.textMuted,
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
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  progressStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  progressDotActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  progressDotCurrent: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  progressDotText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
  },
  progressDotTextActive: {
    color: Colors.background,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.25)',
    minWidth: 48,
  },
  progressLabelActive: {
    color: Colors.gold,
  },
  progressLine: {
    width: 32,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: Colors.gold,
  },
  wizardNav: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  wizardNavBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  wizardNavBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  wizardNavBtnPrimary: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: 'center',
  },
  wizardNavBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.background,
  },
  // ── Modern Step 1 Styles ──
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  offlineCardActive: {
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderColor: 'rgba(212,175,55,0.2)',
  },
  offlineIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(46,204,113,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineIconWrapActive: {
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  offlineCardContent: {
    flex: 1,
  },
  offlineCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  offlineCardSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  stepCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  stepCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  stepCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.background,
  },
  modernInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 10,
  },
  modernInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.white,
    paddingVertical: 0,
  },
  modernClientList: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  modernClientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  modernClientItemActive: {
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  modernClientAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernClientAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gold,
  },
  modernClientInfo: {
    flex: 1,
  },
  modernClientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  modernClientPhone: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  modernClientAction: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
  selectedClientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  selectedClientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(46,204,113,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedClientAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.success,
  },
  selectedClientInfo: {
    flex: 1,
  },
  selectedClientName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  selectedClientMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  newClientPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  newClientPromptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newClientPromptText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
  // ── Modern Step 2 & 3 Styles ──
  chipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  modernChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  modernChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modernChipActive: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: 'rgba(212,175,55,0.3)',
  },
  modernChipIcon: {
    fontSize: 14,
  },
  modernChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  modernChipTextActive: {
    color: Colors.gold,
  },
  accessCodeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  accessCodeLeft: { flex: 1 },
  accessCodeModernLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  accessCodeModernValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.gold,
    letterSpacing: 2,
  },
  accessCodeActions: { flexDirection: 'row', gap: 8 },
  accessCodeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  modernPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.gold,
    marginTop: 14,
  },
  modernPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.background,
  },
  galleryReadyModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.2)',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  galleryReadyModernText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.success,
  },
  settingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  settingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modernUploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.2)',
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.03)',
    marginBottom: 12,
  },
  modernUploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginTop: 8,
  },
  modernUploadSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  photoGridContainer: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  photoGridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  photoGridFooterText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  photoGridClear: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.error,
  },
  compressedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.gold,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  compressedBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.background,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  priceInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    padding: 0,
  },
  priceCurrency: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gold,
  },
  customMessageWrap: {
    marginTop: 12,
  },
  customMessageInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.white,
    minHeight: 70,
    marginTop: 8,
  },
  releaseDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 28,
  },
  releaseDateLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  releaseDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212,175,55,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  releaseDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gold,
  },
  datePickerModal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    margin: 20,
    padding: 20,
    maxHeight: '70%',
  },
  dateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  dateOptionBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  dateOptionBtnActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: Colors.gold,
  },
  dateOptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  dateOptionLabelActive: {
    color: Colors.gold,
  },
  dateOptionDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  dateOptionDateActive: {
    color: Colors.gold,
  },
  customDateRow: {
    marginTop: 16,
  },
  customDateInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.white,
    marginTop: 8,
  },
  uploadStatusText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 10,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  progressCurrentFile: {
    fontSize: 11,
    color: Colors.gold,
    marginTop: 6,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  comingSoonText: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  modernChipDisabled: {
    opacity: 0.5,
  },
  modernChipTextDisabled: {
    color: Colors.textMuted,
  },
  comingSoonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    borderStyle: 'dashed',
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  comingSoonBannerIcon: {
    fontSize: 22,
  },
  comingSoonBannerContent: {
    flex: 1,
  },
  comingSoonBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gold,
  },
  comingSoonBannerDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
