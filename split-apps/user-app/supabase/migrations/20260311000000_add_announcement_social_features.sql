-- Migration: Add Announcement Social Features
-- Note: These tables and policies are already in master_spec.sql
-- This migration is kept for consistency but most operations are skipped

-- Enable RLS on announcements table
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
