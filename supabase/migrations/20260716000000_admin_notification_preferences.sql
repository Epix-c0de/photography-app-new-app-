-- Admin notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    photographer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    
    -- Channel toggles
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT true,
    
    -- Alert type toggles
    payment_alerts BOOLEAN DEFAULT true,
    booking_alerts BOOLEAN DEFAULT true,
    message_alerts BOOLEAN DEFAULT true,
    gallery_alerts BOOLEAN DEFAULT true,
    client_alerts BOOLEAN DEFAULT true,
    weekly_report BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(photographer_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage own notification prefs" ON public.notification_preferences;
CREATE POLICY "Admins manage own notification prefs"
    ON public.notification_preferences FOR ALL
    USING (auth.uid() = photographer_id);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_photographer ON public.notification_preferences(photographer_id);
