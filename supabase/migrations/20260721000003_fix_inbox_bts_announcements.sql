-- =====================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Fixes: Inbox messaging, BTS posts, Announcements
-- =====================================================

-- 1. Make announcements.content and expires_at nullable (expires_at not needed for announcements)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'content' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.announcements ALTER COLUMN content DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'expires_at' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.announcements ALTER COLUMN expires_at DROP NOT NULL;
  END IF;
END $$;

-- 2. Ensure announcements has tag column
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS tag text;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'global';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS owner_admin_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill owner_admin_id from created_by
UPDATE public.announcements SET owner_admin_id = created_by WHERE owner_admin_id IS NULL AND created_by IS NOT NULL;
UPDATE public.announcements SET created_by = owner_admin_id WHERE created_by IS NULL AND owner_admin_id IS NOT NULL;

-- 3. Ensure bts_posts has caption and visibility columns
ALTER TABLE public.bts_posts ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE public.bts_posts ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'global';
ALTER TABLE public.bts_posts ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.bts_posts ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.bts_posts ADD COLUMN IF NOT EXISTS views_count int DEFAULT 0;
ALTER TABLE public.bts_posts ADD COLUMN IF NOT EXISTS bookmarks_count int DEFAULT 0;
ALTER TABLE public.bts_posts ADD COLUMN IF NOT EXISTS likes_count int DEFAULT 0;
ALTER TABLE public.bts_posts ADD COLUMN IF NOT EXISTS comments_count int DEFAULT 0;

-- 4. Ensure portfolio_items has required columns
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS owner_admin_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS display_order int DEFAULT 0;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Backfill admin_id from created_by where possible
UPDATE public.portfolio_items SET admin_id = created_by WHERE admin_id IS NULL AND created_by IS NOT NULL;
UPDATE public.portfolio_items SET owner_admin_id = created_by WHERE owner_admin_id IS NULL AND created_by IS NOT NULL;
UPDATE public.portfolio_items SET created_by = owner_admin_id WHERE created_by IS NULL AND owner_admin_id IS NOT NULL;

-- 5. Ensure clients.user_id exists for inbox messaging
-- messages.client_id references user_profiles(id), so clients must have user_id linked
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.user_profiles(id);

-- Auto-link existing clients to user_profiles by phone
UPDATE public.clients c
SET user_id = up.id
FROM public.user_profiles up
WHERE c.user_id IS NULL AND c.phone IS NOT NULL AND up.phone IS NOT NULL
  AND REPLACE(REPLACE(c.phone, '+', ''), ' ', '') = REPLACE(REPLACE(up.phone, '+', ''), ' ', '');

-- 6. Ensure messages table has required columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS owner_admin_id uuid REFERENCES public.user_profiles(id);

-- 7. Ensure events table has required columns
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_busy boolean DEFAULT true;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reminder_date timestamptz;

-- 8. Create event_clients junction table if not exists
CREATE TABLE IF NOT EXISTS public.event_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notified boolean DEFAULT false,
  reminder_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, client_id)
);

ALTER TABLE public.event_clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage event_clients' AND tablename = 'event_clients') THEN
    CREATE POLICY "Admins manage event_clients" ON public.event_clients
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.events WHERE events.id = event_clients.event_id AND events.photographer_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients view own event assignments' AND tablename = 'event_clients') THEN
    CREATE POLICY "Clients view own event assignments" ON public.event_clients
      FOR SELECT USING (client_id = auth.uid());
  END IF;
END $$;

-- 9. Fix notifications RLS — allow any admin to insert for any client
-- Drop the old restrictive policy that blocked second admins
DROP POLICY IF EXISTS "Admins can manage gallery notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

-- New policy: any admin/super_admin can insert notifications
CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

-- New policy: any admin/super_admin can manage notifications
CREATE POLICY "Admins can manage all notifications" ON public.notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages(client_id);
CREATE INDEX IF NOT EXISTS idx_events_date_busy ON public.events(event_date, status) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_event_clients_client ON public.event_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_event_clients_event ON public.event_clients(event_id);
CREATE INDEX IF NOT EXISTS idx_bts_posts_created_by ON public.bts_posts(created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);

-- 10. Reload schema cache
NOTIFY pgrst, 'reload schema';
