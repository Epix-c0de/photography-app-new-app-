-- Fix Messages RLS Policy
-- The current client INSERT policy fails when clients.user_id is NULL
-- This migration drops and recreates the policy with proper fallback logic

-- Drop the problematic client INSERT policy
DROP POLICY IF EXISTS "Clients can insert messages" ON public.messages;
DROP POLICY IF EXISTS "client_insert_policy" ON public.messages;
DROP POLICY IF EXISTS "clients_can_insert_messages" ON public.messages;

-- Create a robust client INSERT policy
CREATE POLICY "Clients can insert messages"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_role = 'client'
        AND (
            -- Case 1: client_id matches auth.uid() directly
            client_id = auth.uid()
            OR
            -- Case 2: Client record exists and user_id matches
            EXISTS (
                SELECT 1 FROM public.clients
                WHERE id = client_id AND user_id = auth.uid()
            )
            OR
            -- Case 3: Client record exists but user_id is NULL (pre-created by phone)
            -- Allow if the authenticated user has client role
            (
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

-- Also ensure admin INSERT policy is correct
DROP POLICY IF EXISTS "Admins can insert messages" ON public.messages;
DROP POLICY IF EXISTS "admin_insert_policy" ON public.messages;
DROP POLICY IF EXISTS "admins_can_insert_messages" ON public.messages;

CREATE POLICY "Admins can insert messages"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_role = 'admin'
        AND owner_admin_id = auth.uid()
        AND (
            SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
        ) IN ('admin', 'super_admin')
    );

-- Ensure admin UPDATE policy exists (for marking as read)
DROP POLICY IF EXISTS "Admins can update messages" ON public.messages;
CREATE POLICY "Admins can update messages"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (
        owner_admin_id = auth.uid()
        AND (
            SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
        ) IN ('admin', 'super_admin')
    );

-- Ensure client UPDATE policy exists (for marking as read)
DROP POLICY IF EXISTS "Clients can update messages" ON public.messages;
CREATE POLICY "Clients can update messages"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (
        sender_role = 'client'
        AND (
            client_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.clients
                WHERE id = client_id AND user_id = auth.uid()
            )
        )
    );

-- Ensure SELECT policies exist for both roles
DROP POLICY IF EXISTS "Admins can view messages" ON public.messages;
CREATE POLICY "Admins can view messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        owner_admin_id = auth.uid()
        AND (
            SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
        ) IN ('admin', 'super_admin')
    );

DROP POLICY IF EXISTS "Clients can view messages" ON public.messages;
CREATE POLICY "Clients can view messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        sender_role = 'client'
        AND (
            client_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.clients
                WHERE id = client_id AND user_id = auth.uid()
            )
        )
    );