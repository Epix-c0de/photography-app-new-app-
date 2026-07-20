import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle denied/error
    if (error) {
      const appDeepLink = `epixvisuals://social-callback?error=${error}`;
      return new Response(null, {
        status: 302,
        headers: { Location: appDeepLink },
      });
    }

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: "Missing code or state parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stateData = JSON.parse(atob(state));
    const { user_id, platform } = stateData;

    if (!user_id || !platform) {
      return new Response(
        JSON.stringify({ error: "Invalid state parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    let accessToken = "";
    let profileId = "";
    let profileName = "";
    let profileUrl = "";

    if (platform === "instagram" || platform === "facebook") {
      const fbAppId = config.facebook_app_id;
      const fbAppSecret = config.facebook_app_secret;

      if (!fbAppId || !fbAppSecret) {
        return new Response(
          JSON.stringify({ error: "Facebook credentials not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenResponse = await fetch(
        `https://graph.facebook.com/v17.0/oauth/access_token?client_id=${fbAppId}&redirect_uri=${encodeURIComponent(callbackBase)}&client_secret=${fbAppSecret}&code=${code}`
      );
      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return new Response(
          JSON.stringify({ error: tokenData.error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = tokenData.access_token;

      if (platform === "instagram") {
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v17.0/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`
        );
        const pagesData = await pagesResponse.json();

        const page = pagesData.data?.find((p: any) => p.instagram_business_account);
        if (!page) {
          const appDeepLink = `epixvisuals://social-callback?error=no_ig_account`;
          return new Response(null, {
            status: 302,
            headers: { Location: appDeepLink },
          });
        }

        profileId = page.instagram_business_account.id;
        profileName = page.name;
        profileUrl = `https://instagram.com/${page.name}`;

        const igResponse = await fetch(
          `https://graph.facebook.com/v17.0/${profileId}?fields=username,name&access_token=${accessToken}`
        );
        const igData = await igResponse.json();
        if (igData.username) {
          profileName = igData.username;
          profileUrl = `https://instagram.com/${igData.username}`;
        }
      } else {
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v17.0/me/accounts?fields=id,name&access_token=${accessToken}`
        );
        const pagesData = await pagesResponse.json();

        if (!pagesData.data?.length) {
          const appDeepLink = `epixvisuals://social-callback?error=no_fb_page`;
          return new Response(null, {
            status: 302,
            headers: { Location: appDeepLink },
          });
        }

        profileId = pagesData.data[0].id;
        profileName = pagesData.data[0].name;
        profileUrl = `https://facebook.com/${profileId}`;
        accessToken = `${accessToken}|${fbAppSecret}`;
      }
    } else if (platform === "tiktok") {
      const tiktokKey = config.tiktok_client_key;
      const tiktokSecret = config.tiktok_client_secret;

      if (!tiktokKey || !tiktokSecret) {
        return new Response(
          JSON.stringify({ error: "TikTok credentials not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: tiktokKey,
          client_secret: tiktokSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: callbackBase,
        }),
      });
      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return new Response(
          JSON.stringify({ error: tokenData.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = tokenData.data.access_token;

      const userResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,username", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await userResponse.json();
      profileId = userData.data?.user?.open_id || "";
      profileName = userData.data?.user?.username || "";
      profileUrl = `https://tiktok.com/@${userData.data?.user?.username || ""}`;
    }

    // Store or update the connection
    const { data: existing } = await supabase
      .from("social_connections")
      .select("id")
      .eq("photographer_id", user_id)
      .eq("platform", platform)
      .single();

    if (existing) {
      await supabase
        .from("social_connections")
        .update({
          access_token: accessToken,
          profile_id: profileId,
          profile_name: profileName,
          profile_url: profileUrl,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("social_connections").insert({
        photographer_id: user_id,
        platform,
        access_token: accessToken,
        profile_id: profileId,
        profile_name: profileName,
        profile_url: profileUrl,
        is_active: true,
      });
    }

    // Redirect back to app with success
    const appDeepLink = `epixvisuals://social-callback?success=true&platform=${platform}`;
    return new Response(null, {
      status: 302,
      headers: { Location: appDeepLink },
    });

  } catch (error) {
    console.error("social-callback error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Callback failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
