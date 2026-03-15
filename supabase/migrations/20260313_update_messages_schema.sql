-- Migration: Update messages table client_id to point to user_profiles instead of clients
-- This allows admins to chat with all users, even those without a record in the clients table.

DO $$
BEGIN
    -- 1. DROP the constraint first
    ALTER TABLE IF EXISTS public.messages 
    DROP CONSTRAINT IF EXISTS messages_client_id_fkey;

    -- 2. ADD the new constraint pointing to user_profiles
    ALTER TABLE public.messages
    ADD CONSTRAINT messages_client_id_fkey 
    FOREIGN KEY (client_id) 
    REFERENCES public.user_profiles(id);

    -- 3. UPDATE Policies (The original policies were using auth.uid() = owner_admin_id which is fine)
    -- But let's ensure we can also chat with users by adding more permissive selective policies if needed.
    -- (The existing ones in 20260214000002_create_messages_table.sql were okay but might need checking)
END $$;
