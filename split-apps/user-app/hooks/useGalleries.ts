import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type GalleryRow = Database['public']['Tables']['galleries']['Row'];
type GalleryRowWithCounts = GalleryRow & { photo_count?: number | null };

const LOCAL_UNLOCKED_GALLERY_IDS_KEY = 'local_unlocked_gallery_ids_v1';

interface UseGalleriesOptions {
  isDemoMode: boolean;
  userId?: string;
}

export function useGalleries({ isDemoMode, userId }: UseGalleriesOptions) {
  const [galleries, setGalleries] = useState<GalleryRowWithCounts[]>([]);
  const [galleriesLoading, setGalleriesLoading] = useState(true);
  const [galleriesError, setGalleriesError] = useState<string | null>(null);

  const readLocalUnlockedGalleryIds = useCallback(async (): Promise<string[]> => {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_UNLOCKED_GALLERY_IDS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id: any) => typeof id === 'string' && id.length > 0);
    } catch {
      return [];
    }
  }, []);

  const saveLocalUnlockedGalleryId = useCallback(async (galleryId: string) => {
    try {
      const existing = await readLocalUnlockedGalleryIds();
      if (existing.includes(galleryId)) return;
      await AsyncStorage.setItem(LOCAL_UNLOCKED_GALLERY_IDS_KEY, JSON.stringify([...existing, galleryId]));
    } catch {}
  }, [readLocalUnlockedGalleryIds]);

  const extractStoragePath = useCallback((urlOrPath: string): string | null => {
    if (!urlOrPath) return null;
    if (!urlOrPath.startsWith('http')) {
      const parts = urlOrPath.split('/');
      if (parts.length > 1) return parts.slice(1).join('/');
      return urlOrPath;
    }
    const match = urlOrPath.match(/\/object\/(?:public|sign|authenticated)\/[^/]+\/(.+?)(?:\?|$)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, []);

  const fetchGalleries = useCallback(async (
    clientIds: string[],
    options?: { silent?: boolean }
  ) => {
    if (!options?.silent) {
      setGalleriesLoading(true);
      setGalleriesError(null);
    }

    if (isDemoMode) {
      const { demoGalleries } = await import('@/lib/demo');
      setGalleries(demoGalleries);
      setGalleriesLoading(false);
      return;
    }

    if (!userId) {
      setGalleries([]);
      setGalleriesLoading(false);
      return;
    }

    // Fetch galleries where client_id matches ANY of the user's client records
    const { data: clientGalleries, error: clientError } = clientIds.length > 0
      ? await supabase
          .from('galleries')
          .select('*')
          .in('client_id', clientIds)
      : { data: [], error: null };

    // Fetch galleries from unlocked_galleries
    const { data: unlockedGalleries, error: unlockedError } = await supabase
      .from('unlocked_galleries')
      .select('gallery_id, galleries(*)')
      .eq('user_id', userId);

    const localUnlockedIds = await readLocalUnlockedGalleryIds();
    let locallyUnlockedGalleries: GalleryRow[] = [];
    if (localUnlockedIds.length > 0) {
      const { data: localData } = await supabase
        .from('galleries')
        .select('*')
        .in('id', localUnlockedIds);
      locallyUnlockedGalleries = localData || [];
    }

    if (clientError) console.error('[Galleries] Error loading client galleries:', clientError);
    if (unlockedError) console.error('[Galleries] Error loading unlocked galleries:', unlockedError);

    const clientGals = clientGalleries || [];
    const unlockedGals = (unlockedGalleries || [])
      .map((ug: any) => ug.galleries)
      .filter(Boolean);

    const data = [...clientGals, ...unlockedGals, ...locallyUnlockedGalleries];

    if (data.length === 0) {
      setGalleries([]);
      setGalleriesLoading(false);
      return;
    }

    const uniqueGalleries = data.filter((gallery, index, self) =>
      index === self.findIndex(g => g.id === gallery.id)
    );

    uniqueGalleries.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const galleryIds = uniqueGalleries.map((g) => g.id);
    const galleryThumbnailMap = new Map<string, string>();
    const photoCountMap = new Map<string, number>();

    if (galleryIds.length > 0) {
      const [thumbResult, countResult] = await Promise.all([
        supabase
          .from('gallery_photos')
          .select('gallery_id, photo_url, created_at')
          .in('gallery_id', galleryIds)
          .not('photo_url', 'is', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('gallery_photos')
          .select('gallery_id')
          .in('gallery_id', galleryIds),
      ]);

      if (!thumbResult.error && thumbResult.data) {
        (thumbResult.data || []).forEach((row: any) => {
          if (!galleryThumbnailMap.has(row.gallery_id) && row.photo_url) {
            galleryThumbnailMap.set(row.gallery_id, row.photo_url);
          }
        });
      }

      if (!countResult.error && countResult.data) {
        (countResult.data as any[]).forEach((row: any) => {
          photoCountMap.set(row.gallery_id, (photoCountMap.get(row.gallery_id) || 0) + 1);
        });
      }
    }

    // Generate signed URLs for cover photos
    const coverPaths = uniqueGalleries
      .map((g) => {
        const preferredCover = galleryThumbnailMap.get(g.id) || g.cover_photo_url || '';
        return { id: g.id, raw: preferredCover, path: extractStoragePath(preferredCover) };
      })
      .filter((item): item is { id: string; raw: string; path: string } => !!item.path);

    let signedCoverMap = new Map<string, string>();
    if (coverPaths.length > 0) {
      try {
        const paths = coverPaths.map(item => item.path);
        const { data: signedCovers } = await supabase.storage
          .from('client-photos')
          .createSignedUrls(paths, 3600);
        if (signedCovers) {
          signedCovers.forEach((s: any) => {
            if (s.path && s.signedUrl) signedCoverMap.set(s.path, s.signedUrl);
          });
        }
      } catch (e) {
        console.error('[Galleries] Error creating signed URLs:', e);
      }
    }

    const galleriesWithCovers = uniqueGalleries.map((gallery) => {
      const preferredCover = galleryThumbnailMap.get(gallery.id) || gallery.cover_photo_url || '';
      let coverUrl = preferredCover;
      if (preferredCover) {
        const path = extractStoragePath(preferredCover);
        if (path && signedCoverMap.has(path)) {
          coverUrl = signedCoverMap.get(path)!;
        } else if (!preferredCover.startsWith('http')) {
          const { data } = supabase.storage.from('client-photos').getPublicUrl(preferredCover);
          if (data?.publicUrl) coverUrl = data.publicUrl;
        }
      }
      return { ...gallery, cover_photo_url: coverUrl, photo_count: photoCountMap.get(gallery.id) ?? 0 };
    });

    setGalleries(galleriesWithCovers);
    setGalleriesLoading(false);
  }, [isDemoMode, userId, readLocalUnlockedGalleryIds, extractStoragePath]);

  return {
    galleries,
    setGalleries,
    galleriesLoading,
    galleriesError,
    fetchGalleries,
    saveLocalUnlockedGalleryId,
    readLocalUnlockedGalleryIds,
  };
}
