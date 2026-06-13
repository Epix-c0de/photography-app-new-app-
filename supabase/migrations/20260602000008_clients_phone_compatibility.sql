-- ============================================
-- Clients Table Phone Column Compatibility
-- Task: Fix client visibility across photographer dashboard and admin app
-- ============================================
-- The photographer web dashboard uses `phone` column.
-- The admin mobile app CreateClientForm was using `mobile_number`.
-- Standardise on `phone` and add `mobile_number` as a generated alias
-- so any code referencing either column continues to work.
-- ============================================

-- 1. Add mobile_number column if it doesn't exist yet
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS mobile_number TEXT;

-- 2. Back-fill: copy phone -> mobile_number for existing rows
UPDATE public.clients
SET mobile_number = phone
WHERE mobile_number IS NULL AND phone IS NOT NULL;

-- 3. Back-fill the reverse: copy mobile_number -> phone for rows that have
--    mobile_number but no phone (created by the old CreateClientForm)
UPDATE public.clients
SET phone = mobile_number
WHERE phone IS NULL AND mobile_number IS NOT NULL;

-- 4. Create a trigger to keep both columns in sync going forward
CREATE OR REPLACE FUNCTION public.sync_client_phone_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If phone was set/changed, mirror to mobile_number
  IF NEW.phone IS NOT NULL AND NEW.phone IS DISTINCT FROM OLD.phone THEN
    NEW.mobile_number := NEW.phone;
  END IF;
  -- If mobile_number was set/changed, mirror to phone
  IF NEW.mobile_number IS NOT NULL AND NEW.mobile_number IS DISTINCT FROM OLD.mobile_number THEN
    NEW.phone := NEW.mobile_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_phone ON public.clients;
CREATE TRIGGER trg_sync_client_phone
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_phone_columns();

-- 5. Also ensure the clients table allows admins to view clients
--    they created, even if the RLS policy was missed in earlier migrations.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = 'Admins can manage their own clients'
  ) THEN
    CREATE POLICY "Admins can manage their own clients"
      ON public.clients FOR ALL
      USING (auth.uid() = owner_admin_id);
  END IF;
END;
$$;

-- 6. Ensure clients table RLS is enabled
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
