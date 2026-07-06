-- Access Code Hashing Migration
-- Adds access_code_hash column alongside existing plaintext access_code
-- The plaintext column is kept for display purposes (photographers/clients need to see it)

-- 1. Add hash column
ALTER TABLE galleries ADD COLUMN IF NOT EXISTS access_code_hash text;

-- 2. Create index on hash column for fast lookups
CREATE INDEX IF NOT EXISTS idx_galleries_access_code_hash ON galleries(access_code_hash);

-- 3. Migrate existing access codes to hashed values
-- Uses pgcrypto's digest function for SHA-256 hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE galleries
SET access_code_hash = encode(digest(upper(access_code), 'sha256'), 'hex')
WHERE access_code_hash IS NULL;

-- 4. Add unique constraint on hash
ALTER TABLE galleries ADD CONSTRAINT unique_access_code_hash UNIQUE (access_code_hash);

-- 5. Create RPC for secure verification (hashes input before comparison)
CREATE OR REPLACE FUNCTION verify_access_code(p_access_code text)
RETURNS TABLE (
  id uuid,
  gallery_name text,
  photographer_id uuid,
  access_code text,
  is_active boolean,
  upload_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash text;
BEGIN
  -- Hash the input code
  v_hash := encode(digest(upper(trim(p_access_code)), 'sha256'), 'hex');

  RETURN QUERY
  SELECT g.id, g.gallery_name, g.photographer_id, g.access_code, g.is_active, g.upload_status
  FROM galleries g
  WHERE g.access_code_hash = v_hash
    AND g.is_active = true
    AND g.upload_status = 'completed'
  LIMIT 1;
END;
$$;

-- 6. Create trigger to auto-hash new access codes
CREATE OR REPLACE FUNCTION hash_access_code_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.access_code IS NOT NULL AND (NEW.access_code_hash IS NULL OR NEW.access_code IS DISTINCT FROM OLD.access_code) THEN
    NEW.access_code_hash := encode(digest(upper(NEW.access_code), 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_access_code ON galleries;
CREATE TRIGGER trg_hash_access_code
  BEFORE INSERT OR UPDATE ON galleries
  FOR EACH ROW
  EXECUTE FUNCTION hash_access_code_trigger();

-- 7. Migration verification
DO $$
BEGIN
  RAISE NOTICE 'Access code hashing migration complete';
  RAISE NOTICE 'Columns: access_code (plaintext, kept for display) + access_code_hash (SHA-256)';
  RAISE NOTICE 'Function: verify_access_code(p_code) — use this for verification';
  RAISE NOTICE 'Trigger: Auto-hashes new/updated access codes';
END $$;
