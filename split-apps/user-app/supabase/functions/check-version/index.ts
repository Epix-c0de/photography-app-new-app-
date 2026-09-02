/**
 * check-version — Returns the latest app version info for in-app update checks.
 *
 * GET /check-version
 *
 * Reads from the `apk_versions` table (latest row per type).
 * Falls back to `app_versions` table or hardcoded defaults.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=300, s-maxage=300",
};

const FALLBACK_CONFIG = {
  latestVersion: "1.0.0",
  minimumVersion: "1.0.0",
  forceUpdate: false,
  releaseNotes: "Welcome to Epix Visuals Studios.co!",
  downloadUrl: "https://epix-visuals.vercel.app/download",
  fileSize: "~25 MB",
  provider: "apk-direct",
  publishedAt: new Date().toISOString(),
  versionHistory: [],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try apk_versions table first (new APK management)
    const { data: apkData } = await supabase
      .from("apk_versions")
      .select("*")
      .eq("type", "client")
      .eq("is_latest", true)
      .single();

    if (apkData) {
      const chunkCount = (apkData as any).chunk_count || 1;
      let downloadUrl = "";

      if (chunkCount <= 1) {
        // Single file — create signed URL
        const { data: signedUrl } = await supabase.storage
          .from("apk-files")
          .createSignedUrl((apkData as any).storage_path, 3600);
        downloadUrl = signedUrl?.signedUrl || "";
      } else {
        // Chunked — use landing page download API which streams all chunks as one file
        downloadUrl = `https://epix-visuals.vercel.app/api/apk/download?id=${apkData.id}`;
      }

      return new Response(
        JSON.stringify({
          latestVersion: apkData.version,
          minimumVersion: "1.0.0",
          forceUpdate: false,
          releaseNotes: apkData.changelog || `Version ${apkData.version}`,
          downloadUrl,
          fileSize: apkData.file_size
            ? `~${Math.round((apkData.file_size as number) / (1024 * 1024))} MB`
            : undefined,
          provider: "apk-direct",
          publishedAt: apkData.created_at,
          versionHistory: [],
          chunked: chunkCount > 1,
          chunkCount,
          storagePath: (apkData as any).storage_path,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fallback to app_versions table
    const { data, error } = await supabase
      .from("app_versions")
      .select("*")
      .eq("id", "current")
      .single();

    if (error || !data) {
      console.warn("[check-version] Falling back to static config:", error?.message);
      return new Response(JSON.stringify(FALLBACK_CONFIG), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        latestVersion: data.latest_version,
        minimumVersion: data.minimum_version,
        forceUpdate: data.force_update,
        releaseNotes: data.release_notes,
        downloadUrl: data.download_url,
        fileSize: data.file_size,
        sha256: data.sha256,
        provider: data.provider ?? "apk-direct",
        publishedAt: data.published_at,
        versionHistory: data.version_history ?? [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[check-version] Error:", err);
    return new Response(JSON.stringify(FALLBACK_CONFIG), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
