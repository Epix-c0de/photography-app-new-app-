-- Support chat upgrade columns
ALTER TABLE IF EXISTS public.support_messages
    ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS media_url TEXT,
    ADD COLUMN IF NOT EXISTS file_name TEXT,
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Support chat channels table
CREATE TABLE IF NOT EXISTS public.support_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    photographer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'open',
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(photographer_id)
);

ALTER TABLE public.support_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage own support channel" ON public.support_channels;
CREATE POLICY "Admins manage own support channel"
    ON public.support_channels FOR ALL
    USING (auth.uid() = photographer_id);

-- Support media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('support-media', 'support-media', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Support media upload" ON storage.objects;
CREATE POLICY "Support media upload"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'support-media' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Support media read" ON storage.objects;
CREATE POLICY "Support media read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'support-media');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_messages_category ON public.support_messages(category);
CREATE INDEX IF NOT EXISTS idx_support_messages_priority ON public.support_messages(priority);
CREATE INDEX IF NOT EXISTS idx_support_channels_photographer ON public.support_channels(photographer_id);
