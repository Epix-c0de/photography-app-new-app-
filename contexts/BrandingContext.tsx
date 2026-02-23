import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
}

const DEFAULTS = {
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
};

export const [BrandingProvider, useBranding] = createContextHook<BrandingState>(() => {
  const { user } = useAuth();
  const [activeAdminId, setActiveAdminId] = useState<string | null>(null);
  const [settings, setSettings] = useState<BrandSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!activeAdminId) {
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
        .eq('admin_id', activeAdminId)
        .maybeSingle();

      if (selectError) throw selectError;

      if (row) {
        setSettings(row);
        return;
      }

      const canCreate = user?.id === activeAdminId && user?.role === 'admin';
      if (!canCreate) {
        setSettings(null);
        return;
      }

      const { data: created, error: insertError } = await supabase
        .from('brand_settings')
        .insert({ admin_id: activeAdminId })
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
  }, [activeAdminId, user?.id, user?.role]);

  const update = useCallback(async (updates: BrandSettingsUpdate) => {
    if (!activeAdminId) throw new Error('No active admin selected');

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from('brand_settings')
        .upsert({ admin_id: activeAdminId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'admin_id' })
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
  }, [activeAdminId]);

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

    if (user.role === 'admin') {
      setActiveAdminId(user.id);
      return () => {
        cancelled = true;
      };
    }

    if (user.role === 'client') {
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
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
