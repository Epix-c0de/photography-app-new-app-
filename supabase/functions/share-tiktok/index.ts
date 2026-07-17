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

    const { video_url, caption, bts_id, gallery_id } = await req.json();

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

    const { data: connection, error: connError } = await supabase
      .from("social_connections")
      .select("*")
      .eq("photographer_id", user.id)
      .eq("platform", "tiktok")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "TikTok not connected. Please connect your TikTok account first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TikTok video publishing uses direct upload via their API
    // Step 1: Init video upload
    const initResponse = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.access_token}`,
      },
      body: JSON.stringify({
        post_info: {
          title: caption || "Check out this shot! #EpixVisuals #Photography",
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: 0,
        },
      }),
    });

    const initData = await initResponse.json();

    if (initData.error) {
      await supabase.from("social_shares").insert({
        photographer_id: user.id,
        bts_id: bts_id || null,
        gallery_id: gallery_id || null,
        platform: "tiktok",
        caption: caption,
        status: "failed",
        error_message: initData.error.message || initData.error,
      });

      return new Response(
        JSON.stringify({ error: initData.error.message || "Failed to initialize TikTok upload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uploadUrl = initData.data?.upload_url;
    const publishId = initData.data?.publish_id;

    if (!uploadUrl || !publishId) {
      await supabase.from("social_shares").insert({
        photographer_id: user.id,
        bts_id: bts_id || null,
        gallery_id: gallery_id || null,
        platform: "tiktok",
        caption: caption,
        status: "failed",
        error_message: "No upload URL returned",
      });

      return new Response(
        JSON.stringify({ error: "Failed to get upload URL from TikTok" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Download video and upload to TikTok
    const videoResponse = await fetch(video_url);
    if (!videoResponse.ok) {
      await supabase.from("social_shares").insert({
        photographer_id: user.id,
        bts_id: bts_id || null,
        gallery_id: gallery_id || null,
        platform: "tiktok",
        caption: caption,
        status: "failed",
        error_message: "Failed to download video",
      });

      return new Response(
        JSON.stringify({ error: "Failed to download video" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const videoBlob = await videoResponse.blob();

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
      },
      body: videoBlob,
    });

    if (!uploadResponse.ok) {
      await supabase.from("social_shares").insert({
        photographer_id: user.id,
        bts_id: bts_id || null,
        gallery_id: gallery_id || null,
        platform: "tiktok",
        caption: caption,
        status: "failed",
        error_message: "Failed to upload video to TikTok",
      });

      return new Response(
        JSON.stringify({ error: "Failed to upload video to TikTok" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful share
    await supabase.from("social_shares").insert({
      photographer_id: user.id,
      bts_id: bts_id || null,
      gallery_id: gallery_id || null,
      platform: "tiktok",
      post_id: publishId,
      post_url: `https://tiktok.com/@${connection.profile_name}/video/${publishId}`,
      caption: caption,
      status: "posted",
      posted_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        post_id: publishId,
        message: "Posted to TikTok successfully!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("TikTok share error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to share to TikTok" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
