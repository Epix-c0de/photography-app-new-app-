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

    const { phone_number, amount, gallery_id } = await req.json();

    if (!phone_number || !amount || !gallery_id) {
      throw new Error('Missing required fields');
    }

    // 1. Verify gallery exists and is locked
    const { data: gallery, error: galleryError } = await supabase
      .from('galleries')
      .select('id, owner_admin_id, client_id, is_locked, is_paid, price, name')
      .eq('id', gallery_id)
      .single();

    if (galleryError || !gallery) {
      throw new Error('Gallery not found');
    }

    if (!gallery.is_locked || gallery.is_paid) {
      throw new Error('Gallery is already unlocked or paid');
    }

    // 2. Prevent duplicate payments
    // If status = success -> reject
    // If status = pending AND created < 10 mins -> reject
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existingTx, error: txError } = await supabase
      .from('mpesa_transactions')
      .select('id, status, created_at')
      .eq('gallery_id', gallery_id)
      .or(`status.eq.success,and(status.eq.pending,created_at.gt.${tenMinutesAgo})`)
      .maybeSingle();

    if (existingTx) {
      if (existingTx.status === 'success') {
        throw new Error('Gallery already paid');
      }
      throw new Error('A payment is already pending. Please wait 10 minutes before retrying.');
    }

    // 3. Get Payment Settings for the admin
    let mpesaSettings = null;

    // First try Simple Payment Settings
    const { data: simpleSettings } = await supabase
      .from('simple_payment_settings')
      .select('*')
      .eq('admin_id', gallery.owner_admin_id)
      .maybeSingle();

    if (simpleSettings && simpleSettings.mpesa_number) {
      // Use platform-wide credentials but log the admin's number
      mpesaSettings = {
        environment: 'sandbox', // Or production
        consumer_key: Deno.env.get('PLATFORM_MPESA_CONSUMER_KEY') || Deno.env.get('MPESA_CONSUMER_KEY'),
        consumer_secret: Deno.env.get('PLATFORM_MPESA_CONSUMER_SECRET') || Deno.env.get('MPESA_CONSUMER_SECRET'),
        shortcode: Deno.env.get('PLATFORM_MPESA_SHORTCODE') || Deno.env.get('MPESA_SHORTCODE'),
        passkey: Deno.env.get('PLATFORM_MPESA_PASSKEY') || Deno.env.get('MPESA_PASSKEY'),
      };
    } else {
      // Fallback to advanced Daraja settings
      const { data: advancedSettings, error: settingsError } = await supabase
        .from('payment_settings')
        .select('*')
        .eq('admin_id', gallery.owner_admin_id)
        .single();

      if (settingsError || !advancedSettings) {
        console.error('Payment settings missing for admin:', gallery.owner_admin_id);
        throw new Error('M-PESA is not configured for this gallery. Please set up payment in admin settings.');
      }
      mpesaSettings = advancedSettings;
    }

    const {
      environment,
      consumer_key,
      consumer_secret,
      shortcode,
      passkey,
    } = mpesaSettings;

    if (!consumer_key || !consumer_secret || !shortcode || !passkey) {
      throw new Error('M-PESA configuration is incomplete');
    }

    const baseUrl = environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    // 4. Generate Access Token
    const auth = btoa(`${consumer_key}:${consumer_secret}`);
    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Failed to authenticate with Safaricom');
    }

    // 5. Generate Password and Timestamp
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // 6. Initiate STK Push
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;
    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.max(1, Math.round(Number(amount))),
      PartyA: phone_number,
      PartyB: shortcode,
      PhoneNumber: phone_number,
      CallBackURL: callbackUrl,
      AccountReference: `GAL-${gallery_id.slice(0, 8).toUpperCase()}`,
      TransactionDesc: `Unlocking Gallery: ${gallery.name}`
    };

    // Log request
    await supabase.from('mpesa_logs').insert({ request_payload: stkBody });

    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkBody)
    });

    const stkData = await stkRes.json();
    
    // Log response
    await supabase.from('mpesa_logs').insert({ response_payload: stkData });

    if (stkData.ResponseCode !== "0") {
      throw new Error(stkData.ResponseDescription || 'STK Push failed');
    }

    // 7. Create transaction and payment records
    const { error: insertError } = await supabase
      .from('mpesa_transactions')
      .insert({
        gallery_id: gallery_id,
        client_id: gallery.client_id,
        phone_number: phone_number,
        amount: Number(amount),
        merchant_request_id: stkData.MerchantRequestID,
        checkout_request_id: stkData.CheckoutRequestID,
        status: 'pending'
      });

    if (insertError) {
      console.error('Failed to record mpesa transaction:', insertError);
    }

    // Also add to global payments table for unified history/accounting
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        owner_admin_id: gallery.owner_admin_id,
        client_id: gallery.client_id,
        gallery_id: gallery_id,
        amount: Number(amount),
        status: 'pending',
        mpesa_checkout_request_id: stkData.CheckoutRequestID,
        phone_number: phone_number
      });

    if (paymentError) {
      console.error('Failed to record global payment:', paymentError);
    }

    return new Response(
      JSON.stringify({
        message: 'STK Push sent successfully',
        checkout_request_id: stkData.CheckoutRequestID,
        ...stkData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
