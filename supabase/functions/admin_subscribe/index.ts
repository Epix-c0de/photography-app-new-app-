import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { phone_number, admin_id } = await req.json();

    if (!phone_number || !admin_id) {
      return new Response(
        JSON.stringify({ error: 'phone_number and admin_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the admin exists
    const { data: admin, error: adminError } = await supabase
      .from('user_profiles')
      .select('id, role, is_lifetime, subscription_status')
      .eq('id', admin_id)
      .single();

    if (adminError || !admin) {
      return new Response(
        JSON.stringify({ error: 'Admin not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip payment for lifetime/super_admin accounts
    if (admin.is_lifetime || admin.role === 'super_admin') {
      return new Response(
        JSON.stringify({ message: 'Lifetime account — no payment required', status: 'active' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number to 254XXXXXXXXX
    let formattedPhone = phone_number.replace(/\s+/g, '').replace(/^\+/, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    }

    const amount = 500; // KES 500/month
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const shortcode = Deno.env.get('MPESA_SHORTCODE')!;
    const passkey = Deno.env.get('MPESA_PASSKEY')!;
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Get M-Pesa access token
    const authResponse = await fetch(
      'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${btoa(`${Deno.env.get('MPESA_CONSUMER_KEY')}:${Deno.env.get('MPESA_CONSUMER_SECRET')}`)}`,
        },
      }
    );
    const { access_token } = await authResponse.json();

    // Initiate STK push
    const stkResponse = await fetch(
      'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: formattedPhone,
          PartyB: shortcode,
          PhoneNumber: formattedPhone,
          CallBackURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/admin_subscribe_callback`,
          AccountReference: 'EpixVisuals',
          TransactionDesc: 'Monthly Subscription KES 500',
        }),
      }
    );

    const stkData = await stkResponse.json();

    if (stkData.ResponseCode !== '0') {
      return new Response(
        JSON.stringify({ error: stkData.ResponseDescription || 'STK push failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const checkoutRequestId = stkData.CheckoutRequestID;

    // Create a pending subscription record
    const { error: subError } = await supabase
      .from('admin_subscriptions')
      .insert({
        admin_id,
        amount,
        currency: 'KES',
        checkout_request_id: checkoutRequestId,
        status: 'pending',
        phone_number: formattedPhone,
      });

    if (subError) throw subError;

    return new Response(
      JSON.stringify({
        checkout_request_id: checkoutRequestId,
        message: 'STK push sent. Enter your M-Pesa PIN to complete subscription.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('admin_subscribe error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
