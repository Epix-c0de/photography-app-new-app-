import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  phone_number: string;
  message: string;
  photographer_id?: string;
  client_id?: string;
  gallery_id?: string;
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

    const { phone_number, message, photographer_id, client_id, gallery_id }: SMSRequest = await req.json();

    if (!phone_number || !message) {
      return new Response(
        JSON.stringify({ error: "Missing phone_number or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Africa's Talking credentials from platform settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "africastalking_api_key",
        "africastalking_username",
        "africastalking_sender_id",
      ]);

    const config: Record<string, string> = {};
    settings?.forEach((s: any) => {
      config[s.key] = s.value || "";
    });

    const apiKey = config.africastalking_api_key;
    const username = config.africastalking_username || "epixvisuals";
    const senderId = config.africastalking_sender_id;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Africa's Talking API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number (remove +, ensure 254 prefix for Kenya)
    let formattedPhone = phone_number.replace(/[^\d]/g, "");
    if (formattedPhone.startsWith("0") && formattedPhone.length === 10) {
      formattedPhone = `254${formattedPhone.slice(1)}`;
    } else if (formattedPhone.startsWith("7") && formattedPhone.length === 9) {
      formattedPhone = `254${formattedPhone}`;
    }

    // Africa's Talking SMS API
    const apiUrl = "https://api.africastalking.com/version1/messaging";
    const payload = {
      username,
      to: [`+${formattedPhone}`],
      message,
      ...(senderId ? { from_: senderId } : {}),
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    // Log the SMS
    const smsData = {
      photographer_id: photographer_id || null,
      client_id: client_id || null,
      gallery_id: gallery_id || null,
      phone_number: formattedPhone,
      message,
      status: result.SMSMessageData?.Recipients?.[0]?.status === "Success" ? "sent" : "failed",
      provider_ref: result.SMSMessageData?.Recipients?.[0]?.messageId || null,
      cost: result.SMSMessageData?.Recipients?.[0]?.cost || null,
    };

    await supabase.from("sms_logs").insert(smsData);

    // Update photographer SMS credits if applicable
    if (photographer_id && result.SMSMessageData?.Recipients?.[0]?.status === "Success") {
      const cost = parseFloat(result.SMSMessageData?.Recipients?.[0]?.cost || "0");
      if (cost > 0) {
        await supabase.rpc("deduct_sms_credits", {
          p_photographer_id: photographer_id,
          p_amount: cost,
        });
      }
    }

    const recipient = result.SMSMessageData?.Recipients?.[0];

    return new Response(
      JSON.stringify({
        success: recipient?.status === "Success",
        message_id: recipient?.messageId,
        status: recipient?.status,
        cost: recipient?.cost,
        errorMessage: recipient?.errorMessage || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("SMS send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "SMS send failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
