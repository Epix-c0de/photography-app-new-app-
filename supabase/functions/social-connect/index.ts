import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { platform } = await req.json();

    // Get current user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read OAuth credentials from platform_settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "facebook_app_id",
        "facebook_app_secret",
        "tiktok_client_key",
        "tiktok_client_secret",
      ]);

    const config: Record<string, string> = {};
    if (settings) {
      settings.forEach((s: any) => { config[s.key] = s.value || ""; });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const callbackBase = `${supabaseUrl}/functions/v1/social-callback`;
    const state = btoa(JSON.stringify({ user_id: user.id, platform }));

    let authUrl = "";

    if (platform === "instagram") {
      const fbAppId = config.facebook_app_id;
      if (!fbAppId) {
        return new Response(
          JSON.stringify({ error: "Facebook App ID not configured. Ask admin to set up Social OAuth in settings." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const scopes = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement";
      authUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${fbAppId}&redirect_uri=${encodeURIComponent(callbackBase)}&scope=${scopes}&state=${state}&response_type=code`;
    } else if (platform === "facebook") {
      const fbAppId = config.facebook_app_id;
      if (!fbAppId) {
        return new Response(
          JSON.stringify({ error: "Facebook App ID not configured. Ask admin to set up Social OAuth in settings." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const scopes = "pages_manage_posts,pages_show_list,pages_read_engagement";
      authUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${fbAppId}&redirect_uri=${encodeURIComponent(callbackBase)}&scope=${scopes}&state=${state}&response_type=code`;
    } else if (platform === "tiktok") {
      const tiktokKey = config.tiktok_client_key;
      if (!tiktokKey) {
        return new Response(
          JSON.stringify({ error: "TikTok Client Key not configured. Ask admin to set up Social OAuth in settings." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const scopes = "user.info.basic,video.publish";
      authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${tiktokKey}&redirect_uri=${encodeURIComponent(callbackBase)}&scope=${scopes}&state=${state}&response_type=code`;
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported platform" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ url: authUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("social-connect error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate auth URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
