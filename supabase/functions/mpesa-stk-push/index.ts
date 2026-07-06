import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface STKPushRequest {
  phone_number: string;
  amount: number;
  gallery_id?: string;
  receipt_id?: string;
  till_number?: string;
  description?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      phone_number,
      amount,
      gallery_id,
      receipt_id,
      till_number,
      description,
    }: STKPushRequest = await req.json();

    if (!phone_number || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing phone_number or amount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get M-Pesa credentials from platform settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "mpesa_consumer_key",
        "mpesa_consumer_secret",
        "mpesa_passkey",
        "mpesa_shortcode",
        "mpesa_callback_url",
        "mpesa_environment",
      ]);

    const config: Record<string, string> = {};
    settings?.forEach((s: any) => {
      config[s.key] = s.value || "";
    });

    const consumerKey = config.mpesa_consumer_key;
    const consumerSecret = config.mpesa_consumer_secret;
    const passkey = config.mpesa_passkey;
    const shortcode = till_number || config.mpesa_shortcode;
    const callbackUrl =
      config.mpesa_callback_url ||
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;
    const environment = config.mpesa_environment || "sandbox";

    if (!consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ error: "M-Pesa credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get access token
    const tokenResponse = await fetch(
      `https://${environment === "production" ? "api" : "sandbox"}.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`,
        },
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error("Failed to get M-Pesa access token");
    }

    // Format phone number (remove +, ensure 254 prefix)
    const formattedPhone = phone_number.startsWith("254")
      ? phone_number
      : phone_number.replace(/^0/, "254").replace(/^\+/, "");

    // Generate timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:\.Z]/g, "")
      .slice(0, 14);

    // Generate password
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // STK Push request
    const stkResponse = await fetch(
      `https://${environment === "production" ? "api" : "sandbox"}.safaricom.co.ke/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: Math.round(amount),
          PartyA: formattedPhone,
          PartyB: shortcode,
          PhoneNumber: formattedPhone,
          CallBackURL: `${callbackUrl}?receipt_id=${receipt_id || ""}&gallery_id=${gallery_id || ""}`,
          AccountReference: description || "Epix Visuals Payment",
          TransactionDesc: description || "Gallery Payment",
        }),
      }
    );

    const stkData = await stkResponse.json();

    // Log the transaction
    if (receipt_id) {
      await supabase.from("mpesa_transactions").insert({
        receipt_id,
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        phone_number: formattedPhone,
        amount,
        till_number: shortcode,
        status: "pending",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkout_request_id: stkData.CheckoutRequestID,
        merchant_request_id: stkData.MerchantRequestID,
        response_code: stkData.ResponseCode,
        response_description: stkData.ResponseDescription,
        customer_message: stkData.CustomerMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("STK Push error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "STK Push failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
