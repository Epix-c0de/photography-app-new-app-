import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ScreenCapture from 'expo-screen-capture';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/supabase';

// Module-level cache for platform_settings (rarely changes, shared across mounts)
let platformSettingsCache: { appLink: string; fetchedAt: number } | null = null;
const PLATFORM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export type BrandSettings = Database['public']['Tables']['brand_settings']['Row'];
export type BrandSettingsUpdate = Database['public']['Tables']['brand_settings']['Update'];

type WatermarkSize = BrandSettings['watermark_size'];
type WatermarkPosition = BrandSettings['watermark_position'];

interface BrandingState {
  activeAdminId: string | null;
  settings: BrandSettings | null;
  isLoading: boolean;
  error: string | null;
  setActiveAdminId: (adminId: string | null) => void;
  refresh: () => Promise<void>;
  update: (updates: BrandSettingsUpdate) => Promise<BrandSettings>;

  brandName: string;
  tagline: string | null;
  appDisplayName: string;
  logoUrl: string | null;

  watermarkText: string;
  watermarkLogoUrl: string | null;
  watermarkOpacity: number;
  watermarkRotation: number;
  watermarkSize: WatermarkSize;
  watermarkPosition: WatermarkPosition;
  embedClientName: boolean;
  embedGalleryCode: boolean;
  blockScreenshots: boolean;
  shareAppLink: string;
  accessCodeLink: string;
  btsShareLink: string;
  announcementShareLink: string;
  galleryShareLink: string;
  referralLink: string;
  whatsappShareLink: string;
}

export const DEFAULTS = {
  brandName: 'Epix Visuals Studios.co',
  appDisplayName: 'Epix Visuals Studios.co',
  watermarkText: 'Epix Visuals Studios.co',
  watermarkOpacity: 30,
  watermarkRotation: 45,
  watermarkSize: 'medium' as WatermarkSize,
  watermarkPosition: 'center' as WatermarkPosition,
  embedClientName: true,
  embedGalleryCode: true,
  blockScreenshots: true,
  shareAppLink: '',
  accessCodeLink: '',
  btsShareLink: '',
  announcementShareLink: '',
  galleryShareLink: '',
  referralLink: '',
  whatsappShareLink: '',
};

export const WATERMARK_PRESETS = {
  center: {
    label: 'Center',
    position: 'center' as WatermarkPosition,
    opacity: 30,
    rotation: 45,
    size: 'medium' as WatermarkSize,
  },
  bottomRight: {
    label: 'Bottom Right',
    position: 'bottom-right' as WatermarkPosition,
    opacity: 50,
    rotation: 0,
    size: 'small' as WatermarkSize,
  },
  bottomLeft: {
    label: 'Bottom Left',
    position: 'bottom-left' as WatermarkPosition,
    opacity: 50,
    rotation: 0,
    size: 'small' as WatermarkSize,
  },
  tiled: {
    label: 'Tiled',
    position: 'center' as WatermarkPosition,
    opacity: 15,
    rotation: 45,
    size: 'small' as WatermarkSize,
  },
  topRight: {
    label: 'Top Right',
    position: 'top-right' as WatermarkPosition,
    opacity: 50,
    rotation: 0,
    size: 'small' as WatermarkSize,
  },
};

export const getWatermarkStyles = (preset: keyof typeof WATERMARK_PRESETS) => {
  const p = WATERMARK_PRESETS[preset];
  return {
    opacity: p.opacity / 100,
    transform: [{ rotate: `${p.rotation}deg` }],
  };
};

export const getTiledWatermarkPositions = (count: number = 6) => {
  const positions = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      top: `${20 + (i * 25)}%`,
      left: `${10 + (i % 2) * 40}%`,
    });
  }
  return positions;
};

