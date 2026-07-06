import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const APP_STORE_URL = "https://apps.apple.com/app/epix-visuals/id6449494080";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=ke.co.epix.visuals";
const DEEP_LINK_SCHEME = "epixvisuals://";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Extract token from path like /r/ABC123def_45 or https://domain/r/ABC123def_45
    const pathMatch = url.pathname.match(/\/r\/([A-Za-z0-9_-]{12})/);
    const token = pathMatch ? pathMatch[1] : null;

    if (!token || token.length !== 12) {
      return new Response(
        JSON.stringify({ error: "Invalid referral token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Look up the referral by token
    const { data: referral, error: referralError } = await supabase
      .from("referrals")
      .select("referral_token, admin_id, referral_code")
      .eq("referral_token", token)
      .single();

    if (referralError || !referral) {
      // Fallback: redirect to base app
      const { data: platformUrl } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "platform_base_url")
        .maybeSingle();

      const baseUrl = platformUrl?.value || "https://epixvisuals.co.ke";
      return Response.redirect(`${baseUrl}/signup`, 302);
    }

    // Record the click for analytics
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    await supabase.from("referral_clicks").insert({
      referral_token: token,
      admin_id: referral.admin_id,
      ip_address: ip,
      user_agent: userAgent,
      converted: false,
    });

    // Get platform base URL
    const { data: platformUrl } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "platform_base_url")
      .maybeSingle();

    const baseUrl = platformUrl?.value || "https://epixvisuals.co.ke";

    // Detect user agent for platform-specific redirects
    const ua = (userAgent || "").toLowerCase();
    const isIOS = ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod");
    const isAndroid = ua.includes("android");

    // Try deep link first (for installed app), fall back to store
    const deepLinkUrl = `${DEEP_LINK_SCHEME}signup?ref=${referral.referral_code}`;
    const storeUrl = isIOS ? APP_STORE_URL : isAndroid ? PLAY_STORE_URL : `${baseUrl}/signup?ref=${referral.referral_code}`;
    const webFallbackUrl = `${baseUrl}/signup?ref=${referral.referral_code}`;

    // Build HTML response that tries deep link, falls back to store/web
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Join Epix Visuals</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #080810; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { text-align: center; padding: 2rem; max-width: 400px; }
    .logo { font-size: 2rem; font-weight: 800; margin-bottom: 1rem; color: #D4AF37; }
    .subtitle { color: #888; margin-bottom: 2rem; }
    .btn { display: block; width: 100%; padding: 1rem; border-radius: 12px; font-size: 1rem; font-weight: 600; text-decoration: none; margin-bottom: 0.75rem; transition: transform 0.2s; }
    .btn:active { transform: scale(0.98); }
    .btn-primary { background: linear-gradient(135deg, #D4AF37, #F0D060); color: #080810; }
    .btn-secondary { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
    .referral-badge { background: rgba(212,175,55,0.15); color: #D4AF37; padding: 0.5rem 1rem; border-radius: 8px; display: inline-block; font-size: 0.875rem; font-weight: 600; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Epix Visuals</div>
    <div class="referral-badge">Referred by a friend</div>
    <p class="subtitle">Join Epix Visuals Studios and get started with professional photography services.</p>
    <a class="btn btn-primary" id="open-app" href="${deepLinkUrl}">Open in App</a>
    <a class="btn btn-secondary" id="store-link" href="${storeUrl}">Download App</a>
    <a class="btn btn-secondary" href="${webFallbackUrl}">Continue in Browser</a>
  </div>
  <script>
    // Try to open deep link, then redirect to store after timeout
    var deepLink = "${deepLinkUrl}";
    var storeUrl = "${storeUrl}";
    window.location.href = deepLink;
    setTimeout(function() {
      window.location.href = storeUrl;
    }, 2500);
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Referral redirect error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
