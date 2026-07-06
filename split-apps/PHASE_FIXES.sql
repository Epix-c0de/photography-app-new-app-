-- ============================================
-- PHASE FIXES - Run this in Supabase SQL Editor
-- ============================================

-- 1. FIX MESSAGES RLS POLICY
-- The current client INSERT policy fails when clients.user_id is NULL
DROP POLICY IF EXISTS "Clients can insert messages" ON public.messages;
DROP POLICY IF EXISTS "client_insert_policy" ON public.messages;
DROP POLICY IF EXISTS "clients_can_insert_messages" ON public.messages;

CREATE POLICY "Clients can insert messages"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_role = 'client'
        AND (
            client_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.clients
                WHERE id = client_id AND user_id = auth.uid()
            )
            OR (
                EXISTS (
                    SELECT 1 FROM public.clients
                    WHERE id = client_id AND user_id IS NULL
                )
                AND EXISTS (
                    SELECT 1 FROM public.user_profiles
                    WHERE id = auth.uid() AND role = 'client'
                )
            )
        )
    );

-- 2. GRANT FREE LIFETIME ACCESS TO epixshots001@gmail.com
UPDATE user_profiles 
SET 
  is_lifetime = true,
  subscription_status = 'active',
  subscription_expires_at = NULL,
  updated_at = NOW()
WHERE email = 'epixshots001@gmail.com';

-- Verify the update
SELECT 
  email,
  name,
  role,
  is_lifetime,
  subscription_status
FROM user_profiles 
WHERE email = 'epixshots001@gmail.com';

-- 3. ENSURE ADMIN CAN POST WITHOUT PAYMENT
CREATE OR REPLACE FUNCTION check_admin_post_access(p_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_lifetime BOOLEAN;
  v_subscription_status TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT 
    is_lifetime, 
    subscription_status,
    subscription_expires_at
  INTO v_is_lifetime, v_subscription_status, v_expires_at
  FROM user_profiles
  WHERE id = p_admin_id;
  
  IF v_is_lifetime = true THEN
    RETURN TRUE;
  END IF;
  
  IF v_subscription_status = 'active' AND 
     (v_expires_at IS NULL OR v_expires_at > NOW()) THEN
    RETURN TRUE;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = p_admin_id AND role = 'super_admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;