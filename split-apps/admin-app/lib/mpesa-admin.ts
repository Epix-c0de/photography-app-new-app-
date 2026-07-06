/**
 * M-Pesa Admin Service
 *
 * CRUD operations for payment gateways with encrypted field handling.
 * All gateway GET responses mask secrets - never return plaintext.
 *
 * CRITICAL: Secrets are encrypted before storage and decrypted only
 * when needed for API calls. Never log or return decrypted values.
 */

import { supabase } from './supabase';
import {
  encrypt,
  decrypt,
  maskSecret,
  maskGatewaySecrets,
  generateCallbackUrl,
  generateConfirmationUrl,
  generateValidationUrl,
} from './encryption';

export interface GatewayConfig {
  id?: string;
  client_id: string;
  gateway_type: 'till' | 'paybill';
  shortcode: string;
  account_reference?: string;
  consumer_key: string;
  consumer_secret: string;
  passkey: string;
  environment: 'sandbox' | 'production';
  callback_url: string;
  confirmation_url: string;
  validation_url: string;
  is_active: boolean;
  verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TestResult {
  success: boolean;
  latency_ms: number;
  error?: string;
}

export const GatewayAdminService = {
  /**
   * List all gateways for a client
   * Returns gateways with masked secrets
   */
  async list(clientId: string): Promise<GatewayConfig[]> {
    const { data, error } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Mask secrets before returning
    return (data || []).map((gw) => ({
      ...gw,
      consumer_key: maskSecret(gw.consumer_key),
      consumer_secret: maskSecret(gw.consumer_secret),
      passkey: maskSecret(gw.passkey),
    }));
  },

  /**
   * Get a single gateway by ID
   * Returns with masked secrets
   */
  async get(gatewayId: string): Promise<GatewayConfig | null> {
    const { data, error } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('id', gatewayId)
      .single();

    if (error || !data) return null;

    return {
      ...data,
      consumer_key: maskSecret(data.consumer_key),
      consumer_secret: maskSecret(data.consumer_secret),
      passkey: maskSecret(data.passkey),
    };
  },

  /**
   * Create or update a gateway configuration
   * Encrypts secrets before storage
   */
  async save(config: Omit<GatewayConfig, 'callback_url' | 'confirmation_url' | 'validation_url'>): Promise<GatewayConfig> {
    const clientId = config.client_id;

    // Generate auto-URLs
    const gatewayData = {
      ...config,
      callback_url: generateCallbackUrl(clientId),
      confirmation_url: generateConfirmationUrl(clientId),
      validation_url: generateValidationUrl(clientId),
      // Encrypt secrets before storage
      consumer_key: encrypt(config.consumer_key),
      consumer_secret: encrypt(config.consumer_secret),
      passkey: encrypt(config.passkey),
    };

    // If setting as active, deactivate other gateways first
    // (The database trigger also handles this, but we do it here for consistency)
    if (gatewayData.is_active) {
      await supabase
        .from('payment_gateways')
        .update({ is_active: false })
        .eq('client_id', clientId)
        .neq('id', config.id || '');
    }

    let result;

    if (config.id) {
      // Update existing gateway
      const { data, error } = await supabase
        .from('payment_gateways')
        .update(gatewayData)
        .eq('id', config.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new gateway
      const { data, error } = await supabase
        .from('payment_gateways')
        .insert(gatewayData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Auto-register C2B URLs for Paybill
    if (config.gateway_type === 'paybill' && result) {
      try {
        await supabase.functions.invoke('mpesa-c2b-register', {
          body: {
            gateway_id: result.id,
            shortcode: config.shortcode,
            consumer_key: config.consumer_key,
            consumer_secret: config.consumer_secret,
            environment: config.environment,
            validation_url: result.validation_url,
            confirmation_url: result.confirmation_url,
          },
        });
      } catch (e) {
        console.error('Failed to register C2B URLs:', e);
        // Don't fail the save - C2B registration can be retried later
      }
    }

    // Return with masked secrets
    return {
      ...result,
      consumer_key: maskSecret(result.consumer_key),
      consumer_secret: maskSecret(result.consumer_secret),
      passkey: maskSecret(result.passkey),
    };
  },

  /**
   * Test gateway connection
   * Calls mpesa-test-connection edge function
   */
  async testConnection(gatewayId: string): Promise<TestResult> {
    const gateway = await this.getDecrypted(gatewayId);
    if (!gateway) {
      return { success: false, latency_ms: 0, error: 'Gateway not found' };
    }

    try {
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('mpesa-test-connection', {
        body: {
          consumer_key: gateway.consumer_key,
          consumer_secret: gateway.consumer_secret,
          environment: gateway.environment,
        },
      });

      if (error) throw error;

      return {
        success: data.success,
        latency_ms: data.latency_ms || Date.now() - startTime,
      };
    } catch (e: any) {
      return {
        success: false,
        latency_ms: 0,
        error: e.message || 'Connection test failed',
      };
    }
  },

  /**
   * Mark a gateway as verified
   * Called after a successful test connection
   */
  async markVerified(gatewayId: string): Promise<void> {
    const { error } = await supabase
      .from('payment_gateways')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', gatewayId);

    if (error) throw error;
  },

  /**
   * Delete a gateway
   */
  async delete(gatewayId: string): Promise<void> {
    const { error } = await supabase
      .from('payment_gateways')
      .delete()
      .eq('id', gatewayId);

    if (error) throw error;
  },

  /**
   * Set a gateway as active (deactivates others for the same client)
   */
  async setActive(gatewayId: string): Promise<void> {
    const { error } = await supabase
      .from('payment_gateways')
      .update({ is_active: true })
      .eq('id', gatewayId);

    if (error) throw error;
  },

  /**
   * Get decrypted gateway config (for internal use only)
   * NEVER call this from client-facing code
   * @internal
   */
  async getDecrypted(gatewayId: string): Promise<{
    consumer_key: string;
    consumer_secret: string;
    passkey: string;
    environment: 'sandbox' | 'production';
    shortcode: string;
    gateway_type: 'till' | 'paybill';
  } | null> {
    const { data, error } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('id', gatewayId)
      .single();

    if (error || !data) return null;

    // Decrypt secrets
    return {
      consumer_key: decrypt(data.consumer_key),
      consumer_secret: decrypt(data.consumer_secret),
      passkey: decrypt(data.passkey),
      environment: data.environment,
      shortcode: data.shortcode,
      gateway_type: data.gateway_type,
    };
  },

  /**
   * Get active decrypted gateway for a client
   * For internal use in STK push and other payment operations
   * @internal
   */
  async getActiveDecrypted(clientId: string): Promise<{
    id: string;
    consumer_key: string;
    consumer_secret: string;
    passkey: string;
    environment: 'sandbox' | 'production';
    shortcode: string;
    gateway_type: 'till' | 'paybill';
    callback_url: string;
  } | null> {
    const { data, error } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return null;

    // Decrypt secrets
    return {
      id: data.id,
      consumer_key: decrypt(data.consumer_key),
      consumer_secret: decrypt(data.consumer_secret),
      passkey: decrypt(data.passkey),
      environment: data.environment,
      shortcode: data.shortcode,
      gateway_type: data.gateway_type,
      callback_url: data.callback_url,
    };
  },
};
