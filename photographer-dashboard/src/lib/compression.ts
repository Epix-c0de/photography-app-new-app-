import { supabase } from './supabase';

export type CompressionPreset = 'thumbnail' | 'preview' | 'standard' | 'full';

interface CompressedImage {
  compressedBase64: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
  format: string;
  filename: string;
  usedClientSide: boolean;
}

interface CompressionRecommendation {
  maxWidth: number;
  quality: number;
  preset: string;
}

const PRESET_CONFIG: Record<CompressionPreset, { maxWidth: number; quality: number }> = {
  thumbnail: { maxWidth: 400, quality: 0.80 },
  preview: { maxWidth: 1200, quality: 0.85 },
  standard: { maxWidth: 2400, quality: 0.88 },
  full: { maxWidth: 4000, quality: 0.90 },
};

/**
 * Compress an image — tries Edge Function first, falls back to client-side
 * Targets 5-10MB max, similar to Pixieset compression
 */
export async function compressImage(
  file: File,
  preset: CompressionPreset = 'standard'
): Promise<CompressedImage> {
  // If file is small, don't compress
  if (file.size <= 5 * 1024 * 1024) {
    const base64 = await fileToBase64(file);
    return {
      compressedBase64: base64,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: '0%',
      format: file.type.includes('png') ? 'png' : 'jpg',
      filename: file.name,
      usedClientSide: false,
    };
  }

  try {
    // Try Edge Function first
    const base64 = await fileToBase64(file);
    const { data, error } = await supabase.functions.invoke('compress-image', {
      body: {
        imageBase64: base64,
        mimeType: file.type,
        preset,
        filename: file.name,
      },
    });

    if (error) throw error;

    // If Edge Function says client-side compression is needed
    if (data.needsCompression) {
      return await compressImageClientSide(file, data.recommendation);
    }

    return {
      ...data,
      usedClientSide: false,
    };
  } catch (error) {
    console.warn('Edge Function compression failed, using client-side:', error);
    return await compressImageClientSide(file, PRESET_CONFIG[preset]);
  }
}

/**
 * Client-side compression using Canvas API
 * Works in all browsers, no server needed
 */
async function compressImageClientSide(
  file: File,
  recommendation: CompressionRecommendation | { maxWidth: number; quality: number }
): Promise<CompressedImage> {
  const config = PRESET_CONFIG.standard;
  const maxWidth = recommendation.maxWidth || config.maxWidth;
  const quality = recommendation.quality || config.quality;

  const compressedBlob = await compressWithCanvas(file, maxWidth, quality);
  const compressedBase64 = await blobToBase64(compressedBlob);

  return {
    compressedBase64,
    originalSize: file.size,
    compressedSize: compressedBlob.size,
    compressionRatio: ((1 - compressedBlob.size / file.size) * 100).toFixed(1) + '%',
    format: 'jpg',
    filename: file.name.replace(/\.[^.]+$/, '.jpg'),
    usedClientSide: true,
  };
}

/**
 * Compress image using Canvas API
 */
function compressWithCanvas(
  file: File,
  maxWidth: number,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Scale down if needed
      if (width > maxWidth || height > maxWidth) {
        const ratio = Math.min(maxWidth / width, maxWidth / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw with white background (for JPEG)
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas compression failed'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Convert File to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get recommended compression preset based on file size
 */
export function getRecommendedPreset(fileSize: number): CompressionPreset {
  if (fileSize > 50 * 1024 * 1024) return 'preview'; // >50MB
  if (fileSize > 20 * 1024 * 1024) return 'standard'; // >20MB
  if (fileSize > 10 * 1024 * 1024) return 'standard'; // >10MB
  return 'full'; // <10MB keep full quality
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
