'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

type BrandingSettings = {
  business_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  watermark_text: string | null;
  watermark_opacity: number;
  watermark_rotation: number;
  watermark_position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
  watermark_enabled: boolean;
};

type BrandingContextType = {
  settings: BrandingSettings | null;
  loading: boolean;
  update: (updates: Partial<BrandingSettings>) => Promise<void>;
  refresh: () => Promise<void>;
};

const DEFAULT_SETTINGS: BrandingSettings = {
  business_name: 'Epix Visuals',
  logo_url: null,
  primary_color: '#D4AF37',
  secondary_color: '#12121e',
  watermark_text: null,
  watermark_opacity: 30,
  watermark_rotation: 45,
  watermark_position: 'center',
  watermark_enabled: false,
};

export const WATERMARK_PRESETS = {
  center: {
    label: 'Center',
    opacity: 30,
    rotation: 45,
    position: 'center' as const,
  },
  'top-left': {
    label: 'Top Left',
    opacity: 25,
    rotation: 0,
    position: 'top-left' as const,
  },
  'top-right': {
    label: 'Top Right',
    opacity: 25,
    rotation: 0,
    position: 'top-right' as const,
  },
  'bottom-left': {
    label: 'Bottom Left',
    opacity: 25,
    rotation: 0,
    position: 'bottom-left' as const,
  },
  'bottom-right': {
    label: 'Bottom Right',
    opacity: 25,
    rotation: 0,
    position: 'bottom-right' as const,
  },
  tile: {
    label: 'Tile (Repeat)',
    opacity: 15,
    rotation: 45,
    position: 'tile' as const,
  },
};

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('admin_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching branding settings:', error);
        return;
      }

      if (data) {
        setSettings({
          business_name: data.business_name || DEFAULT_SETTINGS.business_name,
          logo_url: data.logo_url || DEFAULT_SETTINGS.logo_url,
          primary_color: data.primary_color || DEFAULT_SETTINGS.primary_color,
          secondary_color: data.secondary_color || DEFAULT_SETTINGS.secondary_color,
          watermark_text: data.watermark_text || DEFAULT_SETTINGS.watermark_text,
          watermark_opacity: data.watermark_opacity || DEFAULT_SETTINGS.watermark_opacity,
          watermark_rotation: data.watermark_rotation || DEFAULT_SETTINGS.watermark_rotation,
          watermark_position: data.watermark_position || DEFAULT_SETTINGS.watermark_position,
          watermark_enabled: data.watermark_enabled || DEFAULT_SETTINGS.watermark_enabled,
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('Failed to load branding settings:', err);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const update = useCallback(async (updates: Partial<BrandingSettings>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        admin_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'admin_id' });

    if (error) throw error;

    setSettings((prev) => prev ? { ...prev, ...updates } : prev);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchSettings();
  }, [fetchSettings]);

  return (
    <BrandingContext.Provider value={{ settings, loading, update, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
