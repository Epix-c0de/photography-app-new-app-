// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    
    // Log the incoming callback
    await supabase.from('mpesa_logs').insert({ response_payload: payload });

    const stkCallback = payload.Body?.stkCallback;
    if (!stkCallback) {
      throw new Error('Invalid M-PESA callback payload');
    }

    const {
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    } = stkCallback;

    // 1. Locate the transaction
    const { data: transaction, error: txError } = await supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('checkout_request_id', CheckoutRequestID)
      .single();

    if (txError || !transaction) {
      console.error('Transaction not found for CheckoutRequestID:', CheckoutRequestID);
      return new Response('Transaction not found', { status: 200 }); // Still return 200 to Safaricom
    }

    if (ResultCode === 0) {
      // Payment Successful
      let mpesaReceipt = '';
      const items = CallbackMetadata?.Item || [];
      const receiptItem = items.find((i: any) => i.Name === 'MpesaReceiptNumber');
      if (receiptItem) {
        mpesaReceipt = receiptItem.Value;
      }

      // 2. Update transaction status
      await supabase
        .from('mpesa_transactions')
        .update({
          status: 'success',
          mpesa_receipt: mpesaReceipt,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      // Also update global payments table for unified history
      await supabase
        .from('payments')
        .update({
          status: 'paid',
          mpesa_receipt_number: mpesaReceipt,
          updated_at: new Date().toISOString()
        })
        .eq('mpesa_checkout_request_id', CheckoutRequestID);

      // 3. Unlock the gallery
      if (transaction.gallery_id) {
        const { error: unlockError } = await supabase
          .from('galleries')
          .update({
            is_paid: true,
            is_locked: false
          })
          .eq('id', transaction.gallery_id);

        if (unlockError) {
          console.error('Failed to unlock gallery:', unlockError);
        } else {
          console.log(`Gallery ${transaction.gallery_id} unlocked successfully via M-PESA payment.`);
        }
      }
    } else {
      // Payment Failed
      await supabase
        .from('mpesa_transactions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      // Also update global payments table
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('mpesa_checkout_request_id', CheckoutRequestID);
      
      console.warn(`M-PESA Payment failed for transaction ${transaction.id}: ${ResultDesc}`);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Callback error:', error);
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Internal Error" }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
