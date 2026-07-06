import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { supabase } from './supabase';
import { downloadAndCompress } from './network-compression';

const DB_NAME = 'gallery_cache.db';
const CACHE_DIR = `${FileSystem.cacheDirectory}gallery_cache/`;

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cached_photos (
        id TEXT PRIMARY KEY,
        gallery_id TEXT NOT NULL,
        photo_url TEXT NOT NULL,
        local_path TEXT NOT NULL,
        photo_type TEXT DEFAULT 'thumbnail',
        cached_at TEXT DEFAULT (datetime('now')),
        size_bytes INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_cached_photos_gallery ON cached_photos(gallery_id);
      CREATE INDEX IF NOT EXISTS idx_cached_photos_type ON cached_photos(photo_type);
    `);
  }
  return db;
}

export type CacheStats = {
  totalPhotos: number;
  totalSize: number;
  totalSizeFormatted: string;
  galleryCount: number;
};

export async function getCacheStats(): Promise<CacheStats> {
  const database = await getDb();
  const result = await database.getFirstAsync<{
    total: number;
    total_size: number;
    galleries: number;
  }>(`
    SELECT COUNT(*) as total, COALESCE(SUM(size_bytes), 0) as total_size,
           COUNT(DISTINCT gallery_id) as galleries
    FROM cached_photos
  `);

  return {
    totalPhotos: result?.total || 0,
    totalSize: result?.total_size || 0,
    totalSizeFormatted: formatBytes(result?.total_size || 0),
    galleryCount: result?.galleries || 0,
  };
}

export async function cacheGalleryPhotos(
  galleryId: string,
  photoUrls: Array<{ id: string; thumbnail_url: string; full_url: string }>,
  onProgress?: (cached: number, total: number) => void
): Promise<number> {
  const database = await getDb();

  // Ensure cache directory exists
  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }

  const galleryDir = `${CACHE_DIR}${galleryId}/`;
  const galleryDirInfo = await FileSystem.getInfoAsync(galleryDir);
  if (!galleryDirInfo.exists) {
    await FileSystem.makeDirectoryAsync(galleryDir, { intermediates: true });
  }

  let cached = 0;

  for (const photo of photoUrls) {
    try {
      // Check if already cached
      const existing = await database.getFirstAsync<{ local_path: string }>(
        'SELECT local_path FROM cached_photos WHERE id = ?',
        [photo.id]
      );
      if (existing) {
        cached++;
        onProgress?.(cached, photoUrls.length);
        continue;
      }

      // Download and compress thumbnail
      const thumbUri = `${galleryDir}${photo.id}_thumb.jpg`;
      await downloadAndCompress(photo.thumbnail_url, thumbUri);

      const fileInfo = await FileSystem.getInfoAsync(thumbUri);
      await database.runAsync(
        'INSERT OR REPLACE INTO cached_photos (id, gallery_id, photo_url, local_path, photo_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)',
        [photo.id, galleryId, photo.thumbnail_url, thumbUri, 'thumbnail', fileInfo.size || 0]
      );
      cached++;

      onProgress?.(cached, photoUrls.length);
    } catch (e) {
      console.warn(`Failed to cache photo ${photo.id}:`, e);
    }
  }

  return cached;
}

export async function getCachedPhoto(photoId: string): Promise<string | null> {
  const database = await getDb();
  const result = await database.getFirstAsync<{ local_path: string }>(
    'SELECT local_path FROM cached_photos WHERE id = ?',
    [photoId]
  );

  if (result) {
    const fileInfo = await FileSystem.getInfoAsync(result.local_path);
    if (fileInfo.exists) {
      return result.local_path;
    }
    // File was deleted from cache, remove DB entry
    await database.runAsync('DELETE FROM cached_photos WHERE id = ?', [photoId]);
  }

  return null;
}

export async function getCachedGalleryPhotos(galleryId: string): Promise<Map<string, string>> {
  const database = await getDb();
  const results = await database.getAllAsync<{ id: string; local_path: string }>(
    'SELECT id, local_path FROM cached_photos WHERE gallery_id = ?',
    [galleryId]
  );

  const map = new Map<string, string>();
  for (const r of results) {
    const fileInfo = await FileSystem.getInfoAsync(r.local_path);
    if (fileInfo.exists) {
      map.set(r.id, r.local_path);
    }
  }

  return map;
}

export async function clearGalleryCache(galleryId?: string): Promise<void> {
  const database = await getDb();

  if (galleryId) {
    const results = await database.getAllAsync<{ local_path: string }>(
      'SELECT local_path FROM cached_photos WHERE gallery_id = ?',
      [galleryId]
    );
    for (const r of results) {
      await FileSystem.deleteAsync(r.local_path, { idempotent: true });
    }
    await database.runAsync('DELETE FROM cached_photos WHERE gallery_id = ?', [galleryId]);
  } else {
    const results = await database.getAllAsync<{ local_path: string }>(
      'SELECT local_path FROM cached_photos'
    );
    for (const r of results) {
      await FileSystem.deleteAsync(r.local_path, { idempotent: true });
    }
    await database.runAsync('DELETE FROM cached_photos');
  }
}

export async function isGalleryCached(galleryId: string): Promise<boolean> {
  const database = await getDb();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM cached_photos WHERE gallery_id = ?',
    [galleryId]
  );
  return (result?.count || 0) > 0;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
