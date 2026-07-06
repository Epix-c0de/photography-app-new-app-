import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppRequest {
  phone_number: string;
  message: string;
  template_name?: string;
  template_params?: string[];
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

    const {
      phone_number,
      message,
      template_name,
      template_params,
      photographer_id,
      client_id,
      gallery_id,
    }: WhatsAppRequest = await req.json();

    if (!phone_number || !message) {
      return new Response(
        JSON.stringify({ error: "Missing phone_number or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp credentials from platform settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "whatsapp_api_token",
        "whatsapp_phone_number_id",
        "whatsapp_business_account_id",
      ]);

    const config: Record<string, string> = {};
    settings?.forEach((s: any) => {
      config[s.key] = s.value || "";
    });

    const apiToken = config.whatsapp_api_token;
    const phoneNumberId = config.whatsapp_phone_number_id;

    if (!apiToken || !phoneNumberId) {
      return new Response(
        JSON.stringify({ error: "WhatsApp Business API not configured" }),
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

    // WhatsApp Business API
    const apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    let payload: any;

    if (template_name && template_params) {
      // Use pre-approved template
      payload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: {
          name: template_name,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: template_params.map((param) => ({
                type: "text",
                text: param,
              })),
            },
          ],
        },
      };
    } else {
      // Use free-form message (within 24h window)
      payload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "text",
        text: { body: message },
      };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    // Log the WhatsApp message
    const logData = {
      photographer_id: photographer_id || null,
      client_id: client_id || null,
      phone_number: formattedPhone,
      message,
      status: result.messages ? "sent" : "failed",
      provider_ref: result.messages?.[0]?.id || null,
    };

    // Store in sms_logs with a special provider
    await supabase.from("sms_logs").insert({
      ...logData,
      status: result.messages ? "sent" : "failed",
    });

    return new Response(
      JSON.stringify({
        success: !!result.messages,
        message_id: result.messages?.[0]?.id,
        error: result.error?.message || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "WhatsApp send failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
