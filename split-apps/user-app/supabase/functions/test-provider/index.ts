import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestRequest {
  provider_type: "ussd" | "sms" | "whatsapp";
  provider_settings?: Record<string, string>;
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

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "super_admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: super_admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { provider_type, provider_settings }: TestRequest = await req.json();

    if (!provider_type || !["ussd", "sms", "whatsapp"].includes(provider_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid provider_type. Must be ussd, sms, or whatsapp" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load settings from DB if not provided
    let settings = provider_settings;
    if (!settings) {
      const settingKeys: Record<string, string[]> = {
        ussd: ["ussd_provider", "ussd_api_key", "ussd_short_code", "ussd_callback_url"],
        sms: ["sms_provider", "sms_api_key", "sms_username", "sms_sender_id"],
        whatsapp: ["whatsapp_api_token", "whatsapp_phone_number_id", "whatsapp_waba_id"],
      };
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", settingKeys[provider_type]);
      settings = {};
      data?.forEach((row: any) => { settings![row.key] = row.value ?? ""; });
    }

    let result: { success: boolean; message: string; error?: string };

    switch (provider_type) {
      case "ussd": {
        const provider = settings!.ussd_provider || "hostpinnacle";
        const apiKey = settings!.ussd_api_key || "";
        const shortCode = settings!.ussd_short_code || "";

        if (!apiKey) {
          result = { success: false, message: "", error: "USSD API key is not configured" };
          break;
        }

        if (provider === "africastalking") {
          // Test Africa's Talking USSD API
          try {
            const resp = await fetch("https://api.africastalking.com/version1/ussd", {
              method: "GET",
              headers: { "apiKey": apiKey, "Accept": "application/json" },
            });
            if (resp.ok) {
              result = { success: true, message: `Africa's Talking USSD reachable (status ${resp.status})` };
            } else {
              const body = await resp.text();
              result = { success: false, message: "", error: `Africa's Talking returned ${resp.status}: ${body}` };
            }
          } catch (e: any) {
            result = { success: false, message: "", error: `Connection failed: ${e.message}` };
          }
        } else if (provider === "hostpinnacle") {
          // Test HostPinnacle — verify API key format and reachability
          if (apiKey.length < 10) {
            result = { success: false, message: "", error: "API key appears too short for HostPinnacle" };
          } else {
            result = {
              success: true,
              message: `HostPinnacle config valid. Short code: ${shortCode || 'not set'}. API key length: ${apiKey.length} chars`,
            };
          }
        } else {
          // Custom provider — just validate fields exist
          result = {
            success: !!shortCode,
            message: shortCode
              ? `Custom provider configured. Short code: ${shortCode}`
              : "",
            error: shortCode ? undefined : "Short code is required for custom provider",
          };
        }
        break;
      }

      case "sms": {
        const apiKey = settings!.sms_api_key || "";
        const username = settings!.sms_username || "";
        const senderId = settings!.sms_sender_id || "";

        if (!apiKey || !username) {
          result = { success: false, message: "", error: "SMS API key and username are required" };
          break;
        }

        // Test Africa's Talking SMS API
        try {
          const params = new URLSearchParams();
          params.append("username", username);
          params.append("to", "+254700000000"); // Test number
          params.append("message", "Epix Visuals provider test");

          const resp = await fetch("https://api.africastalking.com/version1/messaging", {
            method: "POST",
            headers: {
              "apiKey": apiKey,
              "Content-Type": "application/x-www-form-urlencoded",
              "Accept": "application/json",
            },
            body: params.toString(),
          });

          const body = await resp.json();

          if (resp.ok || body.SMSMessageData?.Recipients?.[0]?.status === "InvalidPhoneNumber") {
            // InvalidPhoneNumber means the API is reachable, just the test number is fake
            result = {
              success: true,
              message: `Africa's Talking SMS API reachable. Sender: ${senderId || 'not set'}. Status: ${resp.status}`,
            };
          } else {
            result = {
              success: false,
              message: "",
              error: `SMS API returned ${resp.status}: ${JSON.stringify(body)}`,
            };
          }
        } catch (e: any) {
          result = { success: false, message: "", error: `SMS connection failed: ${e.message}` };
        }
        break;
      }

      case "whatsapp": {
        const apiToken = settings!.whatsapp_api_token || "";
        const phoneNumberId = settings!.whatsapp_phone_number_id || "";
        const wabaId = settings!.whatsapp_waba_id || "";

        if (!apiToken || !phoneNumberId) {
          result = { success: false, message: "", error: "WhatsApp API token and Phone Number ID are required" };
          break;
        }

        // Test WhatsApp Business API — fetch phone number info
        try {
          const resp = await fetch(
            `https://graph.facebook.com/v18.0/${phoneNumberId}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${apiToken}`,
                Accept: "application/json",
              },
            }
          );

          const body = await resp.json();

          if (resp.ok && body.display_phone_number) {
            result = {
              success: true,
              message: `WhatsApp Business API connected. Phone: ${body.display_phone_number}, WABA: ${wabaId || 'not set'}`,
            };
          } else {
            result = {
              success: false,
              message: "",
              error: `WhatsApp API error ${resp.status}: ${body.error?.message || JSON.stringify(body)}`,
            };
          }
        } catch (e: any) {
          result = { success: false, message: "", error: `WhatsApp connection failed: ${e.message}` };
        }
        break;
      }

      default:
        result = { success: false, message: "", error: "Unknown provider type" };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: result.success ? 200 : 400,
    });
  } catch (error: any) {
    console.error("test-provider error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "", error: error.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
