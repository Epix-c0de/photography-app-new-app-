import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  return digits;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Not authenticated");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const smsAmount = Number(body?.amount ?? 0);
    const phoneNumberRaw = String(body?.phone_number ?? "");
    if (!Number.isFinite(smsAmount) || smsAmount <= 0) {
      throw new Error("Invalid amount");
    }
    if (!phoneNumberRaw.trim()) {
      throw new Error("Missing phone_number");
    }

    const phoneNumber = normalizePhone(phoneNumberRaw);

    const { data: config, error: configError } = await supabaseAdmin
      .from("payment_config")
      .select("*")
      .eq("admin_id", user.id)
      .maybeSingle();
    if (configError || !config) {
      throw new Error("Payment configuration not found");
    }

    const shortcode = config.mpesa_shortcode as string;
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const callbackUrl = `${supabaseUrl}/functions/v1/sms-bundle-callback`;

    const pricePerSms = Number(Deno.env.get("SMS_PRICE_PER_UNIT") ?? "1");
    const amountToCharge = Math.max(1, Math.round(smsAmount * (Number.isFinite(pricePerSms) && pricePerSms > 0 ? pricePerSms : 1)));

    if (!passkey || !consumerKey || !consumerSecret) {
      const mockCheckoutRequestID = `ws_CO_SMS_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const { error: insertError } = await supabaseAdmin.from("sms_bundle_purchases").insert({
        owner_admin_id: user.id,
        phone_number: phoneNumber,
        sms_amount: Math.round(smsAmount),
        amount: amountToCharge,
        currency: "KES",
        status: "pending",
        mpesa_checkout_request_id: mockCheckoutRequestID,
      });
      if (insertError) {
        throw new Error("Failed to record purchase");
      }

      return new Response(
        JSON.stringify({
          checkout_request_id: mockCheckoutRequestID,
          amount: amountToCharge,
          sms_amount: Math.round(smsAmount),
          status: "pending",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenRes = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: { Authorization: `Basic ${auth}` },
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new Error("Failed to generate M-Pesa access token");
    }

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const stkRes = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amountToCharge,
        PartyA: phoneNumber,
        PartyB: shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: `SMS-${smsAmount}`,
        TransactionDesc: `SMS bundle purchase (${smsAmount})`,
      }),
    });

    const stkData = await stkRes.json();
    if (stkData.ResponseCode !== "0") {
      throw new Error(stkData.ResponseDescription || "STK Push failed");
    }

    const { error: insertError } = await supabaseAdmin.from("sms_bundle_purchases").insert({
      owner_admin_id: user.id,
      phone_number: phoneNumber,
      sms_amount: Math.round(smsAmount),
      amount: amountToCharge,
      currency: "KES",
      status: "pending",
      mpesa_checkout_request_id: stkData.CheckoutRequestID,
    });
    if (insertError) {
      throw new Error("Failed to record purchase");
    }

    return new Response(
      JSON.stringify({
        ...stkData,
        checkout_request_id: stkData.CheckoutRequestID,
        amount: amountToCharge,
        sms_amount: Math.round(smsAmount),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

