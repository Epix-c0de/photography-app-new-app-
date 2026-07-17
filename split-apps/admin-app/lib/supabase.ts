import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '../types/supabase';

// Fallback to hardcoded values if env vars fail to load in web preview
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ujunohfpcmjywsblsoel.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqdW5vaGZwY21qeXdzYmxzb2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDk5NzYsImV4cCI6MjA4NjIyNTk3Nn0.w4bhLUjaAXhB8B1sujLJWIG5-TokDPuEIInFeLm5EMg';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

// Custom fetch that strips Cloudflare _cf_bm cookie to prevent domain rejection
const SupabaseFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);
  const cookie = headers.get('Cookie') || headers.get('cookie');
  if (cookie && cookie.includes('_cf_bm')) {
    const cleaned = cookie.split(';').filter(c => !c.trim().startsWith('_cf_bm')).join(';');
    if (cleaned.trim()) {
      headers.set('Cookie', cleaned);
    } else {
      headers.delete('Cookie');
      headers.delete('cookie');
    }
  }
  return fetch(input, { ...init, headers });
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    fetch: SupabaseFetch,
  },
});
