-- Migration: Simplify BTS and Announcements RLS Policies
-- Date: 2026-03-11
-- Purpose: Make RLS policies consistent and simpler - just check created_by = auth.uid()
-- Issue: Complex subqueries for role checking can cause false negatives

-- ========================================
-- 1. SIMPLIFY BTS_POSTS RLS
-- ========================================
ALTER TABLE public.bts_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bts_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BTS posts public read" ON public.bts_posts;
DROP POLICY IF EXISTS "Admins can insert bts_posts" ON public.bts_posts;
DROP POLICY IF EXISTS "Admins can update bts_posts" ON public.bts_posts;
DROP POLICY IF EXISTS "Admins can delete bts_posts" ON public.bts_posts;
DROP POLICY IF EXISTS "Admins manage bts_posts" ON public.bts_posts;
DROP POLICY IF EXISTS "Public read bts_posts" ON public.bts_posts;

-- Public read: view active BTS posts
CREATE POLICY "BTS public read" ON public.bts_posts 
  FOR SELECT 
  USING (is_active = true);

-- Admin insert: created_by must match current user
CREATE POLICY "BTS admin insert" ON public.bts_posts 
  FOR INSERT 
  WITH CHECK (created_by = auth.uid());

-- Admin update: only if created_by matches
CREATE POLICY "BTS admin update" ON public.bts_posts 
  FOR UPDATE 
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Admin delete: only if created_by matches
CREATE POLICY "BTS admin delete" ON public.bts_posts 
  FOR DELETE 
  USING (created_by = auth.uid());

-- ========================================
-- 2. SIMPLIFY ANNOUNCEMENTS RLS
-- ========================================
ALTER TABLE public.announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Announcements public read" ON public.announcements;
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Public read announcements" ON public.announcements;

-- Public read: view active announcements
CREATE POLICY "Announcements public read" ON public.announcements 
  FOR SELECT 
  USING (is_active = true);

-- Admin insert: created_by must match current user
CREATE POLICY "Announcements admin insert" ON public.announcements 
  FOR INSERT 
  WITH CHECK (created_by = auth.uid());

-- Admin update: only if created_by matches
CREATE POLICY "Announcements admin update" ON public.announcements 
  FOR UPDATE 
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Admin delete: only if created_by matches
CREATE POLICY "Announcements admin delete" ON public.announcements 
  FOR DELETE 
  USING (created_by = auth.uid());
