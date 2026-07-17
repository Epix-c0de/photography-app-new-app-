-- Migration: Fix notifications to allow nullable user_id and proper RLS for client-based notifications
-- Date: 2026-07-13
-- Purpose: Allow notifications to be created with just client_id (no user_id required)
-- so that in-app notifications work even when clients were created by admin without signing up

-- 1. Make user_id nullable (it was originally NOT NULL)
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop conflicting policies and recreate clean ones
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Clients can view notifications by client id" ON public.notifications;
DROP POLICY IF EXISTS "Clients can update notifications by client id" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage gallery notifications" ON public.notifications;

-- Users can view notifications targeted at them
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = notifications.client_id AND c.user_id = auth.uid()
    )
  );

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = notifications.client_id AND c.user_id = auth.uid()
    )
  );

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = notifications.client_id AND c.user_id = auth.uid()
    )
  );

-- Admins can insert notifications for their clients
CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );

-- Admins can manage notifications for their clients
CREATE POLICY "Admins can manage gallery notifications" ON public.notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'super_admin')
    )
  );
