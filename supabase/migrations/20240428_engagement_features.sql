-- Migration: Engagement Features & Simple M-PESA Settings

-- 1. Update portfolio_items with engagement counts (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portfolio_items'
  ) THEN
    ALTER TABLE public.portfolio_items 
    ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2. Create portfolio_likes table (only if portfolio_items exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portfolio_items'
  ) THEN
    CREATE TABLE IF NOT EXISTS public.portfolio_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        portfolio_item_id UUID NOT NULL REFERENCES public.portfolio_items(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id, portfolio_item_id)
    );

    ALTER TABLE public.portfolio_likes ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'portfolio_likes' AND policyname = 'Users can view all likes'
    ) THEN
      CREATE POLICY "Users can view all likes"
      ON public.portfolio_likes FOR SELECT
      USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'portfolio_likes' AND policyname = 'Authenticated users can toggle likes'
    ) THEN
      CREATE POLICY "Authenticated users can toggle likes"
      ON public.portfolio_likes FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- 3. Create simple_payment_settings table
CREATE TABLE IF NOT EXISTS public.simple_payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT,
    mpesa_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(admin_id)
);

-- RLS for simple_payment_settings
ALTER TABLE public.simple_payment_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'simple_payment_settings' AND policyname = 'Admins can manage their own simple settings'
  ) THEN
    CREATE POLICY "Admins can manage their own simple settings"
    ON public.simple_payment_settings FOR ALL
    USING (auth.uid() = admin_id)
    WITH CHECK (auth.uid() = admin_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'simple_payment_settings' AND policyname = 'Public/Clients can view simple settings for payments'
  ) THEN
    CREATE POLICY "Public/Clients can view simple settings for payments"
    ON public.simple_payment_settings FOR SELECT
    USING (true);
  END IF;
END $$;

-- 4. Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_simple_payment_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_simple_payment_settings_updated_at
        BEFORE UPDATE ON public.simple_payment_settings
        FOR EACH ROW
        EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

-- 5. Trigger to sync likes_count on portfolio_items (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portfolio_items'
  ) THEN
    CREATE OR REPLACE FUNCTION update_portfolio_likes_count()
    RETURNS TRIGGER AS $func$
    BEGIN
        IF (TG_OP = 'INSERT') THEN
            UPDATE public.portfolio_items
            SET likes_count = likes_count + 1
            WHERE id = NEW.portfolio_item_id;
        ELSIF (TG_OP = 'DELETE') THEN
            UPDATE public.portfolio_items
            SET likes_count = likes_count - 1
            WHERE id = OLD.portfolio_item_id;
        END IF;
        RETURN NULL;
    END;
    $func$ language 'plpgsql';

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'portfolio_likes'
    ) THEN
      DROP TRIGGER IF EXISTS portfolio_likes_count_trigger ON public.portfolio_likes;
      CREATE TRIGGER portfolio_likes_count_trigger
          AFTER INSERT OR DELETE ON public.portfolio_likes
          FOR EACH ROW
          EXECUTE PROCEDURE update_portfolio_likes_count();
    END IF;
  END IF;
END $$;
