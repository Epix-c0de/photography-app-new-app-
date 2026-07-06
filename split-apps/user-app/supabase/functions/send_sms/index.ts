// supabase/functions/send_sms/index.ts
// Sends SMS via Africa's Talking API (configured in platform_settings)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req: Request) => {
  try {
    const { phone_number, message, client_id } = await req.json();

    if (!phone_number || !message) {
      return new Response(
        JSON.stringify({ error: "Missing phone_number or message" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Africa's Talking credentials from platform_settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "africastalking_api_key",
        "africastalking_username",
        "sms_sender_id",
      ]);

    const config = Object.fromEntries(
      (settings || []).map((s: any) => [s.key, s.value]),
    );

    const apiKey = config.africastalking_api_key;
    const username = config.africastalking_username || "epixvisuals";
    const senderId = config.sms_sender_id || undefined;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Africa's Talking API key not configured. Set africastalking_api_key in platform_settings.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Call Africa's Talking messaging API
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("to", phone_number);
    body.append("message", message);
    if (senderId) body.append("from", senderId);

    const response = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          apiKey: apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("[send_sms] Africa's Talking error:", result);
      return new Response(
        JSON.stringify({
          success: false,
          error: result?.StatusBarMessage || result?.message || `HTTP ${response.status}`,
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } },
      );
    }

    // Log to sms_logs
    const recipients = result?.SMSMessageData?.Recipients || [];
    const firstRecipient = recipients[0];
    const status = firstRecipient?.status === "Success" ? "sent" : "failed";

    await supabase.from("sms_logs").insert({
      phone_number,
      message,
      client_id: client_id || null,
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      error_message: firstRecipient?.status !== "Success" ? firstRecipient?.status : null,
      provider: "africastalking",
    } as any);

    return new Response(
      JSON.stringify({
        success: status === "sent",
        message: "SMS sent via Africa's Talking",
        recipients: recipients.length,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[send_sms] Failed: ${errorMessage}`);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
