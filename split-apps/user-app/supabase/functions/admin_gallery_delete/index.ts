import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not configured");
    }

    const keyToUse = serviceKey || anonKey;
    if (!keyToUse) {
      throw new Error("No Supabase key configured for Edge Function");
    }

    const adminClient = createClient(supabaseUrl, keyToUse);

    const { gallery_id } = await req.json();

    if (!gallery_id) {
      throw new Error("Missing gallery_id");
    }

    // 1. Get storage paths to delete
    const { data: photos } = await adminClient
      .from("gallery_photos")
      .select("photo_url, storage_path")
      .eq("gallery_id", gallery_id);

    const paths = (photos || []).map((p: any) => p.storage_path || p.photo_url).filter(Boolean);

    // 2. Delete storage files
    if (paths.length > 0) {
      await adminClient.storage.from("client-photos").remove(paths);
    }

    // 3. Delete from dependent tables (bypassing RLS via service role)
    await adminClient.from("notifications").delete().eq("gallery_id", gallery_id);
    await adminClient.from("gallery_views").delete().eq("gallery_id", gallery_id);
    await adminClient.from("gallery_delivery_status").delete().eq("gallery_id", gallery_id);
    await adminClient.from("unlocked_galleries").delete().eq("gallery_id", gallery_id);
    await adminClient.from("gallery_shares").delete().eq("gallery_id", gallery_id);
    await adminClient.from("upload_logs").delete().eq("gallery_id", gallery_id);
    await adminClient.from("upload_sessions").delete().eq("gallery_id", gallery_id);
    // Optional tables if present
    try { await adminClient.from("sms_logs").delete().eq("gallery_id", gallery_id); } catch {}
    try { await adminClient.from("events").delete().eq("gallery_id", gallery_id); } catch {}
    try { await adminClient.from("event_log").delete().eq("gallery_id", gallery_id); } catch {}
    
    // Set payments gallery_id to null instead of deleting payment history
    await adminClient.from("payments").update({ gallery_id: null }).eq("gallery_id", gallery_id);

    // 4. Delete gallery photos and gallery
    await adminClient.from("gallery_photos").delete().eq("gallery_id", gallery_id);
    const { error: deleteGalleryError } = await adminClient.from("galleries").delete().eq("id", gallery_id);

    if (deleteGalleryError) {
      throw deleteGalleryError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in admin_gallery_delete:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
