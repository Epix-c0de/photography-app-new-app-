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

    // Handle both STK Push and C2B callbacks
    const stkCallback = payload.Body?.stkCallback;
    const c2bCallback = payload.Body?.c2bCallback;
    
    if (stkCallback) {
      // Handle STK Push callback (existing logic)
      const {
        CheckoutRequestID,
        ResultCode,
        ResultDesc,
        CallbackMetadata
      } = stkCallback;

      const { data: transaction, error: txError } = await supabase
        .from('mpesa_transactions')
        .select('*')
        .eq('checkout_request_id', CheckoutRequestID)
        .single();

      if (txError || !transaction) {
        console.error('Transaction not found for CheckoutRequestID:', CheckoutRequestID);
        return new Response('Transaction not found', { status: 200 });
      }

      if (ResultCode === 0) {
        let mpesaReceipt = '';
        const items = CallbackMetadata?.Item || [];
        const receiptItem = items.find((i: any) => i.Name === 'MpesaReceiptNumber');
        if (receiptItem) {
          mpesaReceipt = receiptItem.Value;
        }

        await supabase
          .from('mpesa_transactions')
          .update({
            status: 'success',
            mpesa_receipt: mpesaReceipt,
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id);

        await supabase
          .from('payments')
          .update({
            status: 'paid',
            mpesa_receipt_number: mpesaReceipt,
            updated_at: new Date().toISOString()
          })
          .eq('mpesa_checkout_request_id', CheckoutRequestID);

        if (transaction.gallery_id) {
          await supabase
            .from('galleries')
            .update({ is_paid: true, is_locked: false })
            .eq('id', transaction.gallery_id);
        }
      } else {
        await supabase
          .from('mpesa_transactions')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', transaction.id);

        await supabase
          .from('payments')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('mpesa_checkout_request_id', CheckoutRequestID);
      }
    } else if (c2bCallback) {
      // Handle C2B callback for simple M-PESA automation
      const {
        TransactionType,
        TransID,
        TransTime,
        TransAmount,
        BusinessShortCode,
        BillRefNumber,
        InvoiceNumber,
        OrgAccountBalance,
        ThirdPartyTransID,
        MSISDN,
        FirstName,
        MiddleName,
        LastName
      } = c2bCallback;

      console.log(`[C2B Callback] Payment received: ${TransAmount} from ${MSISDN} to ${BillRefNumber}`);

      // Find admin with this mobile number in simple_payment_settings
      const { data: adminSettings, error: adminError } = await supabase
        .from('simple_payment_settings')
        .select('admin_id, mpesa_number, business_name, auto_verification')
        .eq('mpesa_number', BillRefNumber || MSISDN)
        .maybeSingle();

      if (adminError || !adminSettings) {
        console.error('Admin not found for mobile number:', BillRefNumber || MSISDN);
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if auto-verification is enabled
      if (!adminSettings.auto_verification) {
        console.log(`Auto-verification disabled for admin ${adminSettings.admin_id}. Payment will require manual verification.`);
        // Create manual payment record for admin to verify
        await supabase
          .from('manual_payments')
          .insert({
            admin_id: adminSettings.admin_id,
            amount: parseFloat(TransAmount),
            phone_number: MSISDN,
            mpesa_number: adminSettings.mpesa_number,
            mpesa_receipt: TransID,
            status: 'pending',
            created_at: new Date(TransTime).toISOString(),
          });
        
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Find pending manual payment for this admin with matching amount
      const { data: manualPayment, error: paymentError } = await supabase
        .from('manual_payments')
        .select('*')
        .eq('admin_id', adminSettings.admin_id)
        .eq('amount', parseFloat(TransAmount))
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (paymentError || !manualPayment) {
        console.error('No pending manual payment found for amount:', TransAmount);
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify the payment
      const { error: verifyError } = await supabase
        .from('manual_payments')
        .update({
          status: 'verified',
          mpesa_receipt: TransID,
          updated_at: new Date().toISOString()
        })
        .eq('id', manualPayment.id);

      if (verifyError) {
        console.error('Failed to verify manual payment:', verifyError);
      }

      // Unlock the gallery
      const { error: unlockError } = await supabase
        .from('galleries')
        .update({ is_paid: true, is_locked: false })
        .eq('id', manualPayment.gallery_id);

      if (unlockError) {
        console.error('Failed to unlock gallery:', unlockError);
      } else {
        console.log(`Gallery ${manualPayment.gallery_id} unlocked automatically via C2B callback`);
      }

      // Create payment record in global payments table
      await supabase
        .from('payments')
        .insert({
          owner_admin_id: adminSettings.admin_id,
          client_id: manualPayment.client_id,
          gallery_id: manualPayment.gallery_id,
          amount: parseFloat(TransAmount),
          status: 'paid',
          mpesa_receipt_number: TransID,
          phone_number: MSISDN,
          created_at: new Date(TransTime).toISOString(),
        });

    } else {
      throw new Error('Invalid M-PESA callback payload - neither STK nor C2B');
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
