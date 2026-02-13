import * as SMS from 'expo-sms';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

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
}

export const SMSService = {
  /**
   * Check if SMS is available on the device
   */
  isAvailable: async () => {
    return await SMS.isAvailableAsync();
  },

  /**
   * Send SMS using the device's native SMS capability
   */
  send: async ({ phoneNumber, message, clientId }: SendSMSParams) => {
    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('SMS is not available on this device');
      }

      const { result } = await SMS.sendSMSAsync(
        [phoneNumber],
        message
      );

      // Log the attempt
      // Note: result can be 'sent', 'cancelled', 'unknown'
      const status = result === 'sent' ? 'sent' : result === 'cancelled' ? 'failed' : 'pending';
      
      await SMSService.logs.create({
        phone_number: phoneNumber,
        message_body: message,
        status: status,
        client_id: clientId,
        error_message: result === 'cancelled' ? 'User cancelled' : null,
        sent_at: result === 'sent' ? new Date().toISOString() : null
      });

      return result;
    } catch (error: any) {
      // Log failure
      await SMSService.logs.create({
        phone_number: phoneNumber,
        message_body: message,
        status: 'failed',
        client_id: clientId,
        error_message: error.message || 'Unknown error',
      });
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
        .eq('admin_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SMSLogWithClient[] | null;
    },

    create: async (log: Omit<SMSLogInsert, 'admin_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // Can't log if not auth

      const { error } = await supabase
        .from('sms_logs')
        .insert({
          ...log,
          admin_id: user.id,
        });

      if (error) console.error('Failed to create SMS log:', error);
    }
  },

  templates: {
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('admin_id', user.id)
        .order('name');

      if (error) throw error;
      return data;
    },

    create: async (template: Omit<SMSTemplateInsert, 'admin_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('sms_templates')
        .insert({
          ...template,
          admin_id: user.id
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
      gallery_link?: string;
      studio_name?: string;
      event_date?: string;
    }) => {
      let compiled = template;
      compiled = compiled.replace(/{client_name}/g, data.client_name || '');
      compiled = compiled.replace(/{access_code}/g, data.access_code || '');
      compiled = compiled.replace(/{gallery_link}/g, data.gallery_link || '');
      compiled = compiled.replace(/{studio_name}/g, data.studio_name || '');
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
        .select('access_code, id')
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
  }
};
