-- 1. Expand role constraint in user_profiles to allow 'super_admin'
DO $$ 
BEGIN
    ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('admin', 'client', 'super_admin'));
EXCEPTION
    WHEN undefined_object THEN
        -- Table might not have this specific constraint name, or already dropped
        NULL;
END $$;

-- 2. Drop existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Admins manage bts_posts" ON public.bts_posts;
DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Public read bts_posts" ON public.bts_posts;
DROP POLICY IF EXISTS "Public read announcements" ON public.announcements;

-- 3. Create robust policies for bts_posts
-- Allow public select
CREATE POLICY "Public read bts_posts" ON public.bts_posts FOR SELECT USING (true);

-- Allow admins/owners to manage everything
CREATE POLICY "Admins manage bts_posts" ON public.bts_posts FOR ALL
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

-- 4. Create robust policies for announcements
-- Allow public select
CREATE POLICY "Public read announcements" ON public.announcements FOR SELECT USING (true);

-- Allow admins/owners to manage everything
CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL
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

-- 5. Ensure RLS is actually enabled (just in case)
ALTER TABLE public.bts_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