export const [BrandingProvider, useBranding] = createContextHook<BrandingState>(() => {
  const { user, profile } = useAuth();
  const [activeAdminId, setActiveAdminId] = useState<string | null>(null);
  const [settings, setSettings] = useState<BrandSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const authRole = (profile?.role ??
    (user?.app_metadata as any)?.role ??
    (user?.user_metadata as any)?.role ??
    null) as 'admin' | 'client' | 'super_admin' | null;
  const isAdminRole = authRole === 'admin' || authRole === 'super_admin';
  const resolvedAdminId = activeAdminId ?? (isAdminRole ? (user?.id ?? null) : null);

  const refresh = useCallback(async () => {
    if (!resolvedAdminId) {
      setSettings(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data: row, error: selectError } = await supabase
        .from('brand_settings')
        .select('*')
        .eq('admin_id', resolvedAdminId)
        .maybeSingle();

      if (selectError) throw selectError;

      if (row) {
        // If shareAppLink is not set in brand_settings, fetch from platform_settings (cached)
        if (!row.share_app_link) {
          let appLink = '';
          const now = Date.now();
          if (platformSettingsCache && (now - platformSettingsCache.fetchedAt) < PLATFORM_CACHE_TTL) {
            appLink = platformSettingsCache.appLink;
          } else {
            const { data: platformData } = await supabase
              .from('platform_settings')
              .select('key, value')
              .in('key', ['platform_app_android_link', 'platform_app_ios_link']);
            if (platformData && platformData.length > 0) {
              const pMap: Record<string, string> = {};
              platformData.forEach((r: any) => { pMap[r.key] = r.value ?? ''; });
              appLink = pMap['platform_app_android_link'] || pMap['platform_app_ios_link'] || '';
            }
            platformSettingsCache = { appLink, fetchedAt: now };
          }
          row.share_app_link = appLink;
        }
        setSettings(row);
        return;
      }

      const canCreate = user?.id === resolvedAdminId && isAdminRole;
      if (!canCreate) {
        setSettings(null);
        return;
      }

      const { data: created, error: insertError } = await supabase
        .from('brand_settings')
        .insert({ admin_id: resolvedAdminId })
        .select('*')
        .single();

      if (insertError) throw insertError;
      setSettings(created);
    } catch (e: any) {
      setError(e?.message || 'Failed to load brand settings.');
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAdminRole, resolvedAdminId, user?.id]);

  const update = useCallback(async (updates: BrandSettingsUpdate) => {
    const adminIdToUse = activeAdminId ?? (isAdminRole ? (user?.id ?? null) : null);
    if (!adminIdToUse) throw new Error('No active admin selected');

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from('brand_settings')
        .upsert({ admin_id: adminIdToUse, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'admin_id' })
        .select('*')
        .single();

      if (updateError) throw updateError;

      setSettings(data);
      return data;
    } catch (e: any) {
      const message = e?.message || 'Failed to update brand settings.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [activeAdminId, isAdminRole, user?.id]);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setActiveAdminId(null);
      setSettings(null);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    if (isAdminRole) {
      setActiveAdminId(user.id);
      return () => {
        cancelled = true;
      };
    }

    if (authRole === 'client') {
      setActiveAdminId(null);
      setSettings(null);
      setError(null);

      (async () => {
        try {
          const { data, error: clientError } = await supabase
            .from('clients')
            .select('owner_admin_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (clientError) throw clientError;
          if (cancelled) return;

          const adminId = data?.[0]?.owner_admin_id ?? null;
          setActiveAdminId(adminId);
        } catch (e: any) {
          if (cancelled) return;
          setActiveAdminId(null);
          setError(e?.message || 'Failed to resolve brand owner.');
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [authRole, isAdminRole, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const enabled = settings?.block_screenshots ?? DEFAULTS.blockScreenshots;
    if (enabled) {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    } else {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    }
  }, [settings?.block_screenshots]);

  const derived = useMemo(() => {
    const brandName = settings?.brand_name ?? DEFAULTS.brandName;
    const appDisplayName = settings?.app_display_name ?? DEFAULTS.appDisplayName;
    const watermarkText = settings?.watermark_text ?? brandName ?? DEFAULTS.watermarkText;

    return {
      brandName,
      tagline: settings?.tagline ?? null,
      appDisplayName,
      logoUrl: settings?.logo_url ?? null,
      watermarkText,
      watermarkLogoUrl: settings?.watermark_logo_url ?? null,
      watermarkOpacity: settings?.watermark_opacity ?? DEFAULTS.watermarkOpacity,
      watermarkRotation: settings?.watermark_rotation ?? DEFAULTS.watermarkRotation,
      watermarkSize: settings?.watermark_size ?? DEFAULTS.watermarkSize,
      watermarkPosition: settings?.watermark_position ?? DEFAULTS.watermarkPosition,
      embedClientName: settings?.embed_client_name ?? DEFAULTS.embedClientName,
      embedGalleryCode: settings?.embed_gallery_code ?? DEFAULTS.embedGalleryCode,
      blockScreenshots: settings?.block_screenshots ?? DEFAULTS.blockScreenshots,
      shareAppLink: settings?.share_app_link ?? DEFAULTS.shareAppLink,
      accessCodeLink: settings?.access_code_link ?? DEFAULTS.accessCodeLink,
      btsShareLink: settings?.bts_share_link ?? settings?.share_app_link ?? DEFAULTS.btsShareLink,
      announcementShareLink: settings?.announcement_share_link ?? settings?.share_app_link ?? DEFAULTS.announcementShareLink,
      galleryShareLink: settings?.gallery_share_link ?? settings?.share_app_link ?? DEFAULTS.galleryShareLink,
      referralLink: settings?.referral_link ?? settings?.share_app_link ?? DEFAULTS.referralLink,
      whatsappShareLink: settings?.whatsapp_share_link ?? settings?.share_app_link ?? DEFAULTS.whatsappShareLink,
    };
  }, [settings]);

  return {
    activeAdminId,
    settings,
    isLoading,
    error,
    setActiveAdminId,
    refresh,
    update,
    ...derived,
  };
});
