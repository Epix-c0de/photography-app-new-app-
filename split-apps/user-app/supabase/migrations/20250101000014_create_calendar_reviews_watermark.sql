-- Events table for calendar integration
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('wedding', 'portrait', 'corporate', 'event', 'graduation', 'other')),
  event_date DATE NOT NULL,
  event_time TIME,
  end_time TIME,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews table for client feedback
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  gallery_id UUID REFERENCES galleries(id) ON DELETE SET NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review_text TEXT,
  review_source TEXT DEFAULT 'web' CHECK (review_source IN ('web', 'sms', 'whatsapp', 'ussd')),
  is_public BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watermark settings table
CREATE TABLE IF NOT EXISTS watermark_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  watermark_text TEXT,
  watermark_position TEXT DEFAULT 'bottomRight' CHECK (watermark_position IN ('center', 'bottomRight', 'bottomLeft', 'topRight', 'topLeft', 'tiled')),
  watermark_opacity DECIMAL(3,2) DEFAULT 0.30,
  watermark_rotation INT DEFAULT 0,
  watermark_scale DECIMAL(3,2) DEFAULT 1.00,
  watermark_color TEXT DEFAULT '#FFFFFF',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event reminders table
CREATE TABLE IF NOT EXISTS event_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('sms', 'whatsapp', 'email', 'push')),
  reminder_date TIMESTAMPTZ NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_photographer ON events(photographer_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_reviews_photographer ON reviews(photographer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_gallery ON reviews(gallery_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_watermark_photographer ON watermark_settings(photographer_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_event ON event_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_status ON event_reminders(status);

-- RLS policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE watermark_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Photographers can view their own events" ON events
  FOR SELECT USING (auth.uid() = photographer_id);

CREATE POLICY "Photographers can create their own events" ON events
  FOR INSERT WITH CHECK (auth.uid() = photographer_id);

CREATE POLICY "Photographers can update their own events" ON events
  FOR UPDATE USING (auth.uid() = photographer_id);

CREATE POLICY "Photographers can delete their own events" ON events
  FOR DELETE USING (auth.uid() = photographer_id);

-- Reviews policies
CREATE POLICY "Anyone can view public reviews" ON reviews
  FOR SELECT USING (is_public = true);

CREATE POLICY "Photographers can view their own reviews" ON reviews
  FOR SELECT USING (auth.uid() = photographer_id);

CREATE POLICY "Clients can create reviews" ON reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Photographers can update their own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = photographer_id);

-- Watermark settings policies
CREATE POLICY "Photographers can view their own watermark settings" ON watermark_settings
  FOR SELECT USING (auth.uid() = photographer_id);

CREATE POLICY "Photographers can create their own watermark settings" ON watermark_settings
  FOR INSERT WITH CHECK (auth.uid() = photographer_id);

CREATE POLICY "Photographers can update their own watermark settings" ON watermark_settings
  FOR UPDATE USING (auth.uid() = photographer_id);

-- Event reminders policies
CREATE POLICY "Photographers can view reminders for their events" ON event_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = event_reminders.event_id 
      AND events.photographer_id = auth.uid()
    )
  );

CREATE POLICY "System can create reminders" ON event_reminders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update reminders" ON event_reminders
  FOR UPDATE USING (true);

-- Functions

-- Function to get event stats
CREATE OR REPLACE FUNCTION get_event_stats(p_photographer_id UUID)
RETURNS TABLE (
  total_events BIGINT,
  upcoming_events BIGINT,
  completed_events BIGINT,
  this_month_events BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE event_date >= CURRENT_DATE AND status = 'scheduled') as upcoming_events,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_events,
    COUNT(*) FILTER (WHERE event_date >= date_trunc('month', CURRENT_DATE) 
                      AND event_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month') as this_month_events
  FROM events
  WHERE photographer_id = p_photographer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get review stats
CREATE OR REPLACE FUNCTION get_review_stats(p_photographer_id UUID)
RETURNS TABLE (
  total_reviews BIGINT,
  average_rating DECIMAL(3,2),
  five_star_count BIGINT,
  four_star_count BIGINT,
  three_star_count BIGINT,
  two_star_count BIGINT,
  one_star_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_reviews,
    COALESCE(AVG(rating), 0)::DECIMAL(3,2) as average_rating,
    COUNT(*) FILTER (WHERE rating = 5) as five_star_count,
    COUNT(*) FILTER (WHERE rating = 4) as four_star_count,
    COUNT(*) FILTER (WHERE rating = 3) as three_star_count,
    COUNT(*) FILTER (WHERE rating = 2) as two_star_count,
    COUNT(*) FILTER (WHERE rating = 1) as one_star_count
  FROM reviews
  WHERE photographer_id = p_photographer_id AND is_verified = true;
END;
$$ LANGUAGE plpgsql;

-- Function to get calendar events for a month
CREATE OR REPLACE FUNCTION get_calendar_events(
  p_photographer_id UUID,
  p_year INT,
  p_month INT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  event_type TEXT,
  event_date DATE,
  event_time TIME,
  location TEXT,
  status TEXT,
  client_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.event_type,
    e.event_date,
    e.event_time,
    e.location,
    e.status,
    c.name as client_name
  FROM events e
  LEFT JOIN clients c ON e.client_id = c.id
  WHERE e.photographer_id = p_photographer_id
    AND EXTRACT(YEAR FROM e.event_date) = p_year
    AND EXTRACT(MONTH FROM e.event_date) = p_month
  ORDER BY e.event_date, e.event_time;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watermark_settings_updated_at
  BEFORE UPDATE ON watermark_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
