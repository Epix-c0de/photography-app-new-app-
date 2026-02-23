import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { LocalSmsGateway } from '@lenzart/local-sms-gateway';

export type SMSLog = Database['public']['Tables']['sms_logs']['Row'];
export type SMSLogWithClient = SMSLog & { clients: { name: string } | null };
export type SMSTemplate = Database['public']['Tables']['sms_templates']['Row'];
export type SMSDraft = Database['public']['Tables']['sms_drafts']['Row'];

type SMSLogInsert = Database['public']['Tables']['sms_logs']['Insert'];
type SMSTemplateInsert = Database['public']['Tables']['sms_templates']['Insert'];

export interface SendSMSParams {
  phoneNumber: string;
  message: string;
  clientId?: string;
  subscriptionId?: number | null;
}

type LocalQueueItem = {
  id: string;
  phone_number: string;
  message: string;
  client_id: string | null;
  created_at: string;
  attempt_count: number;
  next_attempt_at: string;
  send_status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  last_error: string | null;
  needs_record: boolean;
};

const QUEUE_KEY = 'sms_queue_v1';
const MIN_SEND_INTERVAL_MS = 2100;

function nowIso() {
  return new Date().toISOString();
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

async function loadQueue(): Promise<LocalQueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LocalQueueItem[];
  } catch {
    return [];
  }
}

