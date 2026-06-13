-- Add photographer_signup_url to platform_settings
-- This URL is shown to unassigned clients as a "refer your photographer" link
INSERT INTO platform_settings (key, value)
VALUES ('platform_photographer_signup_url', 'https://join.epixvisuals.co')
ON CONFLICT (key) DO NOTHING;
