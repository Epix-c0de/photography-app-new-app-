-- Update messages.client_id FK to point to user_profiles instead of clients
DO $$
BEGIN
  -- Drop old FK if it points to clients
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_class r ON r.oid = c.confrelid
    WHERE t.relname = 'messages' AND r.relname = 'clients' AND c.contype = 'f'
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_client_id_fkey;
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.user_profiles(id);
  END IF;
END $$;
