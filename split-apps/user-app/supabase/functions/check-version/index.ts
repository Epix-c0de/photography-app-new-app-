/**
 * check-version — Returns the latest app version info for in-app update checks.
 *
 * GET /check-version
 *
 * Reads from the `apk_versions` table (latest row per type).
 * Falls back to `app_versions` table or hardcoded defaults.
 * Reads minimum_version and force_update from `app_versions` if available.
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

    // Read version config from app_versions (for minimum_version, force_update, version_history)
    const { data: versionConfig } = await supabase
      .from("app_versions")
      .select("*")
      .eq("id", "current")
      .single();

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
        const filePath = `${(apkData as any).storage_path}/chunk-0000`;
        const { data: signedUrl } = await supabase.storage
          .from("apk-files")
          .createSignedUrl(filePath, 3600);
        downloadUrl = signedUrl?.signedUrl || "";
      } else {
        // Chunked — use landing page metadata API for client-side assembly
        downloadUrl = `https://epix-visuals.vercel.app/api/apk/download?type=client&action=metadata`;
      }

      // Use app_versions settings if available, otherwise defaults
      const minimumVersion = versionConfig?.minimum_version || "1.0.0";
      const forceUpdate = versionConfig?.force_update ?? false;
      const versionHistory = versionConfig?.version_history ?? [];

      return new Response(
        JSON.stringify({
          latestVersion: apkData.version,
          minimumVersion,
          forceUpdate,
          releaseNotes: apkData.changelog || `Version ${apkData.version}`,
          downloadUrl,
          fileSize: apkData.file_size
            ? `~${Math.round((apkData.file_size as number) / (1024 * 1024))} MB`
            : undefined,
          provider: "apk-direct",
          publishedAt: apkData.created_at,
          versionHistory,
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
    if (versionConfig) {
      return new Response(
        JSON.stringify({
          latestVersion: versionConfig.latest_version,
          minimumVersion: versionConfig.minimum_version,
          forceUpdate: versionConfig.force_update,
          releaseNotes: versionConfig.release_notes,
          downloadUrl: versionConfig.download_url,
          fileSize: versionConfig.file_size,
          sha256: versionConfig.sha256,
          provider: versionConfig.provider ?? "apk-direct",
          publishedAt: versionConfig.published_at,
          versionHistory: versionConfig.version_history ?? [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.warn("[check-version] Falling back to static config");
    return new Response(JSON.stringify(FALLBACK_CONFIG), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[check-version] Error:", err);
    return new Response(JSON.stringify(FALLBACK_CONFIG), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
