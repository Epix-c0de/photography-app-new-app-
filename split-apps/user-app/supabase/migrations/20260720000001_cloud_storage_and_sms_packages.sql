-- ============================================================
-- Cloud Storage System + SMS Package Management
-- ============================================================

-- 1. CLOUD STORAGE TIERS
-- Super admin defines tiers that admins can purchase
CREATE TABLE IF NOT EXISTS public.storage_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,              -- e.g. '1GB', '5GB', '10GB', '50GB'
  storage_mb int NOT NULL,         -- size in MB
  price_kes int NOT NULL,          -- price in KES
  is_active boolean DEFAULT true,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. ADMIN STORAGE ALLOCATIONS
-- Each admin gets a base free tier + purchased extra storage
CREATE TABLE IF NOT EXISTS public.admin_storage_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE,
  base_storage_mb int DEFAULT 10240,    -- 10GB free
  extra_storage_mb int DEFAULT 0,       -- purchased add-on
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. STORAGE PURCHASES
-- Tracks when admins buy extra storage
CREATE TABLE IF NOT EXISTS public.storage_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.user_profiles(id),
  tier_id uuid REFERENCES public.storage_tiers(id),
  storage_mb int NOT NULL,
  amount_kes int NOT NULL,
  mpesa_receipt text,
  phone_number text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamptz DEFAULT now()
);

-- 4. STORAGE USAGE TRACKING
-- Track actual storage usage per admin
CREATE TABLE IF NOT EXISTS public.admin_storage_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE,
  used_bytes bigint DEFAULT 0,
  photo_count int DEFAULT 0,
  video_count int DEFAULT 0,
  last_calculated_at timestamptz DEFAULT now()
);

-- 5. ADD storage_tiers TO sms_credit_packages (rename for clarity)
-- sms_credit_packages already exists — just ensure it has the right columns
ALTER TABLE public.sms_credit_packages ADD COLUMN IF NOT EXISTS display_order int DEFAULT 0;
ALTER TABLE public.sms_credit_packages ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE public.sms_credit_packages ADD COLUMN IF NOT EXISTS description text;

-- RLS Policies
ALTER TABLE public.storage_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_storage_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_storage_usage ENABLE ROW LEVEL SECURITY;

-- Storage tiers: anyone can read (for marketplace), only super admin can modify
CREATE POLICY "Storage tiers public read" ON public.storage_tiers FOR SELECT USING (true);
CREATE POLICY "Super admin manage storage tiers" ON public.storage_tiers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Admin storage allocations: admin can read their own, super admin can read all
CREATE POLICY "Admin read own allocation" ON public.admin_storage_allocations FOR SELECT
  USING (auth.uid() = admin_id);
CREATE POLICY "Super admin read all allocations" ON public.admin_storage_allocations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Super admin manage allocations" ON public.admin_storage_allocations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Storage purchases: admin can read their own, super admin can read all
CREATE POLICY "Admin read own purchases" ON public.storage_purchases FOR SELECT
  USING (auth.uid() = admin_id);
CREATE POLICY "Super admin manage purchases" ON public.storage_purchases FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Storage usage: admin can read their own, super admin can read all
CREATE POLICY "Admin read own usage" ON public.admin_storage_usage FOR SELECT
  USING (auth.uid() = admin_id);
