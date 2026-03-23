-- Fix RLS policy to allow clients to create their own client record
-- This is necessary for the chat system to automatically link a user to an admin

DROP POLICY IF EXISTS "Clients can insert their own record" ON public.clients;

CREATE POLICY "Clients can insert their own record"
    ON public.clients FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
    );
