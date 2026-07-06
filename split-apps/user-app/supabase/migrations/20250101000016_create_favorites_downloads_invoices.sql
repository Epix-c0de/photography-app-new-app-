-- Favorites table (persist photo likes)
CREATE TABLE IF NOT EXISTS photo_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL,
  gallery_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, photo_id)
);

-- Download history table
CREATE TABLE IF NOT EXISTS download_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gallery_id UUID NOT NULL,
  gallery_name TEXT,
  photo_count INTEGER DEFAULT 0,
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  format TEXT DEFAULT 'original'
);

-- Invoices table (from payments)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photographer_id UUID NOT NULL,
  gallery_id UUID,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  description TEXT,
  payment_method TEXT DEFAULT 'mpesa',
  mpesa_receipt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Member benefits table
CREATE TABLE IF NOT EXISTS member_benefits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  points INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  discount_percent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ table
CREATE TABLE IF NOT EXISTS faqs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE photo_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- photo_favorites policies
CREATE POLICY "Users can view own favorites" ON photo_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add favorites" ON photo_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove favorites" ON photo_favorites FOR DELETE USING (auth.uid() = user_id);

-- download_history policies
CREATE POLICY "Users can view own downloads" ON download_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add downloads" ON download_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- invoices policies
CREATE POLICY "Users can view own invoices" ON invoices FOR SELECT USING (auth.uid() = user_id);

-- member_benefits policies
CREATE POLICY "Users can view own benefits" ON member_benefits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own benefits" ON member_benefits FOR UPDATE USING (auth.uid() = user_id);

-- support_tickets policies
CREATE POLICY "Users can view own tickets" ON support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create tickets" ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tickets" ON support_tickets FOR UPDATE USING (auth.uid() = user_id);

-- faqs policies (public read)
CREATE POLICY "Anyone can view FAQs" ON faqs FOR SELECT USING (is_active = true);

-- Insert default FAQs
INSERT INTO faqs (question, answer, category, sort_order) VALUES
('How do I unlock my gallery?', 'Enter your access code in the Gallery tab. Your photographer will provide this code after your session.', 'gallery', 1),
('How do I download photos?', 'Tap on any photo, then tap the download icon. You can also download all favorites at once from the Favorites page.', 'gallery', 2),
('What is M-Pesa payment?', 'M-Pesa is a mobile money service. When you book a session, you''ll receive an STK push to pay securely.', 'payment', 3),
('How do I book a session?', 'Go to the Bookings tab and select a package. Choose your preferred date and time, then confirm.', 'booking', 4),
('Can I share photos on social media?', 'Yes! From the gallery, tap the share icon on any photo to share directly to Instagram or Facebook.', 'gallery', 5),
('How do I contact my photographer?', 'Go to the Chat tab to message your photographer directly. They typically respond within 24 hours.', 'support', 6),
('What if I forgot my PIN?', 'You can reset your PIN from Settings > Security. You''ll need to verify your identity via SMS.', 'security', 7),
('How do referral credits work?', 'Share your referral code with friends. When they book and pay, you both earn credits towards future sessions.', 'referral', 8);

-- Function to toggle favorite
CREATE OR REPLACE FUNCTION toggle_photo_favorite(
  p_user_id UUID,
  p_photo_id UUID,
  p_gallery_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM photo_favorites 
    WHERE user_id = p_user_id AND photo_id = p_photo_id
  ) INTO v_exists;
  
  IF v_exists THEN
    DELETE FROM photo_favorites 
    WHERE user_id = p_user_id AND photo_id = p_photo_id;
    RETURN FALSE;
  ELSE
    INSERT INTO photo_favorites (user_id, photo_id, gallery_id)
    VALUES (p_user_id, p_photo_id, p_gallery_id);
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user favorites
CREATE OR REPLACE FUNCTION get_user_favorites(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  photo_id UUID,
  gallery_id UUID,
  gallery_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pf.id,
    pf.photo_id,
    pf.gallery_id,
    g.name as gallery_name,
    pf.created_at
  FROM photo_favorites pf
  LEFT JOIN galleries g ON g.id = pf.gallery_id
  WHERE pf.user_id = p_user_id
  ORDER BY pf.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate member tier
CREATE OR REPLACE FUNCTION calculate_member_tier(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_total_bookings INTEGER;
  v_total_spent DECIMAL;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_total_bookings, v_total_spent
  FROM invoices
  WHERE user_id = p_user_id AND status = 'paid';
  
  IF v_total_bookings >= 20 OR v_total_spent >= 100000 THEN
    RETURN 'platinum';
  ELSIF v_total_bookings >= 10 OR v_total_spent >= 50000 THEN
    RETURN 'gold';
  ELSIF v_total_bookings >= 5 OR v_total_spent >= 20000 THEN
    RETURN 'silver';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get member benefits
CREATE OR REPLACE FUNCTION get_member_benefits(p_user_id UUID)
RETURNS TABLE (
  tier TEXT,
  points INTEGER,
  total_bookings BIGINT,
  total_spent DECIMAL,
  discount_percent INTEGER,
  next_tier TEXT,
  points_to_next INTEGER
) AS $$
DECLARE
  v_tier TEXT;
  v_points INTEGER;
  v_bookings BIGINT;
  v_spent DECIMAL;
  v_discount INTEGER;
  v_next_tier TEXT;
  v_points_needed INTEGER;
BEGIN
  SELECT 
    COALESCE(mb.tier, 'bronze'),
    COALESCE(mb.points, 0),
    COALESCE(COUNT(inv.id), 0),
    COALESCE(SUM(CASE WHEN inv.status = 'paid' THEN inv.amount ELSE 0 END), 0)
  INTO v_tier, v_points, v_bookings, v_spent
  FROM member_benefits mb
  LEFT JOIN invoices inv ON inv.user_id = mb.user_id
  WHERE mb.user_id = p_user_id
  GROUP BY mb.tier, mb.points;
  
  -- Calculate discount
  CASE v_tier
    WHEN 'platinum' THEN v_discount := 20;
    WHEN 'gold' THEN v_discount := 15;
    WHEN 'silver' THEN v_discount := 10;
    ELSE v_discount := 0;
  END CASE;
  
  -- Determine next tier
  CASE v_tier
    WHEN 'bronze' THEN 
      v_next_tier := 'silver';
      v_points_needed := GREATEST(0, 5 - v_bookings);
    WHEN 'silver' THEN 
      v_next_tier := 'gold';
      v_points_needed := GREATEST(0, 10 - v_bookings);
    WHEN 'gold' THEN 
      v_next_tier := 'platinum';
      v_points_needed := GREATEST(0, 20 - v_bookings);
    ELSE 
      v_next_tier := NULL;
      v_points_needed := 0;
  END CASE;
  
  RETURN QUERY SELECT v_tier, v_points, v_bookings, v_spent, v_discount, v_next_tier, v_points_needed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;