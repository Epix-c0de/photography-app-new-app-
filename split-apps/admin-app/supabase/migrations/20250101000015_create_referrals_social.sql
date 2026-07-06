-- Referrals table for photographer referral program
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  reward_amount DECIMAL(10,2) DEFAULT 100,
  reward_credits INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ
);

-- Social media connections table
CREATE TABLE IF NOT EXISTS social_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'twitter')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  profile_id TEXT,
  profile_name TEXT,
  profile_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social shares table
CREATE TABLE IF NOT EXISTS social_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bts_id UUID REFERENCES bts_announcements(id) ON DELETE SET NULL,
  gallery_id UUID REFERENCES galleries(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'twitter')),
  post_id TEXT,
  post_url TEXT,
  caption TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed')),
  error_message TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photographer credits table (for referral rewards)
CREATE TABLE IF NOT EXISTS photographer_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('referral', 'bonus', 'payment', 'adjustment')),
  description TEXT,
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_social_connections_photographer ON social_connections(photographer_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON social_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_shares_photographer ON social_shares(photographer_id);
CREATE INDEX IF NOT EXISTS idx_social_shares_platform ON social_shares(platform);
CREATE INDEX IF NOT EXISTS idx_photographer_credits_photographer ON photographer_credits(photographer_id);

-- RLS policies
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE photographer_credits ENABLE ROW LEVEL SECURITY;

-- Referrals policies
CREATE POLICY "Photographers can view their own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Photographers can create referrals" ON referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "System can update referrals" ON referrals
  FOR UPDATE USING (true);

-- Social connections policies
CREATE POLICY "Photographers can view their own social connections" ON social_connections
  FOR SELECT USING (auth.uid() = photographer_id);

CREATE POLICY "Photographers can manage their social connections" ON social_connections
  FOR ALL USING (auth.uid() = photographer_id);

-- Social shares policies
CREATE POLICY "Photographers can view their own social shares" ON social_shares
  FOR SELECT USING (auth.uid() = photographer_id);

CREATE POLICY "Photographers can create social shares" ON social_shares
  FOR INSERT WITH CHECK (auth.uid() = photographer_id);

CREATE POLICY "System can update social shares" ON social_shares
  FOR UPDATE USING (true);

-- Photographer credits policies
CREATE POLICY "Photographers can view their own credits" ON photographer_credits
  FOR SELECT USING (auth.uid() = photographer_id);

CREATE POLICY "System can create credits" ON photographer_credits
  FOR INSERT WITH CHECK (true);

-- Functions

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_username TEXT;
  v_random TEXT;
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Get username from user metadata
  SELECT raw_user_meta_data->>'full_name' INTO v_username
  FROM auth.users WHERE id = p_user_id;
  
  -- Clean username
  v_username := UPPER(REPLACE(COALESCE(v_username, 'USER'), ' ', ''));
  v_username := SUBSTRING(v_username FROM 1 FOR 6);
  
  -- Generate unique code
  LOOP
    v_random := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    v_code := 'EPX-' || v_username || '-' || v_random;
    
    SELECT EXISTS(SELECT 1 FROM referrals WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Function to process referral
CREATE OR REPLACE FUNCTION process_referral(
  p_referral_code TEXT,
  p_new_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_referral RECORD;
  v_result JSON;
BEGIN
  -- Find referral by code
  SELECT * INTO v_referral
  FROM referrals
  WHERE referral_code = UPPER(p_referral_code)
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Invalid or used referral code');
  END IF;
  
  -- Update referral
  UPDATE referrals
  SET referred_id = p_new_user_id,
      status = 'completed',
      completed_at = NOW()
  WHERE id = v_referral.id;
  
  -- Add credits to referrer
  INSERT INTO photographer_credits (photographer_id, amount, source, description, referral_id)
  VALUES (v_referral.referrer_id, v_referral.reward_credits, 'referral', 
          'Referral reward for referring a new photographer', v_referral.id);
  
  -- Mark as rewarded
  UPDATE referrals
  SET status = 'rewarded',
      rewarded_at = NOW()
  WHERE id = v_referral.id;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Referral processed successfully',
    'credits_awarded', v_referral.reward_credits
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get referral stats
CREATE OR REPLACE FUNCTION get_referral_stats(p_photographer_id UUID)
RETURNS TABLE (
  total_referrals BIGINT,
  pending_referrals BIGINT,
  completed_referrals BIGINT,
  total_credits_earned INT,
  referral_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_referrals,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_referrals,
    COUNT(*) FILTER (WHERE status IN ('completed', 'rewarded')) as completed_referrals,
    COALESCE(SUM(reward_credits) FILTER (WHERE status = 'rewarded'), 0)::INT as total_credits_earned,
    (SELECT referral_code FROM referrals WHERE referrer_id = p_photographer_id LIMIT 1) as referral_code
  FROM referrals
  WHERE referrer_id = p_photographer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get credit balance
CREATE OR REPLACE FUNCTION get_credit_balance(p_photographer_id UUID)
RETURNS INT AS $$
DECLARE
  v_balance INT;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM photographer_credits
  WHERE photographer_id = p_photographer_id;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_social_connections_updated_at
  BEFORE UPDATE ON social_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
