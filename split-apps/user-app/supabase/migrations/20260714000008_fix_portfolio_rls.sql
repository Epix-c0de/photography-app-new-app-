-- Fix portfolio RLS: Drop all existing policies and recreate with correct logic
-- This eliminates conflicting policies from migration history that cause
-- "new row violates row-level security policy" on portfolio inserts

-- Drop ALL existing policies on portfolio_items (by known name variants)
DROP POLICY IF EXISTS "Public read portfolio_items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins manage portfolio_items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Portfolio items public read" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins can insert portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins can update portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins can delete portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins can manage their portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Clients can view public portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Anyone can view portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Authenticated users can insert portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Can update own portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Can delete own portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_select_active" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_insert_admin" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_update_admin" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_delete_admin" ON public.portfolio_items;

-- Add missing columns if they don't exist
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure RLS is enabled
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Anyone can view active portfolio items (or all if is_active doesn't exist)
CREATE POLICY "portfolio_items_select_active" ON public.portfolio_items
  FOR SELECT USING (COALESCE(is_active, true) = true);

-- 2. INSERT: Admins and super_admins can insert their own portfolio items
CREATE POLICY "portfolio_items_insert_admin" ON public.portfolio_items
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- 3. UPDATE: Admins can update their own portfolio items
CREATE POLICY "portfolio_items_update_admin" ON public.portfolio_items
  FOR UPDATE USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (created_by = auth.uid());

-- 4. DELETE: Admins can delete their own portfolio items
CREATE POLICY "portfolio_items_delete_admin" ON public.portfolio_items
  FOR DELETE USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
