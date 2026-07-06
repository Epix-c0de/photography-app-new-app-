import { supabase } from './supabase';

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
  ultraLow: {
    maxWidth: 600,
    quality: 0.5,
    format: 'webp',
    description: '2G networks - fastest loading',
  },
  low: {
    maxWidth: 800,
    quality: 0.6,
    format: 'webp',
    description: '3G networks - balanced',
  },
  medium: {
    maxWidth: 1200,
    quality: 0.75,
    format: 'jpeg',
    description: '4G networks - good quality',
  },
  high: {
    maxWidth: 1800,
    quality: 0.85,
    format: 'jpeg',
    description: 'Fast 4G - high quality',
  },
  wifi: {
    maxWidth: 2400,
    quality: 0.9,
    format: 'jpeg',
    description: 'WiFi - full quality',
  },
};

/**
 * Detect network quality based on connection type and speed
 */
export function detectNetworkQuality(): NetworkQuality {
  if (typeof navigator === 'undefined' || !navigator.connection) {
    return 'medium'; // Default for SSR
  }

  const connection = (navigator as any).connection;
  const effectiveType = connection?.effectiveType || '4g';
  const downlink = connection?.downlink || 10;

  // WiFi
  if (connection?.type === 'wifi' || connection?.type === 'ethernet') {
    return 'wifi';
  }

  // 2G or very slow
  if (effectiveType === 'slow-2g' || downlink < 0.3) {
    return 'ultraLow';
  }

  // 2G
  if (effectiveType === '2g' || downlink < 0.7) {
    return 'low';
  }

  // 3G
  if (effectiveType === '3g' || downlink < 2) {
    return 'medium';
  }

  // 4G or faster
  if (downlink >= 5) {
    return 'high';
  }

  return 'medium';
}

/**
 * Get compression preset for detected network
 */
export function getNetworkPreset(networkQuality?: NetworkQuality): CompressionPreset {
  const quality = networkQuality || detectNetworkQuality();
  return NETWORK_PRESETS[quality];
}

/**
 * Compress image for Safaricom network
 * Uses expo-image-manipulator on mobile, Canvas on web
 */
export async function compressForNetwork(
  uri: string,
  networkQuality?: NetworkQuality
): Promise<{ uri: string; width: number; height: number }> {
  const preset = getNetworkPreset(networkQuality);

  // Dynamic import to avoid issues on web
  try {
    const ImageManipulator = require('expo-image-manipulator');
    
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
    // Fallback for web or if expo-image-manipulator is not available
    console.warn('Image manipulation failed, using original:', error);
    return { uri, width: 0, height: 0 };
  }
}

/**
 * Get network quality label for UI display
 */
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

/**
 * Get network quality color for UI
 */
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
