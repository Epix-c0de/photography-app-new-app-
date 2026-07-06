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

    const { image_url, message, bts_id, gallery_id } = await req.json();

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

    // Get Facebook connection
    const { data: connection, error: connError } = await supabase
      .from("social_connections")
      .select("*")
      .eq("photographer_id", user.id)
      .eq("platform", "facebook")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "Facebook not connected. Please connect your Facebook page first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      const { data: refreshed, error: refreshError } = await supabase.functions.invoke(
        "refresh-facebook-token",
        {
          body: { connection_id: connection.id },
        }
      );

      if (refreshError || !refreshed?.success) {
        return new Response(
          JSON.stringify({ error: "Facebook token expired. Please reconnect your page." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Post to Facebook Page using Graph API
    const postResponse = await fetch(
      `https://graph.facebook.com/v17.0/${connection.profile_id}/photos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: image_url,
          message: message || "Check out this amazing shot! 📸 #EpixVisuals #Photography",
          access_token: connection.access_token,
        }),
      }
    );

    const postResult = await postResponse.json();

    if (postResult.error) {
      await supabase.from("social_shares").insert({
        photographer_id: user.id,
        bts_id: bts_id || null,
        gallery_id: gallery_id || null,
        platform: "facebook",
        caption: message,
        status: "failed",
        error_message: postResult.error.message,
      });

      return new Response(
        JSON.stringify({ error: postResult.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful share
    await supabase.from("social_shares").insert({
      photographer_id: user.id,
      bts_id: bts_id || null,
      gallery_id: gallery_id || null,
      platform: "facebook",
      post_id: postResult.id,
      post_url: `https://www.facebook.com/${connection.profile_id}/posts/${postResult.id}`,
      caption: message,
      status: "posted",
      posted_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        post_id: postResult.id,
        post_url: `https://www.facebook.com/${connection.profile_id}/posts/${postResult.id}`,
        message: "Posted to Facebook successfully!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Facebook share error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to share to Facebook" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
