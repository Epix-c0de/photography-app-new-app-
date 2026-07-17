-- ============================================================
-- Restore client RLS policies on messages table
-- These were dropped by 20260608000004_fix_messages_rls_and_gallery_access.sql
-- which only recreated admin policies.
-- ============================================================

-- Client SELECT: can read messages where they are the client
DROP POLICY IF EXISTS "Clients can view own messages" ON public.messages;
CREATE POLICY "Clients can view own messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
  );

-- Client INSERT: can send messages as client
DROP POLICY IF EXISTS "Clients can insert messages" ON public.messages;
CREATE POLICY "Clients can insert messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_role = 'client'
    AND client_id = auth.uid()
  );

-- Client UPDATE: can mark messages as read
DROP POLICY IF EXISTS "Clients can update own messages" ON public.messages;
CREATE POLICY "Clients can update own messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    client_id = auth.uid()
  );
