// @ts-nocheck
/**
 * generate_video_thumbnail — Supabase Edge Function
 *
 * Accepts: POST { videoUrl, postId, type }
 *   - type: 'bts' | 'announcement' | 'portfolio'
 *
 * Pipeline:
 *  1. Download the video from its public url
 *  2. Run FFmpeg via Deno.Command to extract the frame at 1.000s
 *     ffmpeg -i pipe:0 -ss 00:00:01.000 -vframes 1 -f image2pipe -vcodec mjpeg -
 *  3. Upload the .jpg to the 'media' bucket at thumbnails/<name>.jpg
 *  4. Write the public URL to the post's video_thumbnail_url column
 *  5. Return { success, thumbnailUrl }
 *
 * The front-end should NOT block on this call — fire and forget,
 * then show a "Processing video…" skeleton until the thumbnail appears.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  // Handle CORS pre-flight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: corsHeaders,
    });
  }

  try {
    const { videoUrl, postId, type } = await req.json();

    if (!videoUrl || !postId || !type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: videoUrl, postId, type" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Thumbnail] Processing ${type} video for post ${postId}`);

    // ── 1. Download the video ────────────────────────────────
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Could not download video: ${videoRes.status} ${videoRes.statusText}`);
    }
    const videoBytes = new Uint8Array(await videoRes.arrayBuffer());
    console.log(`[Thumbnail] Downloaded ${videoBytes.byteLength} bytes`);

    // ── 2. FFmpeg: extract frame at 1.000 s ─────────────────
    // ffmpeg -i pipe:0 -ss 00:00:01.000 -vframes 1 -f image2pipe -vcodec mjpeg -
    const ffmpegCmd = new Deno.Command("ffmpeg", {
      args: [
        "-i",       "pipe:0",
        "-ss",      "00:00:01.000",
        "-vframes", "1",
        "-f",       "image2pipe",
        "-vcodec",  "mjpeg",
        "pipe:1",
      ],
      stdin:  "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const ffmpegProcess = ffmpegCmd.spawn();

    // Write video bytes to stdin and close
    const writer = ffmpegProcess.stdin.getWriter();
    await writer.write(videoBytes);
    await writer.close();

    // Collect stdout (JPEG bytes) and stderr (FFmpeg logs)
    const { stdout: jpegBytes, stderr: ffmpegLog, success } = await ffmpegProcess.output();

    if (!success || jpegBytes.byteLength === 0) {
      const log = new TextDecoder().decode(ffmpegLog);
      console.error("[Thumbnail] FFmpeg failed:", log.slice(-800));
      throw new Error("FFmpeg did not produce output. Is FFmpeg available in this Supabase runtime?");
    }

    console.log(`[Thumbnail] Frame extracted — ${jpegBytes.byteLength} bytes`);

    // ── 3. Upload JPEG to Supabase Storage ──────────────────
    const thumbnailPath = `thumbnails/${type}_${postId}_${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(thumbnailPath, jpegBytes, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from("media")
      .getPublicUrl(thumbnailPath);

    console.log(`[Thumbnail] Uploaded to ${publicUrl}`);

    // ── 4. Write thumbnail URL to the post row ───────────────
    const tableMap: Record<string, string> = {
      bts:          "bts_posts",
      announcement: "announcements",
      portfolio:    "portfolio_items",
    };
    const tableName = tableMap[type];
    if (!tableName) throw new Error(`Unknown post type: ${type}`);

    const { error: updateError } = await supabase
      .from(tableName)
      .update({ video_thumbnail_url: publicUrl })
      .eq("id", postId);

    if (updateError) {
      // Non-fatal: log and continue (column may not exist on older schema)
      console.warn(`[Thumbnail] DB update warning: ${updateError.message}`);
    }

    console.log(`[Thumbnail] ✓ Done — post ${postId}`);

    // ── 5. Return result ─────────────────────────────────────
    return new Response(
      JSON.stringify({ success: true, thumbnailUrl: publicUrl, postId, type }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Thumbnail] ✗ Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
