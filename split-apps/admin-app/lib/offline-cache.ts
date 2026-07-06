import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

/**
 * Offline Gallery Cache Manager
 * Caches gallery thumbnails for viewing on patchy networks
 */

const CACHE_PREFIX = 'gallery_cache_';
const THUMBNAIL_CACHE_PREFIX = 'thumb_cache_';
const CACHE_EXPIRY_HOURS = 72; // 3 days

interface CachedGallery {
  id: string;
  name: string;
  access_code: string;
  cover_photo_url?: string;
  photo_count: number;
  cached_at: number;
}

interface CachedPhoto {
  id: string;
  gallery_id: string;
  photo_url: string;
  thumbnail_url: string;
  local_uri?: string;
  local_thumbnail_uri?: string;
  cached_at: number;
}

interface CacheStats {
  galleryCount: number;
  photoCount: number;
  totalSize: number;
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Cache a gallery for offline viewing
 */
export async function cacheGallery(galleryId: string): Promise<boolean> {
  try {
    // Fetch gallery data
    const { data: gallery, error: galleryError } = await supabase
      .from('galleries')
      .select('id, name, access_code, cover_photo_url')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      console.error('Failed to fetch gallery for caching:', galleryError);
      return false;
    }

    // Fetch photos
    const { data: photos, error: photosError } = await supabase
      .from('gallery_photos')
      .select('id, photo_url, thumbnail_url')
      .eq('gallery_id', galleryId)
      .order('upload_order');

    if (photosError || !photos) {
      console.error('Failed to fetch photos for caching:', photosError);
      return false;
    }

    // Cache gallery metadata
    const cachedGallery: CachedGallery = {
      id: gallery.id,
      name: gallery.name,
      access_code: gallery.access_code,
      cover_photo_url: gallery.cover_photo_url,
      photo_count: photos.length,
      cached_at: Date.now(),
    };

    await AsyncStorage.setItem(
      `${CACHE_PREFIX}${galleryId}`,
      JSON.stringify(cachedGallery)
    );

    // Cache thumbnails (limit to first 50 for storage)
    const thumbnailsToCache = photos.slice(0, 50);
    const cachePromises = thumbnailsToCache.map(async (photo) => {
      try {
        const thumbnailUrl = photo.thumbnail_url || photo.photo_url;
        
        // Download thumbnail
        const fileUri = `${FileSystem.cacheDirectory}thumbs_${galleryId}_${photo.id}.jpg`;
        
        const downloadResult = await FileSystem.downloadAsync(thumbnailUrl, fileUri);
        
        if (downloadResult.status === 200) {
          const cachedPhoto: CachedPhoto = {
            id: photo.id,
            gallery_id: galleryId,
            photo_url: photo.photo_url,
            thumbnail_url: thumbnailUrl,
            local_thumbnail_uri: fileUri,
            cached_at: Date.now(),
          };

          await AsyncStorage.setItem(
            `${THUMBNAIL_CACHE_PREFIX}${photo.id}`,
            JSON.stringify(cachedPhoto)
          );
        }
      } catch (error) {
        console.warn(`Failed to cache thumbnail ${photo.id}:`, error);
      }
    });

    await Promise.allSettled(cachePromises);

    console.log(`Cached gallery ${gallery.name} with ${thumbnailsToCache.length} thumbnails`);
    return true;
  } catch (error) {
    console.error('Gallery caching failed:', error);
    return false;
  }
}

/**
 * Get cached gallery data
 */
export async function getCachedGallery(galleryId: string): Promise<CachedGallery | null> {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${galleryId}`);
    if (!cached) return null;

    const gallery: CachedGallery = JSON.parse(cached);
    
    // Check if expired
    const hoursSinceCache = (Date.now() - gallery.cached_at) / (1000 * 60 * 60);
    if (hoursSinceCache > CACHE_EXPIRY_HOURS) {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${galleryId}`);
      return null;
    }

    return gallery;
  } catch (error) {
    console.error('Failed to get cached gallery:', error);
    return null;
  }
}

/**
 * Get cached thumbnail URI
 */
export async function getCachedThumbnail(photoId: string): Promise<string | null> {
  try {
    const cached = await AsyncStorage.getItem(`${THUMBNAIL_CACHE_PREFIX}${photoId}`);
    if (!cached) return null;

    const photo: CachedPhoto = JSON.parse(cached);
    
    // Check if file exists
    if (photo.local_thumbnail_uri) {
      const fileInfo = await FileSystem.getInfoAsync(photo.local_thumbnail_uri);
      if (fileInfo.exists) {
        return photo.local_thumbnail_uri;
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to get cached thumbnail:', error);
    return null;
  }
}

/**
 * Get all cached galleries
 */
export async function getAllCachedGalleries(): Promise<CachedGallery[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    
    const cachedGalleries: CachedGallery[] = [];
    
    for (const key of cacheKeys) {
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const gallery: CachedGallery = JSON.parse(cached);
          
          // Check if expired
          const hoursSinceCache = (Date.now() - gallery.cached_at) / (1000 * 60 * 60);
          if (hoursSinceCache <= CACHE_EXPIRY_HOURS) {
            cachedGalleries.push(gallery);
          } else {
            await AsyncStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.warn(`Failed to parse cache key ${key}:`, error);
      }
    }

    return cachedGalleries.sort((a, b) => b.cached_at - a.cached_at);
  } catch (error) {
    console.error('Failed to get cached galleries:', error);
    return [];
  }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => 
      k.startsWith(CACHE_PREFIX) || k.startsWith(THUMBNAIL_CACHE_PREFIX)
    );
    
    await AsyncStorage.multiRemove(cacheKeys);
    
    // Clear thumbnail files
    const cacheDir = FileSystem.cacheDirectory;
    if (cacheDir) {
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      for (const file of files) {
        if (file.startsWith('thumbs_')) {
          await FileSystem.deleteAsync(`${cacheDir}${file}`);
        }
      }
    }
    
    console.log('Cache cleared');
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  try {
    const cachedGalleries = await getAllCachedGalleries();
    
    let photoCount = 0;
    let totalSize = 0;
    
    // Count photos and estimate size
    for (const gallery of cachedGalleries) {
      photoCount += gallery.photo_count;
    }
    
    // Estimate size (rough: 50KB per thumbnail)
    totalSize = photoCount * 50 * 1024;
    
    return {
      galleryCount: cachedGalleries.length,
      photoCount,
      totalSize,
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return { galleryCount: 0, photoCount: 0, totalSize: 0 };
  }
}

/**
 * Format file size for display
 */
export function formatCacheSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
