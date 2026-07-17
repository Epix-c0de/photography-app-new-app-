-- Fix the trigger function to use 'body' column instead of 'message'
-- The notifications table uses 'body text not null' but the trigger was inserting 'message'

CREATE OR REPLACE FUNCTION notify_package_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.is_active != NEW.is_active AND NEW.is_active = true) THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
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
    WHERE up.role IN ('client', 'user');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
