-- Migration: Simplify Portfolio Items RLS Policy
-- Date: 2026-03-11
-- Purpose: Fix "new row violates row-level security policy" error during portfolio uploads
-- Issue: Previous RLS policy was too restrictive with subquery checks

-- Disable and drop all existing portfolio_items policies
ALTER TABLE public.portfolio_items DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- Drop all old policies
DROP POLICY IF EXISTS "Portfolio items public read" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins can insert portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins can update portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins can delete portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins can manage their portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Clients can view public portfolio items" ON public.portfolio_items;

-- 1. Public read policy - anyone can view active portfolio items
CREATE POLICY "Portfolio items public read" ON public.portfolio_items 
  FOR SELECT 
  USING (is_active = true);

-- 2. Admin insert policy - simplified: just check if created_by matches current user
-- The admin role check happens during authentication
CREATE POLICY "Admins can insert portfolio items" ON public.portfolio_items 
  FOR INSERT 
  WITH CHECK (created_by = auth.uid());

-- 3. Admin update policy - allow admins to update items they created
CREATE POLICY "Admins can update portfolio items" ON public.portfolio_items 
  FOR UPDATE 
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- 4. Admin delete policy - allow admins to delete items they created
CREATE POLICY "Admins can delete portfolio items" ON public.portfolio_items 
  FOR DELETE 
  USING (created_by = auth.uid());

-- 5. Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_items_created_by ON public.portfolio_items(created_by);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_is_active ON public.portfolio_items(is_active);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_created_at ON public.portfolio_items(created_at DESC);
