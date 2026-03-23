-- Run this in your Supabase SQL Editor to manually confirm all unconfirmed users
-- This is useful for development/testing if you want to bypass email verification

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;
