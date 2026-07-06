-- Receipt customization settings
CREATE TABLE IF NOT EXISTS receipt_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photographer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Branding
  business_name TEXT DEFAULT 'Epix Visuals',
  business_tagline TEXT DEFAULT 'Professional Photography',
  logo_url TEXT,
  
  -- Contact info
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  
  -- M-Pesa / Payment details
  till_number TEXT,
  paybill_number TEXT,
  business_short_code TEXT,
  
  -- Receipt styling
  primary_color TEXT DEFAULT '#d4af37',
  secondary_color TEXT DEFAULT '#1a1a1a',
  footer_text TEXT DEFAULT 'Thank you for your payment!',
  terms_and_conditions TEXT,
  
  -- Receipt options
  show_qr_code BOOLEAN DEFAULT true,
  show_logo BOOLEAN DEFAULT true,
  show_tax BOOLEAN DEFAULT false,
  tax_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Template
  template TEXT DEFAULT 'standard' CHECK (template IN ('standard', 'minimal', 'detailed', 'branded')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(photographer_id)
);

-- RLS policies
ALTER TABLE receipt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photographers manage own receipt settings" ON receipt_settings
  FOR ALL USING (auth.uid() = photographer_id);

-- Function to get or create receipt settings
CREATE OR REPLACE FUNCTION get_receipt_settings(p_photographer_id UUID)
RETURNS receipt_settings AS $$
DECLARE
  v_settings receipt_settings;
BEGIN
  SELECT * INTO v_settings
  FROM receipt_settings
  WHERE photographer_id = p_photographer_id;
  
  IF NOT FOUND THEN
    INSERT INTO receipt_settings (photographer_id, business_name)
    VALUES (p_photographer_id, 'Epix Visuals')
    RETURNING * INTO v_settings;
  END IF;
  
  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update receipt settings
CREATE OR REPLACE FUNCTION update_receipt_settings(
  p_photographer_id UUID,
  p_business_name TEXT DEFAULT NULL,
  p_business_tagline TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_till_number TEXT DEFAULT NULL,
  p_paybill_number TEXT DEFAULT NULL,
  p_business_short_code TEXT DEFAULT NULL,
  p_primary_color TEXT DEFAULT NULL,
  p_secondary_color TEXT DEFAULT NULL,
  p_footer_text TEXT DEFAULT NULL,
  p_terms_and_conditions TEXT DEFAULT NULL,
  p_show_qr_code BOOLEAN DEFAULT NULL,
  p_show_logo BOOLEAN DEFAULT NULL,
  p_show_tax BOOLEAN DEFAULT NULL,
  p_tax_percent DECIMAL DEFAULT NULL,
  p_template TEXT DEFAULT NULL
)
RETURNS receipt_settings AS $$
DECLARE
  v_settings receipt_settings;
BEGIN
  INSERT INTO receipt_settings (photographer_id, business_name)
  VALUES (p_photographer_id, 'Epix Visuals')
  ON CONFLICT (photographer_id) DO NOTHING;
  
  UPDATE receipt_settings SET
    business_name = COALESCE(p_business_name, business_name),
    business_tagline = COALESCE(p_business_tagline, business_tagline),
    logo_url = COALESCE(p_logo_url, logo_url),
    phone = COALESCE(p_phone, phone),
    email = COALESCE(p_email, email),
    address = COALESCE(p_address, address),
    website = COALESCE(p_website, website),
    till_number = COALESCE(p_till_number, till_number),
    paybill_number = COALESCE(p_paybill_number, paybill_number),
    business_short_code = COALESCE(p_business_short_code, business_short_code),
    primary_color = COALESCE(p_primary_color, primary_color),
    secondary_color = COALESCE(p_secondary_color, secondary_color),
    footer_text = COALESCE(p_footer_text, footer_text),
    terms_and_conditions = COALESCE(p_terms_and_conditions, terms_and_conditions),
    show_qr_code = COALESCE(p_show_qr_code, show_qr_code),
    show_logo = COALESCE(p_show_logo, show_logo),
    show_tax = COALESCE(p_show_tax, show_tax),
    tax_percent = COALESCE(p_tax_percent, tax_percent),
    template = COALESCE(p_template, template),
    updated_at = NOW()
  WHERE photographer_id = p_photographer_id
  RETURNING * INTO v_settings;
  
  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;