import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length >= 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  return digits;
};

const formatTimestamp = () => {
  const now = new Date();
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}${pad(now.getSeconds())}`;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json();
    const { access_code, phone_number, amount } = body ?? {};
    if (!access_code || !phone_number || !amount) {
      throw new Error("Missing required fields");
    }

    const normalizedCode = String(access_code).trim().toUpperCase();
    const normalizedPhone = normalizePhone(String(phone_number));
    const amountToCharge = Math.max(1, Number(amount));

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: gallery, error: galleryError } = await adminClient
      .from("galleries")
      .select("id, owner_admin_id, client_id, is_paid, is_active, access_code, client_name")
      .eq("access_code", normalizedCode)
      .eq("is_active", true)
      .maybeSingle();
    if (galleryError || !gallery) {
      throw new Error("Gallery not found");
    }
    if (gallery.is_paid) {
      throw new Error("Gallery already paid. Download unlocked.");
    }

    const { data: client } = await adminClient
      .from("clients")
      .select("id, user_id")
      .eq("id", gallery.client_id)
      .maybeSingle();
    if (!client || client.user_id !== user.id) {
      throw new Error("Forbidden");
    }

    const { data: settings, error: settingsError } = await adminClient
      .from("payment_settings")
      .select("*")
      .eq("admin_id", gallery.owner_admin_id)
      .eq("is_active", true)
      .maybeSingle();
    if (settingsError || !settings) {
      throw new Error("Payment settings not found");
    }

    const { data: reserved, error: reserveError } = await adminClient.rpc("reserve_gallery_payment", {
      p_gallery_id: gallery.id,
      p_client_id: gallery.client_id,
      p_client_phone: normalizedPhone,
      p_amount: amountToCharge,
    });
    if (reserveError) {
      if (reserveError.message?.includes("GALLERY_ALREADY_PAID")) {
        throw new Error("Gallery already paid. Download unlocked.");
      }
      if (reserveError.message?.includes("PAYMENT_IN_PROGRESS")) {
        throw new Error("Payment already in progress. Please complete it.");
      }
      throw new Error("Unable to reserve payment");
    }
    const paymentId = typeof reserved === "string" ? reserved : Array.isArray(reserved) ? reserved[0] : reserved;
    if (!paymentId) {
      throw new Error("Unable to reserve payment");
    }

    const timestamp = formatTimestamp();
    const password = btoa(`${settings.mpesa_shortcode}${settings.mpesa_passkey}${timestamp}`);
    const auth = btoa(`${settings.mpesa_consumer_key}:${settings.mpesa_consumer_secret}`);

    const tokenRes = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: { Authorization: `Basic ${auth}` },
    });
    const tokenData = await tokenRes.json();
    if (!tokenData?.access_token) {
      await adminClient.from("payments").update({ status: "failed" }).eq("id", paymentId);
      throw new Error("Failed to generate M-Pesa access token");
    }

    const callbackUrl = settings.callback_url ||
      `${supabaseUrl}/functions/v1/payments_mpesa_callback`;

    const stkRes = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: settings.mpesa_shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(amountToCharge),
        PartyA: normalizedPhone,
        PartyB: settings.mpesa_shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrl,
        AccountReference: normalizedCode,
        TransactionDesc: `Payment for gallery ${normalizedCode}`,
      }),
    });

    const stkData = await stkRes.json();
    if (stkData?.ResponseCode !== "0") {
      await adminClient.from("payments").update({ status: "failed" }).eq("id", paymentId);
      throw new Error(stkData?.ResponseDescription || "STK Push failed");
    }

    const checkoutRequestId = stkData.CheckoutRequestID as string;
    const merchantRequestId = stkData.MerchantRequestID as string;

    const { error: paymentError } = await adminClient.from("payments").update({
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      mpesa_checkout_request_id: checkoutRequestId,
      phone_number: normalizedPhone,
      client_phone: normalizedPhone,
    }).eq("id", paymentId);
    if (paymentError) {
      throw new Error("Failed to record payment");
    }

    return new Response(
      JSON.stringify({
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
        status: "pending",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
