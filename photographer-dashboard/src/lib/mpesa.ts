import { supabase } from './supabase';

export interface TillNumber {
  id: string;
  till_number: string;
  business_name: string;
  phone_number?: string;
  is_primary: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface PaymentReceipt {
  id: string;
  receipt_number: string;
  amount: number;
  currency: string;
  status: string;
  transaction_id?: string;
  phone_number?: string;
  receipt_text?: string;
  created_at: string;
}

export interface InstallmentPlan {
  id: string;
  gallery_id: string;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  number_of_installments: number;
  installment_amount: number;
  status: string;
  created_at: string;
}

/**
 * M-Pesa Payment Service
 */
export const MpesaService = {
  /**
   * Initiate STK Push to client's phone
   */
  async initiatePayment(params: {
    phone_number: string;
    amount: number;
    gallery_id?: string;
    receipt_id?: string;
    till_number?: string;
    description?: string;
  }): Promise<{
    checkout_request_id: string;
    response_code: string;
    customer_message: string;
  }> {
    const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
      body: params,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Check payment status
   */
  async checkPaymentStatus(checkoutRequestId: string): Promise<{
    status: string;
    result_code?: number;
    result_description?: string;
  }> {
    const { data, error } = await supabase
      .from('transactions')
      .select('status, result_code, result_desc')
      .eq('checkout_request_id', checkoutRequestId)
      .single();

    if (error) throw error;
    return {
      status: data.status,
      result_code: data.result_code,
      result_description: data.result_desc,
    };
  },

  /**
   * Generate receipt for a payment
   */
  async generateReceipt(params: {
    photographer_id: string;
    client_id?: string;
    gallery_id?: string;
    amount: number;
    phone_number?: string;
    receipt_id?: string;
    transaction_id?: string;
  }): Promise<{
    receipt_number: string;
    receipt_text: string;
    receipt_id: string;
  }> {
    const { data, error } = await supabase.functions.invoke('generate-receipt', {
      body: params,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Get photographer's till numbers
   */
  async getTillNumbers(photographerId: string): Promise<TillNumber[]> {
    const { data, error } = await supabase
      .from('photographer_till_numbers')
      .select('*')
      .eq('photographer_id', photographerId)
      .order('is_primary', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Add a new till number
   */
  async addTillNumber(params: {
    photographer_id: string;
    till_number: string;
    business_name: string;
    phone_number?: string;
  }): Promise<TillNumber> {
    const { data, error } = await supabase
      .from('photographer_till_numbers')
      .insert(params)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Verify a till number (simplified - in production would call Safaricom API)
   */
  async verifyTillNumber(tillId: string): Promise<boolean> {
    const { error } = await supabase
      .from('photographer_till_numbers')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', tillId);

    if (error) throw error;
    return true;
  },

  /**
   * Delete a till number
   */
  async deleteTillNumber(tillId: string): Promise<boolean> {
    const { error } = await supabase
      .from('photographer_till_numbers')
      .delete()
      .eq('id', tillId);

    if (error) throw error;
    return true;
  },

  /**
   * Create an installment plan
   */
  async createInstallmentPlan(params: {
    gallery_id: string;
    photographer_id: string;
    client_id: string;
    total_amount: number;
    deposit_amount?: number;
    number_of_installments: number;
  }): Promise<InstallmentPlan> {
    const { data, error } = await supabase.functions.invoke('create-installment-plan', {
      body: params,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Get installment plan for a gallery
   */
  async getInstallmentPlan(galleryId: string): Promise<InstallmentPlan | null> {
    const { data, error } = await supabase
      .from('installment_plans')
      .select('*')
      .eq('gallery_id', galleryId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Get installment payments for a plan
   */
  async getInstallmentPayments(planId: string) {
    const { data, error } = await supabase
      .from('installment_payments')
      .select('*')
      .eq('plan_id', planId)
      .order('installment_number');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get payment receipts for a photographer
   */
  async getReceipts(photographerId: string, limit = 50): Promise<PaymentReceipt[]> {
    const { data, error } = await supabase
      .from('payment_receipts')
      .select('*')
      .eq('photographer_id', photographerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};