async function saveQueue(items: LocalQueueItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function shouldTryNow(item: LocalQueueItem) {
  return new Date(item.next_attempt_at).getTime() <= Date.now();
}

export const SMSService = {
  /**
   * Check if SMS is available on the device
   */
  isAvailable: async () => {
    if (Platform.OS === 'android') {
      try {
        const status = await LocalSmsGateway.getStatus();
        return status.sendSmsPermission === 'granted';
      } catch {
        return await SMS.isAvailableAsync();
      }
    }
    return await SMS.isAvailableAsync();
  },

  /**
   * Send SMS using the device's native SMS capability
   */
  send: async ({ phoneNumber, message, clientId, subscriptionId }: SendSMSParams): Promise<'sent' | 'queued' | 'failed'> => {
    try {
      const pn = normalizePhone(phoneNumber);
      const msg = message.trim();
      if (!pn || !msg) throw new Error('Missing phone number or message');

      if (Platform.OS === 'android') {
        const sendResult = await LocalSmsGateway.sendSms({ phoneNumber: pn, message: msg, subscriptionId: subscriptionId ?? null });
        if (sendResult.status === 'sent') {
          await SMSService.logs.record({
            phone_number: pn,
            message: msg,
            client_id: clientId ?? null,
            status: 'sent',
            sent_at: sendResult.sentAt,
            error_message: null,
          });
          return 'sent';
        }

        const errorCode = sendResult.status === 'failed' ? sendResult.errorCode : sendResult.errorCode;
        const errorMessage = sendResult.status === 'failed' ? sendResult.errorMessage : sendResult.errorMessage;

        if (errorCode === 'NO_SERVICE' || errorCode === 'RADIO_OFF') {
          await SMSService.queue.enqueue({
            phone_number: pn,
            message: msg,
            client_id: clientId ?? null,
            last_error: `${errorCode}: ${errorMessage}`,
          });
          await SMSService.logs.record({
            phone_number: pn,
            message: msg,
            client_id: clientId ?? null,
            status: 'queued',
            sent_at: null,
            error_message: `${errorCode}: ${errorMessage}`,
          });
          return 'queued';
        }

        await SMSService.logs.record({
          phone_number: pn,
          message: msg,
          client_id: clientId ?? null,
          status: 'failed',
          sent_at: null,
          error_message: `${errorCode}: ${errorMessage}`,
        });
        return 'failed';
      }

      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) throw new Error('SMS is not available on this device');
      const { result } = await SMS.sendSMSAsync([pn], msg);
      if (result === 'sent') {
        await SMSService.logs.record({
          phone_number: pn,
          message: msg,
          client_id: clientId ?? null,
          status: 'sent',
          sent_at: nowIso(),
          error_message: null,
        });
        return 'sent';
      }
      if (result === 'cancelled') {
        await SMSService.logs.record({
          phone_number: pn,
          message: msg,
          client_id: clientId ?? null,
          status: 'failed',
          sent_at: null,
          error_message: 'User cancelled',
        });
        return 'failed';
      }
      await SMSService.logs.record({
        phone_number: pn,
        message: msg,
        client_id: clientId ?? null,
        status: 'queued',
        sent_at: null,
        error_message: 'Unknown result',
      });
      return 'queued';
    } catch (error: any) {
      throw error;
    }
  },

  logs: {
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sms_logs')
        .select(`
          *,
          clients (
            name
          )
        `)
        .eq('owner_admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SMSLogWithClient[] | null;
    },

    record: async (log: { phone_number: string; message: string; client_id: string | null; status: 'queued' | 'sent' | 'failed'; sent_at: string | null; error_message: string | null }) => {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await SMSService.queue.enqueueRecord(log);
        return;
      }

      const { error } = await supabase.functions.invoke('sms-record', { body: log });
      if (error) {
        await SMSService.queue.enqueueRecord(log);
      }
    }
  },

  templates: {
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('owner_admin_id', user.id)
        .order('name');

      if (error) throw error;
      return data;
    },

    create: async (template: Omit<SMSTemplateInsert, 'owner_admin_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sms_templates')
        .insert({
          ...template,
          owner_admin_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    update: async (id: string, updates: Partial<SMSTemplate>) => {
      const { error } = await supabase
        .from('sms_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },

    delete: async (id: string) => {
      const { error } = await supabase
        .from('sms_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }
  },

  utils: {
    /**
     * Replaces placeholders in the template with actual values
     */
    compileTemplate: (template: string, data: {
      client_name?: string;
      access_code?: string;
      gallery_name?: string;
      app_link?: string;
      business_name?: string;
      event_date?: string;
    }) => {
      let compiled = template;
      compiled = compiled.replace(/{client_name}/g, data.client_name || '');
      compiled = compiled.replace(/{access_code}/g, data.access_code || '');
      compiled = compiled.replace(/{gallery_name}/g, data.gallery_name || '');
      compiled = compiled.replace(/{app_link}/g, data.app_link || '');
      compiled = compiled.replace(/{business_name}/g, data.business_name || '');
      compiled = compiled.replace(/{event_date}/g, data.event_date || '');
      return compiled;
    },

    /**
     * Fetch client details along with their latest gallery access code
     */
    getClientDetails: async (clientId: string) => {
       const { data: client, error: cError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (cError) throw cError;

      // Fetch latest gallery for access code
      const { data: gallery, error: gError } = await supabase
        .from('galleries')
        .select('access_code, id, name')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // It's okay if no gallery exists yet
      return {
        client,
        gallery: gallery || null
      };
    }
  },

  queue: {
    enqueue: async (params: { phone_number: string; message: string; client_id: string | null; last_error: string | null }) => {
      const items = await loadQueue();
      const id = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      const created = nowIso();
      const next = nowIso();
      items.unshift({
        id,
        phone_number: params.phone_number,
        message: params.message,
        client_id: params.client_id,
        created_at: created,
        attempt_count: 0,
        next_attempt_at: next,
        send_status: 'pending',
        sent_at: null,
        last_error: params.last_error,
        needs_record: true,
      });
      await saveQueue(items);
    },

    enqueueRecord: async (log: { phone_number: string; message: string; client_id: string | null; status: 'queued' | 'sent' | 'failed'; sent_at: string | null; error_message: string | null }) => {
      const items = await loadQueue();
      const id = `record_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      items.unshift({
        id,
        phone_number: log.phone_number,
        message: log.message,
        client_id: log.client_id,
        created_at: nowIso(),
        attempt_count: 0,
        next_attempt_at: nowIso(),
        send_status: log.status === 'sent' ? 'sent' : log.status === 'failed' ? 'failed' : 'pending',
        sent_at: log.sent_at,
        last_error: log.error_message,
        needs_record: true,
      });
      await saveQueue(items);
    },

    processNow: async () => {
      const items = await loadQueue();
      if (items.length === 0) return { processed: 0, remaining: 0 };

      const net = await NetInfo.fetch();
      const canRecord = !!net.isConnected;

      let processed = 0;
      let lastSendAt = 0;
      const updated: LocalQueueItem[] = [];

      for (const item of items) {
        if (!shouldTryNow(item)) {
          updated.push(item);
          continue;
        }

        if (item.send_status === 'pending' && Platform.OS === 'android') {
          const now = Date.now();
          const waitMs = Math.max(0, MIN_SEND_INTERVAL_MS - (now - lastSendAt));
          if (waitMs > 0) {
            updated.push(item);
            continue;
          }

          try {
            const sendResult = await LocalSmsGateway.sendSms({ phoneNumber: item.phone_number, message: item.message, subscriptionId: null });
            lastSendAt = Date.now();

            if (sendResult.status === 'sent') {
              item.send_status = 'sent';
              item.sent_at = sendResult.sentAt;
              item.last_error = null;
              item.needs_record = true;
            } else {
              item.attempt_count += 1;
              item.last_error = `${sendResult.errorCode}: ${sendResult.errorMessage}`;
              const delayMs = Math.min(5 * 60 * 1000, 10_000 * item.attempt_count);
              item.next_attempt_at = new Date(Date.now() + delayMs).toISOString();
            }
          } catch (e: any) {
            item.attempt_count += 1;
            item.last_error = e?.message ?? 'Failed to send';
            const delayMs = Math.min(5 * 60 * 1000, 10_000 * item.attempt_count);
            item.next_attempt_at = new Date(Date.now() + delayMs).toISOString();
          }
        }

        if (item.needs_record && canRecord) {
          const recordBody = {
            phone_number: item.phone_number,
            message: item.message,
            client_id: item.client_id,
            status: item.send_status === 'sent' ? 'sent' : item.send_status === 'failed' ? 'failed' : 'queued',
            sent_at: item.send_status === 'sent' ? item.sent_at : null,
            error_message: item.last_error,
          } as const;

          const { error } = await supabase.functions.invoke('sms-record', { body: recordBody });
          if (!error) {
            item.needs_record = false;
          } else {
            item.attempt_count += 1;
            const delayMs = Math.min(5 * 60 * 1000, 10_000 * item.attempt_count);
            item.next_attempt_at = new Date(Date.now() + delayMs).toISOString();
          }
        }

        if (!item.needs_record && item.send_status !== 'pending') {
          processed += 1;
          continue;
        }

        updated.push(item);
      }

      await saveQueue(updated);
      return { processed, remaining: updated.length };
    },
  },
};
