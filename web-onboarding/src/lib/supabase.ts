import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gghqurnamjdxoriuuopf.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnaHF1cm5hbWpkeG9yaXV1b3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTI4MDEsImV4cCI6MjA5MTkyODgwMX0.VXEMNxA70znWq0dVK3hEkWhG8u5JVu0Z3-xLM3qQYuc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side only — never import this in client components
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
