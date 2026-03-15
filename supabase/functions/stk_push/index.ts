// supabase/functions/stk_push/index.ts
/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const { galleryId, clientId, phoneNumber, amount } = await req.json();
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get Admin M-Pesa Credentials from DB (or Environment)
    // In a real scenario, we might query 'admin_settings' here using a Service Key
    
    // 2. Mock STK Push Logic
    // In production, you would call: https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
    
    console.log(`Initiating STK Push to ${phoneNumber} for Gallery ${galleryId} Amount ${amount}`);

    // 3. Mock Response
    const mockResponse = {
      MerchantRequestID: `MR-${Date.now()}`,
      CheckoutRequestID: `ws_CO_${Date.now()}`,
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing",
      CustomerMessage: "Success. Request accepted for processing"
    };

    // 4. Insert pending payment
    await supabaseAdmin
      .from('payments')
      .insert({
        owner_admin_id: null, // optional: set via admin context if available
        client_id: clientId ?? null,
        gallery_id: galleryId ?? null,
        amount: amount ?? 0,
        status: 'pending',
        mpesa_checkout_request_id: mockResponse.CheckoutRequestID,
        phone_number: phoneNumber ?? null
      });

    return new Response(
      JSON.stringify(mockResponse),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
})
