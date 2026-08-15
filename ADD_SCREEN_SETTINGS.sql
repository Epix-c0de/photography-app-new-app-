-- ============================================================
-- SCREEN SETTINGS: Onboarding & Login screen images
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.screen_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  -- Onboarding slides
  onboarding_slide_1_image TEXT DEFAULT 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=800&h=1200&fit=crop',
  onboarding_slide_1_title TEXT DEFAULT 'Welcome to Epix Visuals Studios.co',
  onboarding_slide_1_subtitle TEXT DEFAULT 'Where every moment becomes a timeless masterpiece.',
  onboarding_slide_2_image TEXT DEFAULT 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=1200&fit=crop',
  onboarding_slide_2_title TEXT DEFAULT 'Private Galleries',
  onboarding_slide_2_subtitle TEXT DEFAULT 'Access your photos securely in your personal gallery.',
  onboarding_slide_3_image TEXT DEFAULT 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=1200&fit=crop',
  onboarding_slide_3_title TEXT DEFAULT 'Seamless Payments',
  onboarding_slide_3_subtitle TEXT DEFAULT 'Book and pay for sessions effortlessly with M-Pesa.',
  onboarding_slide_4_image TEXT DEFAULT 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&h=1200&fit=crop',
  onboarding_slide_4_title TEXT DEFAULT 'Share Your Story',
  onboarding_slide_4_subtitle TEXT DEFAULT 'Download, share, and relive your favorite memories.',
  -- Login screen
  login_background_image TEXT DEFAULT 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=1000&auto=format&fit=crop',
  login_tagline TEXT DEFAULT 'Every moment deserves to be captured beautifully.',
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO public.screen_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- RLS: only super_admin can read/write
ALTER TABLE public.screen_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manage_screen_settings" ON public.screen_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Anyone can read (for onboarding/login screens)
CREATE POLICY "public_read_screen_settings" ON public.screen_settings
  FOR SELECT USING (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_screen_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS screen_settings_updated_at ON public.screen_settings;
CREATE TRIGGER screen_settings_updated_at
  BEFORE UPDATE ON public.screen_settings
  FOR EACH ROW EXECUTE FUNCTION update_screen_settings_updated_at();
