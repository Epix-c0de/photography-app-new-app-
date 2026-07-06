import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { isNetworkCompressionEnabled } from './compression-settings';

let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch {
  // expo-image-manipulator not available on web
}

/**
 * Safaricom-Optimized Compression
 * Extra compression for users on slow Safaricom data bundles
 * Targets: < 2MB for thumbnails, < 5MB for full images
 */

export type NetworkQuality = 'ultraLow' | 'low' | 'medium' | 'high' | 'wifi';

interface CompressionPreset {
  maxWidth: number;
  quality: number;
  format: 'jpeg' | 'webp';
  description: string;
}

const NETWORK_PRESETS: Record<NetworkQuality, CompressionPreset> = {
  ultraLow: { maxWidth: 600, quality: 0.5, format: 'webp', description: '2G networks - fastest loading' },
  low: { maxWidth: 800, quality: 0.6, format: 'webp', description: '3G networks - balanced' },
  medium: { maxWidth: 1200, quality: 0.75, format: 'jpeg', description: '4G networks - good quality' },
  high: { maxWidth: 1800, quality: 0.85, format: 'jpeg', description: 'Fast 4G - high quality' },
  wifi: { maxWidth: 2400, quality: 0.9, format: 'jpeg', description: 'WiFi - full quality' },
};

/**
 * Detect network quality using React Native NetInfo
 */
export async function detectNetworkQuality(): Promise<NetworkQuality> {
  try {
    const state = await NetInfo.fetch();
    if (state.type === 'wifi' || state.type === 'ethernet') return 'wifi';
    if (!state.isConnected) return 'medium';

    const downlink = state.downlink ?? 10;
    if (downlink < 0.3) return 'ultraLow';
    if (downlink < 0.7) return 'low';
    if (downlink < 2) return 'medium';
    if (downlink >= 5) return 'high';
    return 'medium';
  } catch {
    return 'medium';
  }
}

export function getNetworkPreset(networkQuality: NetworkQuality): CompressionPreset {
  return NETWORK_PRESETS[networkQuality];
}

/**
 * Compress a local image file for current network conditions
 */
export async function compressForNetwork(
  uri: string,
  networkQuality?: NetworkQuality
): Promise<{ uri: string; width: number; height: number }> {
  if (!ImageManipulator) return { uri, width: 0, height: 0 };

  const enabled = await isNetworkCompressionEnabled();
  const quality = networkQuality || (enabled ? await detectNetworkQuality() : 'wifi');
  const preset = getNetworkPreset(quality);

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: preset.maxWidth } }],
      {
        compress: preset.quality,
        format: preset.format === 'webp' ? ImageManipulator.SaveFormat.WEBP : ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result;
  } catch (error) {
    console.warn('Compression failed, using original:', error);
    return { uri, width: 0, height: 0 };
  }
}

/**
 * Download and compress a remote photo URL to local cache
 */
export async function downloadAndCompress(
  remoteUri: string,
  localPath: string,
  networkQuality?: NetworkQuality
): Promise<string> {
  if (!ImageManipulator) {
    await FileSystem.downloadAsync(remoteUri, localPath);
    return localPath;
  }

  const enabled = await isNetworkCompressionEnabled();
  if (!enabled) {
    await FileSystem.downloadAsync(remoteUri, localPath);
    return localPath;
  }

  const quality = networkQuality || await detectNetworkQuality();
  const preset = getNetworkPreset(quality);

  // Download original first
  const tempPath = localPath + '.temp';
  await FileSystem.downloadAsync(remoteUri, tempPath);

  try {
    const result = await ImageManipulator.manipulateAsync(
      tempPath,
      [{ resize: { width: preset.maxWidth } }],
      {
        compress: preset.quality,
        format: preset.format === 'webp' ? ImageManipulator.SaveFormat.WEBP : ImageManipulator.SaveFormat.JPEG,
      }
    );

    // Move compressed to final location
    await FileSystem.moveAsync({ from: result.uri, to: localPath });
    await FileSystem.deleteAsync(tempPath, { idempotent: true });
    return localPath;
  } catch {
    // Fallback: use uncompressed
    await FileSystem.moveAsync({ from: tempPath, to: localPath });
    return localPath;
  }
}

export function getNetworkLabel(quality: NetworkQuality): string {
  const labels: Record<NetworkQuality, string> = {
    ultraLow: '2G - Fast Loading',
    low: '3G - Balanced',
    medium: '4G - Good Quality',
    high: 'Fast 4G - High Quality',
    wifi: 'WiFi - Full Quality',
  };
  return labels[quality];
}

export function getNetworkColor(quality: NetworkQuality): string {
  const colors: Record<NetworkQuality, string> = {
    ultraLow: '#FF3B30',
    low: '#FF9500',
    medium: '#FFCC00',
    high: '#34C759',
    wifi: '#007AFF',
  };
  return colors[quality];
}
