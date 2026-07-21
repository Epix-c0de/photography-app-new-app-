-- Event clients junction table for batch client selection on calendar events
-- Also adds is_busy column to block dates for other bookings

-- 1. Create event_clients junction table
CREATE TABLE IF NOT EXISTS public.event_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notified boolean DEFAULT false,
  reminder_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, client_id)
);

ALTER TABLE public.event_clients ENABLE ROW LEVEL SECURITY;

-- Admins can manage event_clients for their events
CREATE POLICY "Admins manage event_clients" ON public.event_clients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events WHERE events.id = event_clients.event_id AND events.photographer_id = auth.uid()
    )
  );

-- Clients can view their event assignments
CREATE POLICY "Clients view own event assignments" ON public.event_clients
  FOR SELECT USING (client_id = auth.uid());

-- 2. Add is_busy column to events table to block dates
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_busy boolean DEFAULT true;

-- 3. Add reminder columns
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reminder_date timestamptz;

-- 4. Index for busy date checks
CREATE INDEX IF NOT EXISTS idx_events_date_busy ON public.events(event_date, status) WHERE status = 'scheduled';

-- 5. Index for event_clients lookups
CREATE INDEX IF NOT EXISTS idx_event_clients_client ON public.event_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_event_clients_event ON public.event_clients(event_id);

-- 6. Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
