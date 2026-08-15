-- WhatsApp Bot Database Schema
-- Run this in your Supabase SQL editor

-- Bot Logs Table
CREATE TABLE IF NOT EXISTS bot_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_number TEXT NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  intent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for bot_logs
CREATE INDEX IF NOT EXISTS idx_bot_logs_sender ON bot_logs(sender_number);
CREATE INDEX IF NOT EXISTS idx_bot_logs_created_at ON bot_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_logs_intent ON bot_logs(intent);

-- Conversations Table (for tracking state)
CREATE TABLE IF NOT EXISTS bot_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id),
  last_command TEXT,
  context JSONB DEFAULT '{}',
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for conversations
CREATE INDEX IF NOT EXISTS idx_bot_conversations_phone ON bot_conversations(phone_number);

-- Broadcast Messages Table
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for support tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_client ON support_tickets(client_id);

-- WhatsApp Contacts Table (cached profiles)
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  name TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for contacts
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts(phone_number);

-- Enable RLS (Row Level Security)
ALTER TABLE bot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role has full access)
-- Bot service uses service_role key, so it bypasses RLS
-- These policies are for admin dashboard access

CREATE POLICY "Admin can view bot logs" ON bot_logs
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Admin can view conversations" ON bot_conversations
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Admin can manage broadcasts" ON broadcasts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admin can manage support tickets" ON support_tickets
  FOR ALL USING (auth.role() = 'service_role');
