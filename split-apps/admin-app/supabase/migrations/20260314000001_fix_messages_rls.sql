-- Migration: Fix RLS policies for messages table to allow clients to chat
-- Allow clients to view and insert messages where they are the client_id

-- 1. DROP existing restrictive policies if they don't account for clients
-- (We keep the admin policies but ensure they are correctly named)

-- 2. ADD Client Policies
DROP POLICY IF EXISTS "Clients can view their own messages" ON public.messages;
CREATE POLICY "Clients can view their own messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING ( client_id = auth.uid() );

DROP POLICY IF EXISTS "Clients can insert messages" ON public.messages;
CREATE POLICY "Clients can insert messages"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK ( 
        client_id = auth.uid() AND 
        sender_role = 'client' 
    );

-- 3. Ensure Admin policies are broad enough (usually they are if owner_admin_id is set correctly)
-- Existing policies in 20260214000002_create_messages_table.sql:
-- "Admins can view messages for their clients" using ( owner_admin_id = auth.uid() )
-- "Admins can insert messages" with check ( owner_admin_id = auth.uid() )

-- If the admin is NOT the owner_admin_id but still wants to chat (as requested: "fetch all users regardless of admin binding")
-- We should probably allow any admin to chat with any user.

DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING ( 
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can insert any message" ON public.messages;
CREATE POLICY "Admins can insert any message"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK ( 
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        ) AND 
        sender_role = 'admin'
    );
