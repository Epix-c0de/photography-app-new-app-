-- Handle existing portfolio_items table and policies
DROP POLICY IF EXISTS "Public read portfolio_items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins manage portfolio_items" ON public.portfolio_items;

-- Drop table if it exists (to ensure clean recreation)
DROP TABLE IF EXISTS public.portfolio_items;

-- Create portfolio_items table for admin-managed portfolio content
CREATE TABLE public.portfolio_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image',
    is_featured BOOLEAN DEFAULT false,
    is_top_rated BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Fix portfolio_items RLS policies to match BTS posts/announcements exactly
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read portfolio_items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Admins manage portfolio_items" ON public.portfolio_items;

-- Recreate policies with exact same logic as BTS posts/announcements
CREATE POLICY "Public read portfolio_items" ON public.portfolio_items FOR SELECT USING (true);

CREATE POLICY "Admins manage portfolio_items" ON public.portfolio_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
  OR created_by = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
  OR created_by = auth.uid()
);

-- Ensure RLS is enabled
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance
CREATE INDEX idx_portfolio_items_created_by ON public.portfolio_items(created_by);
CREATE INDEX idx_portfolio_items_is_featured ON public.portfolio_items(is_featured);
CREATE INDEX idx_portfolio_items_is_active ON public.portfolio_items(is_active);
CREATE INDEX idx_portfolio_items_category ON public.portfolio_items(category);
