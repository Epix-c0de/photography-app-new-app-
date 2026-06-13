// Task 10.1: QR Code Scanner for photographer code assignment
// Requirements: 2.5

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { X, Scan } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

const { width, height } = Dimensions.get('window');
const SCAN_AREA_SIZE = Math.min(width, height) * 0.7;

interface QRCodeScannerProps {
  onClose: () => void;
  onSuccess: (photographerName: string, photographerId: string) => void;
}

export default function QRCodeScanner({ onClose, onSuccess }: QRCodeScannerProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device settings to scan QR codes.',
          [
            { text: 'Cancel', onPress: onClose, style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              // Note: opening settings requires expo-linking or Linking from react-native
              onClose();
            }},
          ]
        );
      }
    } catch (error) {
      console.error('[QRCodeScanner] Permission error:', error);
      Alert.alert('Error', 'Failed to request camera permission.');
      onClose();
    }
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || processing) return;

    setScanned(true);
    setProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Extract photographer code from QR payload
      const photographerCode = extractPhotographerCode(data);

      if (!photographerCode) {
        Alert.alert(
          'Invalid QR Code',
          'This QR code does not contain a valid photographer code. Please scan the code provided by your photographer.',
          [{ text: 'OK', onPress: () => {
            setScanned(false);
            setProcessing(false);
          }}]
        );
        return;
      }

      // Call assignment function with qr_scan assigned_via
      await assignPhotographer(photographerCode);
    } catch (error) {
      console.error('[QRCodeScanner] Scan error:', error);
      Alert.alert(
        'Error',
        'Failed to process QR code. Please try again.',
        [{ text: 'OK', onPress: () => {
          setScanned(false);
          setProcessing(false);
        }}]
      );
    }
  };

  const extractPhotographerCode = (qrData: string): string | null => {
    try {
      // Try parsing as JSON (expected format: { type: 'photographer_code', code: 'ABC12345' })
      const parsed = JSON.parse(qrData);
      
      if (parsed.type === 'photographer_code' && parsed.code) {
        const code = String(parsed.code).toUpperCase();
        
        // Validate format: 8 alphanumeric characters
        if (/^[A-Z0-9]{8}$/.test(code)) {
          return code;
        }
      }
    } catch {
      // Not JSON, check if it's a direct code
      const trimmed = qrData.trim().toUpperCase();
      
      // Check if it matches the expected format
      if (/^[A-Z0-9]{8}$/.test(trimmed)) {
        return trimmed;
      }

      // Check if it's a URL with code parameter
      try {
        const url = new URL(qrData);
        const codeParam = url.searchParams.get('code');
        if (codeParam && /^[A-Z0-9]{8}$/.test(codeParam.toUpperCase())) {
          return codeParam.toUpperCase();
        }
      } catch {
        // Not a valid URL
      }
    }

    return null;
  };

  const assignPhotographer = async (photographerCode: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to scan a photographer code.');
      setScanned(false);
      setProcessing(false);
      return;
    }

    try {
      // Call assignment RPC with assigned_via='qr_scan'
      const { data, error } = await supabase.rpc('assign_client_to_photographer', {
        p_client_id: user.id,
        p_photographer_code: photographerCode,
        p_assigned_via: 'qr_scan',
      });

      if (error) {
        console.error('[QRCodeScanner] Assignment error:', error);
        Alert.alert(
          'Error',
          'Failed to connect with photographer. Please try again.',
          [{ text: 'OK', onPress: () => {
            setScanned(false);
            setProcessing(false);
          }}]
        );
        return;
      }

      if (!data?.success) {
        Alert.alert(
          'Connection Failed',
          data?.error || 'Unable to connect with this photographer.',
          [{ text: 'OK', onPress: () => {
            setScanned(false);
            setProcessing(false);
          }}]
        );
        return;
      }

      // Success!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const photographerName = data.admin_name || 'your photographer';
      const photographerId = data.admin_id;

      Alert.alert(
        'Connected!',
        `Successfully connected to ${photographerName}!`,
        [{
          text: 'OK',
          onPress: () => {
            onSuccess(photographerName, photographerId);
          },
        }]
      );
    } catch (error) {
      console.error('[QRCodeScanner] Unexpected error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK', onPress: () => {
          setScanned(false);
          setProcessing(false);
        }}]
      );
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>Requesting camera permission...</Text>
        </View>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>Camera access denied</Text>
          <Text style={styles.messageSubtext}>
            Please enable camera permissions in your device settings to scan QR codes.
          </Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top section */}
        <View style={[styles.overlaySection, { paddingTop: insets.top + 16 }]}>
          <Pressable
            style={styles.closeIconButton}
            onPress={onClose}
            disabled={processing}
          >
            <X size={24} color={Colors.white} />
          </Pressable>
        </View>

        {/* Middle section with scan area */}
        <View style={styles.overlayMiddle}>
          <View style={styles.scanAreaContainer}>
            <View style={[styles.scanArea, { width: SCAN_AREA_SIZE, height: SCAN_AREA_SIZE }]}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />

              {/* Scan icon */}
              {!scanned && !processing && (
                <View style={styles.scanIcon}>
                  <Scan size={48} color={Colors.gold} strokeWidth={1.5} />
                </View>
              )}

              {processing && (
                <View style={styles.processingContainer}>
                  <Text style={styles.processingText}>Processing...</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bottom section */}
        <View style={styles.overlaySection}>
          <Text style={styles.instructionText}>
            {processing
              ? 'Connecting to photographer...'
              : scanned
              ? 'QR Code Scanned'
              : 'Point camera at photographer QR code'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  overlaySection: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  closeIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayMiddle: {
    flex: 1,
    flexDirection: 'row',
  },
  scanAreaContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: Colors.gold,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scanIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
  },
  processingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -12 }],
    width: 100,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.gold,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
  },
  messageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  messageText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 16,
  },
  messageSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  closeButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
