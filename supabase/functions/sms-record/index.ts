import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const phoneNumber = String(body?.phone_number ?? "").trim();
    const message = String(body?.message ?? "").trim();
    const status = String(body?.status ?? "").trim();
    const clientId = body?.client_id ? String(body.client_id) : null;
    const errorMessage = body?.error_message ? String(body.error_message) : null;
    const sentAt = body?.sent_at ? String(body.sent_at) : null;

    if (!phoneNumber || !message) {
      throw new Error("Missing phone_number or message");
    }
    if (!["queued", "sent", "failed"].includes(status)) {
      throw new Error("Invalid status");
    }

    let balanceAfter: number | null = null;
    if (status === "sent") {
      const { data, error } = await supabaseAdmin.rpc("decrement_sms_balance", { p_admin_id: user.id, p_amount: 1 });
      if (!error) {
        balanceAfter = typeof data === "number" ? data : null;
      }
    }

    const { error: logError } = await supabaseAdmin.from("sms_logs").insert({
      owner_admin_id: user.id,
      client_id: clientId,
      phone_number: phoneNumber,
      message,
      status,
      sent_at: status === "sent" ? sentAt ?? new Date().toISOString() : null,
      error_message: errorMessage,
    });
    if (logError) {
      throw new Error("Failed to write sms log");
    }

    return new Response(JSON.stringify({ ok: true, balance_after: balanceAfter }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

