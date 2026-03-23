-- Relax client message RLS to support both client_id models:
-- 1) client_id -> public.clients.id
-- 2) client_id -> public.user_profiles.id (auth.uid())
-- This prevents RLS violations when the schema differs across environments.

-- INSERT policy for clients
DROP POLICY IF EXISTS "Clients can insert messages" ON public.messages;
CREATE POLICY "Clients can insert messages"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_role = 'client' AND (
            client_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.clients
                WHERE id = client_id AND user_id = auth.uid()
            )
        )
    );

-- SELECT policy for clients
DROP POLICY IF EXISTS "Clients can view their own messages" ON public.messages;
CREATE POLICY "Clients can view their own messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        client_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.clients
            WHERE id = client_id AND user_id = auth.uid()
        )
    );

