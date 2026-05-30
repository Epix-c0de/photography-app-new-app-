import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const callback = body?.Body?.stkCallback;

    if (!callback) {
      return new Response('Invalid callback', { status: 400 });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;

    if (resultCode !== 0) {
      // Payment failed or cancelled — mark subscription as failed
      await supabase
        .from('admin_subscriptions')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('checkout_request_id', checkoutRequestId)
        .eq('status', 'pending');

      return new Response('OK', { status: 200 });
    }

    // Extract M-Pesa transaction ID from callback metadata
    const items = callback.CallbackMetadata?.Item || [];
    const mpesaTransactionId = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;

    // Find the pending subscription to get admin_id
    const { data: sub } = await supabase
      .from('admin_subscriptions')
      .select('admin_id, amount')
      .eq('checkout_request_id', checkoutRequestId)
      .eq('status', 'pending')
      .single();

    if (!sub) {
      console.error('No pending subscription found for:', checkoutRequestId);
      return new Response('OK', { status: 200 });
    }

    // Activate the subscription using the DB function
    const { data, error } = await supabase.rpc('activate_admin_subscription', {
      p_admin_id: sub.admin_id,
      p_checkout_request_id: checkoutRequestId,
      p_mpesa_transaction_id: mpesaTransactionId,
      p_amount: sub.amount,
    });

    if (error) {
      console.error('activate_admin_subscription error:', error);
      return new Response('Error', { status: 500 });
    }

    // Send welcome/renewal SMS
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('phone, name')
        .eq('id', sub.admin_id)
        .single();

      if (profile?.phone) {
        await supabase.functions.invoke('send_sms', {
          body: {
            phoneNumber: profile.phone,
            message: `Hi ${profile.name || 'Photographer'}, your Epix Visuals subscription is now active for 30 days. Thank you! - Epix Visuals Studios`,
          },
        });
      }
    } catch (smsError) {
      // SMS failure should not block the subscription activation
      console.warn('SMS send failed:', smsError);
    }

    return new Response('OK', { status: 200 });

  } catch (error: any) {
    console.error('admin_subscribe_callback error:', error);
    return new Response('Error', { status: 500 });
  }
});
