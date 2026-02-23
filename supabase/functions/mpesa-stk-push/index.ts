import { createClient } from "@supabase/supabase-js";

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

    const { phone_number, amount, gallery_id, reference } = await req.json();

    if (!phone_number || !amount || !gallery_id) {
      throw new Error('Missing required fields');
    }

    const { data: gallery, error: galleryError } = await supabase
      .from('galleries')
      .select('id, owner_admin_id, client_id, price, access_code, name, is_paid')
      .eq('id', gallery_id)
      .single();

    if (galleryError || !gallery) {
      throw new Error('Gallery not found');
    }

    if (gallery.is_paid) {
      throw new Error('Gallery already paid. Download unlocked.');
    }

    const ownerAdminId = gallery.owner_admin_id as string;
    const clientId = gallery.client_id as string;
    const amountToCharge = Number.isFinite(Number(amount)) ? Number(amount) : Number(gallery.price);
    const accountReference = reference || gallery.access_code || gallery.name || 'Gallery';

    const { data: reserved, error: reserveError } = await supabase.rpc('reserve_gallery_payment', {
      p_gallery_id: gallery_id,
      p_client_id: clientId,
      p_client_phone: String(phone_number),
      p_amount: amountToCharge,
    });
    if (reserveError) {
      if (reserveError.message?.includes('GALLERY_ALREADY_PAID')) {
        throw new Error('Gallery already paid. Download unlocked.');
      }
      if (reserveError.message?.includes('PAYMENT_IN_PROGRESS')) {
        throw new Error('Payment already in progress. Please complete it.');
      }
      throw new Error('Unable to reserve payment');
    }
    const paymentId = typeof reserved === 'string' ? reserved : Array.isArray(reserved) ? reserved[0] : reserved;
    if (!paymentId) {
      throw new Error('Unable to reserve payment');
    }

    // 1. Get Payment Config (scoped to the gallery owner admin)
    const { data: config, error: configError } = await supabase
      .from('payment_config')
      .select('*')
      .eq('admin_id', ownerAdminId)
      .maybeSingle();

    if (configError || !config) {
      console.error('Payment config missing:', configError);
      throw new Error('Payment configuration not found');
    }

    const shortcode = config.mpesa_shortcode;
    const passkey = Deno.env.get('MPESA_PASSKEY'); // Environment Variable
    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY'); // Environment Variable
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET'); // Environment Variable
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;

    // 2. Mock STK Push if no credentials (for dev/demo)
    if (!passkey || !consumerKey || !consumerSecret) {
      console.log('Missing M-Pesa credentials, using mock response');
      
      const mockCheckoutRequestID = `ws_CO_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          checkout_request_id: mockCheckoutRequestID,
          mpesa_checkout_request_id: mockCheckoutRequestID,
          phone_number: phone_number,
          client_phone: phone_number,
        })
        .eq('id', paymentId);

      if (paymentError) {
        console.error('Failed to update payment record:', paymentError);
        throw new Error('Failed to record payment');
      }

      // Simulate callback after 5 seconds (optional, for testing without real callback)
      // In production, we just return and wait for real callback.
      
      return new Response(
        JSON.stringify({
          checkout_request_id: mockCheckoutRequestID,
          MerchantRequestID: `MR-${Date.now()}`,
          CheckoutRequestID: mockCheckoutRequestID,
          ResponseCode: '0',
          ResponseDescription: 'Success. Request accepted for processing',
          CustomerMessage: 'Success. Request accepted for processing',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Real STK Push Implementation
    
    // A. Get Access Token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenRes = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentId);
      throw new Error('Failed to generate M-Pesa access token');
    }

    // B. Generate Password
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // C. Send Request
    const stkRes = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.max(1, Math.round(amountToCharge)),
        PartyA: phone_number,
        PartyB: shortcode,
        PhoneNumber: phone_number,
        CallBackURL: callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: `Payment for Gallery ${gallery_id}`
      })
    });

    const stkData = await stkRes.json();

    if (stkData.ResponseCode !== "0") {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentId);
      throw new Error(stkData.ResponseDescription || 'STK Push failed');
    }

    await supabase
      .from('payments')
      .update({
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        mpesa_checkout_request_id: stkData.CheckoutRequestID,
        phone_number: phone_number,
        client_phone: phone_number,
      })
      .eq('id', paymentId);

    return new Response(
      JSON.stringify({
        ...stkData,
        checkout_request_id: stkData.CheckoutRequestID,
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