CREATE POLICY "Super admin manage usage" ON public.admin_storage_usage FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- RPC: Get admin's storage summary
CREATE OR REPLACE FUNCTION public.get_admin_storage_summary(p_admin_id uuid)
RETURNS TABLE(
  base_storage_mb int,
  extra_storage_mb int,
  total_storage_mb int,
  used_bytes bigint,
  used_mb numeric,
  usage_percent numeric,
  photo_count int,
  video_count int
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.base_storage_mb,
    a.extra_storage_mb,
    (a.base_storage_mb + a.extra_storage_mb) as total_storage_mb,
    COALESCE(u.used_bytes, 0) as used_bytes,
    ROUND(COALESCE(u.used_bytes, 0) / 1048576.0, 2) as used_mb,
    ROUND(COALESCE(u.used_bytes, 0) / ((a.base_storage_mb + a.extra_storage_mb) * 1048576.0) * 100, 1) as usage_percent,
    COALESCE(u.photo_count, 0) as photo_count,
    COALESCE(u.video_count, 0) as video_count
  FROM public.admin_storage_allocations a
  LEFT JOIN public.admin_storage_usage u ON u.admin_id = a.admin_id
  WHERE a.admin_id = p_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get all photographers storage metrics (for super admin)
CREATE OR REPLACE FUNCTION public.get_all_storage_metrics()
RETURNS TABLE(
  admin_id uuid,
  admin_name text,
  base_storage_mb int,
  extra_storage_mb int,
  total_storage_mb int,
  used_bytes bigint,
  used_mb numeric,
  usage_percent numeric,
  photo_count int,
  video_count int
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.admin_id,
    COALESCE(p.name, 'Unknown') as admin_name,
    a.base_storage_mb,
    a.extra_storage_mb,
    (a.base_storage_mb + a.extra_storage_mb) as total_storage_mb,
    COALESCE(u.used_bytes, 0) as used_bytes,
    ROUND(COALESCE(u.used_bytes, 0) / 1048576.0, 2) as used_mb,
    ROUND(COALESCE(u.used_bytes, 0) / ((a.base_storage_mb + a.extra_storage_mb) * 1048576.0) * 100, 1) as usage_percent,
    COALESCE(u.photo_count, 0) as photo_count,
    COALESCE(u.video_count, 0) as video_count
  FROM public.admin_storage_allocations a
  LEFT JOIN public.admin_storage_usage u ON u.admin_id = a.admin_id
  LEFT JOIN public.user_profiles p ON p.id = a.admin_id
  ORDER BY COALESCE(u.used_bytes, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Allocate storage to admin (super admin action)
CREATE OR REPLACE FUNCTION public.allocate_admin_storage(
  p_admin_id uuid,
  p_extra_storage_mb int
)
RETURNS jsonb AS $$
DECLARE
  v_existing record;
BEGIN
  -- Check super admin role
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Upsert allocation
  INSERT INTO public.admin_storage_allocations (admin_id, extra_storage_mb)
  VALUES (p_admin_id, p_extra_storage_mb)
  ON CONFLICT (admin_id) DO UPDATE SET
    extra_storage_mb = p_extra_storage_mb,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'message', 'Storage allocated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Record storage purchase
CREATE OR REPLACE FUNCTION public.record_storage_purchase(
  p_admin_id uuid,
  p_tier_id uuid,
  p_storage_mb int,
  p_amount_kes int,
  p_mpesa_receipt text DEFAULT NULL,
  p_phone_number text DEFAULT NULL
)
RETURNS jsonb AS $$
BEGIN
  -- Check super admin role
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Insert purchase record
  INSERT INTO public.storage_purchases (admin_id, tier_id, storage_mb, amount_kes, mpesa_receipt, phone_number, status)
  VALUES (p_admin_id, p_tier_id, p_storage_mb, p_amount_kes, p_mpesa_receipt, p_phone_number, 'completed');

  -- Update admin's extra storage
  UPDATE public.admin_storage_allocations
  SET extra_storage_mb = extra_storage_mb + p_storage_mb,
      updated_at = now()
  WHERE admin_id = p_admin_id;

  -- If no allocation exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.admin_storage_allocations (admin_id, extra_storage_mb)
    VALUES (p_admin_id, p_storage_mb);
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Purchase recorded and storage allocated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Adjust SMS credits (super admin manual adjustment)
CREATE OR REPLACE FUNCTION public.adjust_sms_credits(
  p_admin_id uuid,
  p_credits int,
  p_reason text DEFAULT 'Manual adjustment',
  p_adjustment_type text DEFAULT 'add'
)
RETURNS jsonb AS $$
DECLARE
  v_new_balance int;
BEGIN
  -- Check super admin role
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Upsert credits
  INSERT INTO public.sms_credits (admin_id, balance, total_purchased)
  VALUES (p_admin_id, p_credits, CASE WHEN p_adjustment_type = 'add' THEN p_credits ELSE 0 END)
  ON CONFLICT (admin_id) DO UPDATE SET
    balance = CASE
      WHEN p_adjustment_type = 'add' THEN sms_credits.balance + p_credits
      WHEN p_adjustment_type = 'deduct' THEN GREATEST(0, sms_credits.balance - p_credits)
      ELSE sms_credits.balance
    END,
    total_purchased = CASE WHEN p_adjustment_type = 'add' THEN sms_credits.total_purchased + p_credits ELSE sms_credits.total_purchased END
  RETURNING balance INTO v_new_balance;

  -- Log the transaction
  INSERT INTO public.sms_purchase_transactions (admin_id, package_id, sms_count, amount, status, mpesa_receipt)
  VALUES (p_admin_id, NULL, CASE WHEN p_adjustment_type = 'add' THEN p_credits ELSE -p_credits END, 0, 'completed', 'manual:' || p_reason);

  -- Update user_profiles.sms_credits
  UPDATE public.user_profiles SET sms_credits = v_new_balance WHERE id = p_admin_id;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Create SMS credit package (super admin)
CREATE OR REPLACE FUNCTION public.create_sms_package(
  p_name text,
  p_sms_count int,
  p_price int,
  p_description text DEFAULT NULL,
  p_is_featured boolean DEFAULT false
)
RETURNS jsonb AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  INSERT INTO public.sms_credit_packages (name, sms_count, price, description, is_featured)
  VALUES (p_name, p_sms_count, p_price, p_description, p_is_featured);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Delete SMS credit package (super admin)
CREATE OR REPLACE FUNCTION public.delete_sms_package(p_package_id uuid)
RETURNS jsonb AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  DELETE FROM public.sms_credit_packages WHERE id = p_package_id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed default storage tiers
INSERT INTO public.storage_tiers (name, storage_mb, price_kes, display_order) VALUES
  ('1GB Extra', 1024, 500, 1),
  ('5GB Extra', 5120, 2000, 2),
  ('10GB Extra', 10240, 3500, 3),
  ('50GB Extra', 51200, 15000, 4),
  ('100GB Extra', 102400, 25000, 5)
ON CONFLICT DO NOTHING;

-- Seed default allocations for existing admins
INSERT INTO public.admin_storage_allocations (admin_id, base_storage_mb, extra_storage_mb)
SELECT id, 10240, 0
FROM public.user_profiles
WHERE role IN ('admin', 'super_admin')
ON CONFLICT (admin_id) DO NOTHING;

-- Seed default SMS packages if none exist
INSERT INTO public.sms_credit_packages (name, sms_count, price, description, is_featured)
SELECT * FROM (VALUES
  ('Starter', 100, 100, '100 SMS credits', false),
  ('Growth', 500, 400, '500 SMS credits - Best value', true),
  ('Pro', 1000, 700, '1000 SMS credits', false),
  ('Enterprise', 5000, 3000, '5000 SMS credits', false)
) AS v(name, sms_count, price, description, is_featured)
WHERE NOT EXISTS (SELECT 1 FROM public.sms_credit_packages LIMIT 1);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storage_allocations_admin ON public.admin_storage_allocations(admin_id);
CREATE INDEX IF NOT EXISTS idx_storage_purchases_admin ON public.storage_purchases(admin_id);
CREATE INDEX IF NOT EXISTS idx_storage_usage_admin ON public.admin_storage_usage(admin_id);
CREATE INDEX IF NOT EXISTS idx_storage_tiers_active ON public.storage_tiers(is_active);
