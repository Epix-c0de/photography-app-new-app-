import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ScreenCapture from 'expo-screen-capture';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/types/supabase';

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
  brandSlug: string;
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
  customDomain: string | null;
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
  brandSlug: 'epix-visuals',
  appDisplayName: 'Epix Visuals Studios.co',
  watermarkText: 'Epix Visuals Studios.co',
  watermarkOpacity: 30,
  watermarkRotation: 45,
  watermarkSize: 'medium' as WatermarkSize,
  watermarkPosition: 'center' as WatermarkPosition,
  embedClientName: true,
  embedGalleryCode: true,
  blockScreenshots: true,
  customDomain: null,
  shareAppLink: '',
  accessCodeLink: 'epix-visuals://gallery?autoUnlock=true&accessCode=',
  btsShareLink: '',
  announcementShareLink: '',
  galleryShareLink: '',
  referralLink: '',
  whatsappShareLink: '',
};

// Watermark presets for different use cases
export const WATERMARK_PRESETS = {
  center: {
    position: 'center' as WatermarkPosition,
    opacity: 30,
    rotation: 45,
    size: 'medium' as WatermarkSize,
    label: 'Center (Classic)',
    description: 'Diagonal watermark in the center - best for protecting photos',
  },
  bottomRight: {
    position: 'bottomRight' as WatermarkPosition,
    opacity: 40,
    rotation: 0,
    size: 'small' as WatermarkSize,
    label: 'Bottom Right (Subtle)',
    description: 'Small corner watermark - less intrusive',
  },
  bottomLeft: {
    position: 'bottomLeft' as WatermarkPosition,
    opacity: 40,
    rotation: 0,
    size: 'small' as WatermarkSize,
    label: 'Bottom Left',
    description: 'Left corner watermark',
  },
  tiled: {
    position: 'center' as WatermarkPosition,
    opacity: 15,
    rotation: 45,
    size: 'small' as WatermarkSize,
    label: 'Tiled (Maximum Protection)',
    description: 'Multiple watermarks across the image',
  },
  topRight: {
    position: 'topRight' as WatermarkPosition,
    opacity: 35,
    rotation: 0,
    size: 'small' as WatermarkSize,
    label: 'Top Right',
    description: 'Upper corner watermark',
  },
};

// Get watermark CSS styles based on position
export function getWatermarkStyles(
  position: WatermarkPosition,
  opacity: number,
  rotation: number
): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    userSelect: 'none',
    opacity: opacity / 100,
    transform: `rotate(${rotation}deg)`,
    color: 'white',
    fontSize: '14px',
    fontWeight: 'bold',
    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
    zIndex: 10,
  };

  switch (position) {
    case 'center':
      return {
        ...baseStyle,
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      };
    case 'bottomRight':
      return {
        ...baseStyle,
        bottom: '20px',
        right: '20px',
      };
    case 'bottomLeft':
      return {
        ...baseStyle,
        bottom: '20px',
        left: '20px',
      };
    case 'topRight':
      return {
        ...baseStyle,
        top: '20px',
        right: '20px',
      };
    case 'topLeft':
      return {
        ...baseStyle,
        top: '20px',
        left: '20px',
      };
    default:
      return baseStyle;
  }
}

// Get tiled watermark positions
export function getTiledWatermarkPositions(
  opacity: number,
  rotation: number
): React.CSSProperties[] {
  const positions = [
    { top: '20%', left: '20%' },
    { top: '20%', right: '20%' },
    { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    { bottom: '20%', left: '20%' },
    { bottom: '20%', right: '20%' },
  ];

  return positions.map((pos) => ({
    position: 'absolute' as const,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
    opacity: opacity / 100,
    transform: `rotate(${rotation}deg)`,
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
    zIndex: 10,
    ...pos,
  }));
}

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

  const [platformDomain, setPlatformDomain] = useState<string>('');

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

  // Fetch platform domain from platform_settings for fallback
  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_domain')
      .single()
      .then(({ data }) => {
        if (data?.value) setPlatformDomain(data.value);
      })
      .catch(() => {});
  }, []);

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
    const brandSlug = settings?.brand_slug ?? DEFAULTS.brandSlug;
    const appDisplayName = settings?.app_display_name ?? DEFAULTS.appDisplayName;
    const watermarkText = settings?.watermark_text ?? brandName ?? DEFAULTS.watermarkText;

    // Use platform_domain from DB as the ultimate fallback, never hardcode
    const domainFallback = platformDomain || '';

    return {
      brandName,
      brandSlug,
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
      customDomain: settings?.custom_domain ?? DEFAULTS.customDomain,
      shareAppLink: settings?.share_app_link || domainFallback,
      accessCodeLink: settings?.access_code_link ?? DEFAULTS.accessCodeLink,
      btsShareLink: settings?.bts_share_link || settings?.share_app_link || domainFallback,
      announcementShareLink: settings?.announcement_share_link || settings?.share_app_link || domainFallback,
      galleryShareLink: settings?.gallery_share_link || settings?.share_app_link || domainFallback,
      referralLink: settings?.referral_link || settings?.share_app_link || domainFallback,
      whatsappShareLink: settings?.whatsapp_share_link || settings?.share_app_link || domainFallback,
    };
  }, [settings, platformDomain]);

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
