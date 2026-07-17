import { Platform } from 'react-native';
import { supabase } from './supabase';

let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch {
  // Not available on web
}

export interface CompressedImage {
  uri: string;
  width: number;
  height: number;
  size: number;
  compressed: boolean;
}

export interface ThumbnailImage {
  uri: string;
  width: number;
  height: number;
}

async function getFileSize(uri: string): Promise<number> {
  if (Platform.OS === 'web') {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      return blob.size;
    } catch { return 0; }
  }
  const FileSystem = require('expo-file-system');
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? (info as any).size || 0 : 0;
}

/**
 * Compress an image to max 2400px width, JPEG 0.85 quality.
 * Returns the compressed URI and metadata.
 */
export async function compressImage(uri: string): Promise<CompressedImage> {
  const originalSize = await getFileSize(uri);

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
      console.warn('[Compress] Native manipulation failed:', e);
    }
  }

  return { uri, width: 0, height: 0, size: originalSize, compressed: false };
}

/**
 * Generate a thumbnail (max 512px width) from an image URI.
 * Used for instant previews in gallery grids and home screen.
 */
export async function generateThumbnail(uri: string): Promise<ThumbnailImage | null> {
  if (!ImageManipulator) return null;

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 512 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: false }
    );
    return { uri: result.uri, width: result.width, height: result.height };
  } catch (e) {
    console.warn('[Thumbnail] Generation failed:', e);
    return null;
  }
}

/**
 * Compress an image and generate a thumbnail in one pass.
 * Returns both the compressed image and thumbnail URIs.
 */
export async function compressWithThumbnail(
  uri: string
): Promise<{ compressed: CompressedImage; thumbnail: ThumbnailImage | null }> {
  const [compressed, thumbnail] = await Promise.all([
    compressImage(uri),
    generateThumbnail(uri),
  ]);
  return { compressed, thumbnail };
}

/**
 * Upload a file to Supabase storage with retry logic.
 */
export async function uploadWithRetry(
  bucket: string,
  path: string,
  file: Blob | ArrayBuffer,
  options: { contentType: string; upsert?: boolean },
  maxRetries = 3
): Promise<{ error: any }> {
  let lastError: any = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, options);
    if (!error) return { error: null };
    lastError = error;
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return { error: lastError };
}
