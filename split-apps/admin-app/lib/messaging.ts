import { supabase } from './supabase';

export interface SendSMSParams {
  phone_number: string;
  message: string;
  photographer_id?: string;
  client_id?: string;
  gallery_id?: string;
}

export interface SendWhatsAppParams {
  phone_number: string;
  message: string;
  template_name?: string;
  template_params?: string[];
  photographer_id?: string;
  client_id?: string;
  gallery_id?: string;
}

export interface SMSLog {
  id: string;
  phone_number: string;
  message: string;
  status: string;
  provider_ref?: string;
  cost?: number;
  created_at: string;
}

/**
 * SMS Service - Africa's Talking integration
 */
export const SMSCloudService = {
  /**
   * Send SMS via Africa's Talking API
   */
  async send(params: SendSMSParams): Promise<{
    success: boolean;
    message_id?: string;
    cost?: number;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: params,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Send gallery ready notification via SMS
   */
  async sendGalleryReady(params: {
    phone_number: string;
    client_name: string;
    gallery_name: string;
    access_code: string;
    deep_link: string;
    photographer_id?: string;
    client_id?: string;
    gallery_id?: string;
  }): Promise<{ success: boolean }> {
    const message = `Hi ${params.client_name}, your ${params.gallery_name} photos are ready!\n\nView them here: ${params.deep_link}\n\nUse code: ${params.access_code} to unlock.\n\nThank you!`;

    const result = await this.send({
      phone_number: params.phone_number,
      message,
      photographer_id: params.photographer_id,
      client_id: params.client_id,
      gallery_id: params.gallery_id,
    });

    return { success: result.success };
  },

  /**
   * Send payment reminder via SMS
   */
  async sendPaymentReminder(params: {
    phone_number: string;
    client_name: string;
    gallery_name: string;
    amount: number;
    deep_link: string;
    photographer_id?: string;
    client_id?: string;
    gallery_id?: string;
  }): Promise<{ success: boolean }> {
    const message = `Hi ${params.client_name}, reminder: KES ${params.amount.toLocaleString('en-KE')} payment due for ${params.gallery_name}.\n\nPay here: ${params.deep_link}`;

    const result = await this.send({
      phone_number: params.phone_number,
      message,
      photographer_id: params.photographer_id,
      client_id: params.client_id,
      gallery_id: params.gallery_id,
    });

    return { success: result.success };
  },

  /**
   * Get SMS logs for a photographer
   */
  async getLogs(photographerId: string, limit = 50): Promise<SMSLog[]> {
    const { data, error } = await supabase
      .from('sms_logs')
      .select('*')
      .eq('photographer_id', photographerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get SMS balance/credits (consolidated to admin_resources.sms_balance)
   */
  async getCredits(photographerId: string): Promise<number> {
    const { data, error } = await supabase
      .from('admin_resources')
      .select('sms_balance')
      .eq('admin_id', photographerId)
      .maybeSingle();

    if (error) throw error;
    return data?.sms_balance || 0;
  },
};

/**
 * WhatsApp Business API Service
 */
export const WhatsAppService = {
  /**
   * Send WhatsApp message
   */
  async send(params: SendWhatsAppParams): Promise<{
    success: boolean;
    message_id?: string;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: params,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Send gallery ready notification via WhatsApp
   */
  async sendGalleryReady(params: {
    phone_number: string;
    client_name: string;
    gallery_name: string;
    access_code: string;
    deep_link: string;
    photographer_id?: string;
    client_id?: string;
    gallery_id?: string;
  }): Promise<{ success: boolean }> {
    const message = `📸 *${params.gallery_name}*\n\nHi ${params.client_name}! Your photos are ready to view and download.\n\n🔗 View Gallery: ${params.deep_link}\n🔑 Access Code: ${params.access_code}\n\nThank you for choosing Epix Visuals! 📷`;

    const result = await this.send({
      phone_number: params.phone_number,
      message,
      photographer_id: params.photographer_id,
      client_id: params.client_id,
      gallery_id: params.gallery_id,
    });

    return { success: result.success };
  },

  /**
   * Send payment reminder via WhatsApp
   */
  async sendPaymentReminder(params: {
    phone_number: string;
    client_name: string;
    gallery_name: string;
    amount: number;
    deep_link: string;
    photographer_id?: string;
    client_id?: string;
    gallery_id?: string;
  }): Promise<{ success: boolean }> {
    const message = `💰 *Payment Reminder*\n\nHi ${params.client_name},\n\nKES ${params.amount.toLocaleString('en-KE')} payment due for *${params.gallery_name}*.\n\nPay here: ${params.deep_link}`;

    const result = await this.send({
      phone_number: params.phone_number,
      message,
      photographer_id: params.photographer_id,
      client_id: params.client_id,
      gallery_id: params.gallery_id,
    });

    return { success: result.success };
  },

  /**
   * Generate WhatsApp share link (opens WhatsApp with prefilled message)
   */
  generateShareLink(phone_number: string, message: string): string {
    const phone = phone_number.replace(/[^\d]/g, '');
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  },
};
