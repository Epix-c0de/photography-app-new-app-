-- User notifications system
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'package_update', etc.
    data JSONB, -- Additional data like package_id, etc.
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to create notification when package is added/updated
CREATE OR REPLACE FUNCTION notify_package_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for all users when a new package is added or updated
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_active != NEW.is_active AND NEW.is_active = true) THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    SELECT
      up.id,
      CASE WHEN TG_OP = 'INSERT' THEN 'New Package Available!' ELSE 'Package Updated!' END,
      CASE WHEN TG_OP = 'INSERT'
        THEN 'A new photography package "' || NEW.name || '" is now available.'
        ELSE 'The package "' || NEW.name || '" has been updated.'
      END,
      'package_update',
      jsonb_build_object('package_id', NEW.id, 'package_name', NEW.name, 'price', NEW.price)
    FROM public.user_profiles up
    WHERE up.role IN ('client', 'user'); -- Notify clients and regular users
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on packages table
DROP TRIGGER IF EXISTS trigger_package_notification ON public.packages;
CREATE TRIGGER trigger_package_notification
  AFTER INSERT OR UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION notify_package_update();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
