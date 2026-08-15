import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { logger } from '../utils/logger';

let supabase: SupabaseClient;

export function initSupabase(): SupabaseClient {
  if (supabase) return supabase;

  supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  logger.info('Supabase client initialized');
  return supabase;
}

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    return initSupabase();
  }
  return supabase;
}
