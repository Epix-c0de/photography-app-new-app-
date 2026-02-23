import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const applyTemplate = (template: string, data: Record<string, string>) => {
  return template.replace(/\{(\w+)\}/g, (_, key) => data[key] ?? `{${key}}`);
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      throw new Error("Forbidden");
    }

    const body = await req.json();
    const { gallery_id, message_template } = body ?? {};
    if (!gallery_id || !message_template) {
      throw new Error("Missing required fields");
    }

    const { data: gallery, error: galleryError } = await adminClient
      .from("galleries")
      .select("id, client_id, client_name, client_phone, access_code, owner_admin_id")
      .eq("id", gallery_id)
      .maybeSingle();
    if (galleryError || !gallery) {
      throw new Error("Gallery not found");
    }

    const phone = gallery.client_phone;
    if (!phone) {
      throw new Error("Client phone missing");
    }

    const message = applyTemplate(String(message_template), {
      client_name: gallery.client_name || "Client",
      access_code: gallery.access_code || "",
    });

    const { data: smsLog, error: smsLogError } = await adminClient
      .from("sms_logs")
      .insert({
        gallery_id: gallery.id,
        client_id: gallery.client_id,
        client_phone: phone,
        message_body: message,
        sent_by_admin_id: user.id,
        delivery_status: "queued",
        fallback_whatsapp_triggered: false,
      })
      .select("id")
      .single();
    if (smsLogError || !smsLog) {
      throw new Error("Failed to log SMS");
    }

    const { data: smsResponse, error: smsError } = await adminClient.functions.invoke("send_sms", {
      body: { phoneNumber: phone, message },
    });

    const sent = !smsError && smsResponse?.success;
    await adminClient
      .from("sms_logs")
      .update({
        delivery_status: sent ? "sent" : "failed",
        fallback_whatsapp_triggered: sent ? false : true,
      })
      .eq("id", smsLog.id);

    await adminClient.rpc("emit_event", {
      p_event_name: "SMS_SENT",
      p_payload: { gallery_id: gallery.id, status: sent ? "sent" : "failed" },
      p_gallery_id: gallery.id,
      p_client_id: gallery.client_id,
      p_admin_id: user.id,
    });

    if (!sent) {
      throw new Error(smsError?.message || "SMS failed");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
