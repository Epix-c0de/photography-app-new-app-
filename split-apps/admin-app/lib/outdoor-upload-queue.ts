import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const QUEUE_KEY = 'outdoor_client_queue_v2';

export interface QueuedClient {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  queuedAt: number;
  synced: boolean;
}

/**
 * Save a client's info to the local queue (for field/offline use).
 * When online, call syncClients() to push them to Supabase.
 */
export async function queueClient(client: Omit<QueuedClient, 'id' | 'queuedAt' | 'synced'>): Promise<string> {
  const id = `oc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const queued: QueuedClient = {
    ...client,
    id,
    queuedAt: Date.now(),
    synced: false,
  };

  const existing = await getPendingClients();
  existing.push(queued);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));

  console.log(`[OutdoorQueue] Queued client "${client.name}" (${client.phone})`);
  return id;
}

/**
 * Get all pending (unsynced) clients
 */
export async function getPendingClients(): Promise<QueuedClient[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const all: QueuedClient[] = JSON.parse(raw);
    return all.filter(c => !c.synced);
  } catch {
    return [];
  }
}

/**
 * Get count of pending clients
 */
export async function getPendingClientCount(): Promise<number> {
  const pending = await getPendingClients();
  return pending.length;
}

/**
 * Sync pending clients to the database.
 * Returns { synced: number, failed: number }.
 */
export async function syncClients(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingClients();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { synced: 0, failed: pending.length };

  let synced = 0;
  let failed = 0;

  for (const client of pending) {
    try {
      // Check if client already exists by phone + admin
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_admin_id', user.id)
        .eq('phone', client.phone)
        .maybeSingle();

      if (existing) {
        // Already synced, just mark local
        await markClientSynced(client.id);
        synced++;
        continue;
      }

      const { error } = await supabase
        .from('clients')
        .insert({
          owner_admin_id: user.id,
          name: client.name,
          phone: client.phone,
          email: client.email || null,
          notes: client.notes || null,
        });

      if (error) throw error;
      await markClientSynced(client.id);
      synced++;
    } catch (e) {
      console.error(`[OutdoorQueue] Failed to sync client "${client.name}":`, e);
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Mark a client as synced
 */
export async function markClientSynced(clientId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const all: QueuedClient[] = JSON.parse(raw);
  const updated = all.map(c => c.id === clientId ? { ...c, synced: true } : c);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

/**
 * Remove a client from the queue
 */
export async function removeClient(clientId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const all: QueuedClient[] = JSON.parse(raw);
  const updated = all.filter(c => c.id !== clientId);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

/**
 * Clear all synced clients from the queue
 */
export async function clearSyncedClients(): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const all: QueuedClient[] = JSON.parse(raw);
  const unsynced = all.filter(c => !c.synced);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(unsynced));
}
