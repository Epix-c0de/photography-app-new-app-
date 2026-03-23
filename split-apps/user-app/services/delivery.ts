import { supabase, supabaseUrl } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';
import { Database } from '@/types/supabase';

type DeliveryGateway = Database['public']['Tables']['delivery_gateways']['Row'];
type DeliveryLog = Database['public']['Tables']['delivery_logs']['Row'];
type AccessCode = Database['public']['Tables']['access_codes']['Row'];

export const DeliveryService = {
  // --- Access Code Management ---

  /**
   * Generates a cryptographically secure 6-digit access code, hashes it, and stores it.
   * Returns the plain text code for delivery.
   */
  async generateAccessCode(clientId: string, expiresInMinutes = 60): Promise<string> {
    // Generate 6-digit code
    const randomBytes = await Crypto.getRandomBytesAsync(4);
    const code = (Math.abs(new Int32Array(randomBytes.buffer)[0]) % 1000000).toString().padStart(6, '0');
    
    // Hash the code
    const codeHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      code
    );

    const expiresAt = new Date(Date.now() + expiresInMinutes * 60000).toISOString();

    // Invalidate old active codes
    await supabase
      .from('access_codes')
      .update({ status: 'expired' })
      .eq('client_id', clientId)
      .eq('status', 'active');

    // Store new code
    const { error } = await supabase
      .from('access_codes')
      .insert({
        client_id: clientId,
        code_hash: codeHash,
        expires_at: expiresAt,
        status: 'active'
      });

    if (error) throw error;

    return code;
  },

  /**
   * Verifies an access code for a client.
   */
  async verifyAccessCode(clientId: string, code: string): Promise<boolean> {
    const codeHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      code
    );

    const { data, error } = await supabase
      .from('access_codes')
      .select('*')
      .eq('client_id', clientId)
      .eq('code_hash', codeHash)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return false;

    // Mark as used
    await supabase
      .from('access_codes')
      .update({ status: 'used' })
      .eq('id', data.id);

    return true;
  },

  // --- Delivery System ---

  async checkRateLimit(recipient: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count } = await supabase
      .from('delivery_logs')
      .select('*', { count: 'exact', head: true })
      .eq('recipient', recipient)
      .gte('created_at', oneHourAgo);
      
    return (count || 0) < 5;
  },

  /**
   * Sends an access code to a client via SMS (with WhatsApp fallback).
   */
  async sendAccessCode(clientId: string, phone: string): Promise<{ success: boolean; method: string; error?: any }> {
    try {
      // 0. Check Rate Limit
      const withinLimit = await this.checkRateLimit(phone);
      if (!withinLimit) throw new Error('Rate limit exceeded (5 codes/hour)');

      // 1. Check credits
      const hasCredits = await this.checkCredits();
      if (!hasCredits) throw new Error('Insufficient delivery credits');

      // 2. Generate Code
      const code = await this.generateAccessCode(clientId);
      const message = `Your access code is: ${code}. Valid for 60 minutes.`;

      // 3. Dispatch
      return await this.dispatchMessage(phone, message);
    } catch (error) {
      console.error('Failed to send access code:', error);
      return { success: false, method: 'none', error };
    }
  },

  /**
   * Dispatches a message using available gateways with fallback logic.
   */
  async dispatchMessage(recipient: string, message: string): Promise<{ success: boolean; method: string }> {
    // Get active gateways sorted by priority
    const { data: gateways } = await supabase
      .from('delivery_gateways')
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false });

    if (!gateways || gateways.length === 0) {
      throw new Error('No active delivery gateways found');
    }

    // Try SMS gateways first
    const smsGateways = gateways.filter(g => g.type !== 'whatsapp_cloud');
    for (const gateway of smsGateways) {
      try {
        await this.sendViaGateway(gateway, recipient, message);
        return { success: true, method: 'sms' };
      } catch (e) {
        console.warn(`Gateway ${gateway.name} failed:`, e);
        continue; // Try next gateway
      }
    }

    // Fallback to WhatsApp
    const whatsappGateways = gateways.filter(g => g.type === 'whatsapp_cloud');
    for (const gateway of whatsappGateways) {
      try {
        await this.sendViaGateway(gateway, recipient, message);
        return { success: true, method: 'whatsapp' };
      } catch (e) {
        console.warn(`WhatsApp Gateway ${gateway.name} failed:`, e);
      }
    }

    throw new Error('All delivery attempts failed');
  },

  /**
   * Low-level send function for a specific gateway.
   */
  async sendViaGateway(gateway: DeliveryGateway, recipient: string, message: string) {
    // Create pending log
    const { data: log, error: logError } = await supabase
      .from('delivery_logs')
      .insert({
        recipient,
        message_type: gateway.type === 'whatsapp_cloud' ? 'whatsapp' : 'sms',
        gateway_id: gateway.id,
        status: 'pending',
        attempts: 1,
        cost: gateway.cost_per_msg
      })
      .select()
      .single();

    if (logError) throw logError;

    try {
      let response;
      let externalId = null;
      const config = gateway.config as any;

      if (gateway.type === 'http' || gateway.type === 'local_modem') {
        // Generic HTTP Gateway (e.g., Kannel, Android Gateway)
        response = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.headers || {})
          },
          body: JSON.stringify({
            to: recipient,
            message: message,
            api_key: config.api_key,
            callback_url: `${supabaseUrl}/functions/v1/delivery-callback` // Send callback URL if supported
          })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        
        // Try to parse external ID if JSON
        try {
          const json = await response.json();
          externalId = json.id || json.message_id || json.uuid || null;
        } catch (e) {
          // Ignore if not JSON
        }

      } else if (gateway.type === 'whatsapp_cloud') {
        // WhatsApp Cloud API
        response = await fetch(`https://graph.facebook.com/v17.0/${config.phone_number_id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'text',
            text: { body: message }
          })
        });

        if (!response.ok) throw new Error(`WhatsApp API Error: ${await response.text()}`);
        
        const json = await response.json();
        externalId = json.messages?.[0]?.id || null;
      } else {
        throw new Error(`Unsupported gateway type: ${gateway.type}`);
      }

      // Update log to sent with external ID
      await supabase
        .from('delivery_logs')
        .update({ 
          status: 'sent', 
          external_id: externalId,
          updated_at: new Date().toISOString() 
        })
        .eq('id', log.id);

    } catch (error: any) {
      // Update log to failed
      await supabase
        .from('delivery_logs')
        .update({
          status: 'failed',
          error_message: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', log.id);
      
      throw error;
    }
  },

  // --- Credits & Monitoring ---

  async checkCredits(): Promise<boolean> {
    const { data, error } = await supabase
      .from('delivery_credits')
      .select('balance, critical_threshold, auto_refill_enabled, auto_refill_amount')
      .single();

    if (error) return false; // Fail safe

    if (data.balance <= data.critical_threshold) {
      if (data.auto_refill_enabled) {
        await this.refillCredits(data.auto_refill_amount);
        return true;
      }
      return false;
    }

    return true;
  },

  async refillCredits(amount: number) {
    // Mock Payment Gateway Integration (Stripe/PayPal)
    // In a real app, this would call a server-side function to process payment
    
    const { data: current } = await supabase.from('delivery_credits').select('balance, id').single();
    if (!current) return;

    await supabase
      .from('delivery_credits')
      .update({ balance: current.balance + amount })
      .eq('id', current.id);
      
    // Log transaction (mock)
    // await supabase.from('transactions').insert({...})
  },

  async getStats(): Promise<{ sent: number; failed: number; balance: number; successRate: string }> {
    const { count: sentCount } = await supabase
      .from('delivery_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');

    const { count: failedCount } = await supabase
      .from('delivery_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    const { data: credits } = await supabase
      .from('delivery_credits')
      .select('*')
      .single();

    return {
      sent: sentCount || 0,
      failed: failedCount || 0,
      balance: credits?.balance || 0,
      successRate: sentCount && (sentCount + (failedCount || 0)) > 0 
        ? (sentCount / (sentCount + (failedCount || 0)) * 100).toFixed(1) 
        : '100'
    };
  }
};
