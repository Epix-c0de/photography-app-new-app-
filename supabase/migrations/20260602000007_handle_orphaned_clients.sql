-- ============================================
-- Handle Orphaned Client Records
-- Task: 27.2 Add handling for orphaned client records
-- Requirements: 16.2, 16.6
-- ============================================
-- An "orphaned" client record is one where:
--   a) user_id IS NULL (user account was deleted before/after client creation)
--   b) owner_admin_id references a user_profiles row that no longer exists
-- This migration adds safeguards and a cleanup utility function.
-- ============================================

-- 1. Ensure clients.user_id can be NULL safely (no constraint violation on delete)
--    The FK should already be ON DELETE SET NULL from earlier migrations.
--    We add it defensively here only if the constraint doesn't exist yet.
DO $$
BEGIN
  -- Check if clients_user_id_fkey already has ON DELETE SET NULL
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
    WHERE kcu.table_name = 'clients'
      AND kcu.column_name = 'user_id'
      AND rc.delete_rule = 'SET NULL'
  ) THEN
    -- Drop old FK if it exists without SET NULL
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'clients'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'clients_user_id_fkey'
    ) THEN
      ALTER TABLE public.clients DROP CONSTRAINT clients_user_id_fkey;
    END IF;

    -- Re-add with ON DELETE SET NULL so deleting a user doesn't break the row
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- 2. Ensure clients.owner_admin_id FK is ON DELETE SET NULL as well
--    so removing a photographer doesn't orphan their clients (Req 16.3 / 16.6)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
    WHERE kcu.table_name = 'clients'
      AND kcu.column_name = 'owner_admin_id'
      AND rc.delete_rule = 'SET NULL'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'clients'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%owner_admin_id%'
    ) THEN
      -- Drop old constraint (name may vary)
      DECLARE
        v_constraint_name TEXT;
      BEGIN
        SELECT constraint_name INTO v_constraint_name
        FROM information_schema.key_column_usage
        WHERE table_name = 'clients' AND column_name = 'owner_admin_id'
        LIMIT 1;

        IF v_constraint_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE public.clients DROP CONSTRAINT ' || quote_ident(v_constraint_name);
        END IF;
      END;
    END IF;

    ALTER TABLE public.clients
      ADD CONSTRAINT clients_owner_admin_id_fkey
      FOREIGN KEY (owner_admin_id)
      REFERENCES public.user_profiles(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- 3. View: surface currently orphaned client records for admin review
CREATE OR REPLACE VIEW public.v_orphaned_clients AS
SELECT
  c.id                   AS client_id,
  c.name                 AS client_name,
  COALESCE(c.phone, c.mobile_number) AS phone,  -- phone is the primary column; mobile_number is compat alias
  c.email,
  c.user_id,
  c.owner_admin_id,
  c.created_at,
  -- Classify the type of orphan
  CASE
    WHEN c.user_id IS NULL AND c.owner_admin_id IS NULL
      THEN 'fully_orphaned'
    WHEN c.user_id IS NULL
      THEN 'no_user_account'
    WHEN c.owner_admin_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles up WHERE up.id = c.owner_admin_id
      )
      THEN 'missing_photographer'
    ELSE 'unknown'
  END AS orphan_type
FROM public.clients c
WHERE
  c.user_id IS NULL
  OR (
    c.owner_admin_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.id = c.owner_admin_id
    )
  );

COMMENT ON VIEW public.v_orphaned_clients IS
  'Lists client records with missing user accounts or missing photographer profiles. '
  'Used for admin review and cleanup. Requirements 16.2, 16.6.';

-- 4. Function: clean up fully-orphaned client records (no user, no photographer)
--    Only removes records where BOTH user_id AND owner_admin_id are NULL.
--    Returns count of rows deleted.
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_clients()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.clients
  WHERE user_id IS NULL
    AND owner_admin_id IS NULL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Log the cleanup action
  INSERT INTO public.admin_audit_log (
    admin_id,
    action,
    resource_type,
    details,
    created_at
  )
  VALUES (
    auth.uid(),
    'cleanup_orphaned_clients',
    'clients',
    jsonb_build_object('deleted_count', v_deleted),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_orphaned_clients() IS
  'Removes fully-orphaned client records (no user account AND no photographer). '
  'Returns the number of records deleted. Requirements 16.2, 16.6.';

GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_clients() TO authenticated;

-- 5. Function: fix missing-photographer orphans by clearing the stale owner_admin_id
CREATE OR REPLACE FUNCTION public.fix_missing_photographer_clients()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.clients c
  SET owner_admin_id = NULL
  WHERE c.owner_admin_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.id = c.owner_admin_id
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO public.admin_audit_log (
    admin_id,
    action,
    resource_type,
    details,
    created_at
  )
  VALUES (
    auth.uid(),
    'fix_missing_photographer_clients',
    'clients',
    jsonb_build_object('updated_count', v_updated),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.fix_missing_photographer_clients() IS
  'Clears stale owner_admin_id from client records whose photographer no longer exists. '
  'Returns the number of records updated. Requirement 16.6.';

GRANT EXECUTE ON FUNCTION public.fix_missing_photographer_clients() TO authenticated;
