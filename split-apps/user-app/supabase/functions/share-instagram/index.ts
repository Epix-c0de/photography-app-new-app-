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

    const { image_url, caption, bts_id, gallery_id } = await req.json();

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

    // Get Instagram connection
    const { data: connection, error: connError } = await supabase
      .from("social_connections")
      .select("*")
      .eq("photographer_id", user.id)
      .eq("platform", "instagram")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "Instagram not connected. Please connect your Instagram account first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      // Refresh token
      const { data: refreshed, error: refreshError } = await supabase.functions.invoke(
        "refresh-instagram-token",
        {
          body: { connection_id: connection.id },
        }
      );

      if (refreshError || !refreshed?.success) {
        return new Response(
          JSON.stringify({ error: "Instagram token expired. Please reconnect your account." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Post to Instagram using Graph API
    // Step 1: Create media container
    const createContainerResponse = await fetch(
      `https://graph.facebook.com/v17.0/${connection.profile_id}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: image_url,
          caption: caption || "Check out this amazing shot! 📸 #EpixVisuals #Photography",
          access_token: connection.access_token,
        }),
      }
    );

    const containerResult = await createContainerResponse.json();

    if (containerResult.error) {
      // Log failed share
      await supabase.from("social_shares").insert({
        photographer_id: user.id,
        bts_id: bts_id || null,
        gallery_id: gallery_id || null,
        platform: "instagram",
        caption: caption,
        status: "failed",
        error_message: containerResult.error.message,
      });

      return new Response(
        JSON.stringify({ error: containerResult.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Publish container
    const publishResponse = await fetch(
      `https://graph.facebook.com/v17.0/${connection.profile_id}/media_publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creation_id: containerResult.id,
          access_token: connection.access_token,
        }),
      }
    );

    const publishResult = await publishResponse.json();

    if (publishResult.error) {
      await supabase.from("social_shares").insert({
        photographer_id: user.id,
        bts_id: bts_id || null,
        gallery_id: gallery_id || null,
        platform: "instagram",
        caption: caption,
        status: "failed",
        error_message: publishResult.error.message,
      });

      return new Response(
        JSON.stringify({ error: publishResult.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful share
    await supabase.from("social_shares").insert({
      photographer_id: user.id,
      bts_id: bts_id || null,
      gallery_id: gallery_id || null,
      platform: "instagram",
      post_id: publishResult.id,
      post_url: `https://www.instagram.com/p/${publishResult.id}/`,
      caption: caption,
      status: "posted",
      posted_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        post_id: publishResult.id,
        post_url: `https://www.instagram.com/p/${publishResult.id}/`,
        message: "Posted to Instagram successfully!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Instagram share error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to share to Instagram" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
