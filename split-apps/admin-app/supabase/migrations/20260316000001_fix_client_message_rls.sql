-- Fix RLS policy for clients inserting messages
-- The previous policy checked `client_id = auth.uid()`, but `client_id` is the ID of the row in the `clients` table, 
-- whereas `auth.uid()` is the user ID. We need to check if the user owns the client record.

DROP POLICY IF EXISTS "Clients can insert messages" ON public.messages;

CREATE POLICY "Clients can insert messages"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK ( 
        sender_role = 'client' AND
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE id = client_id AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Clients can view their own messages" ON public.messages;

CREATE POLICY "Clients can view their own messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE id = client_id AND user_id = auth.uid()
        )
    );
