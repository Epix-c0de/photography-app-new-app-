/**
 * check-version — Returns the latest app version info for in-app update checks.
 *
 * GET /check-version
 *
 * Reads from the `app_versions` table (single row with id = 'current').
 * Falls back to hardcoded defaults if the table doesn't exist yet.
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

// Fallback if the table doesn't exist yet
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

    const { data, error } = await supabase
      .from("app_versions")
      .select("*")
      .eq("id", "current")
      .single();

    if (error || !data) {
      // Table might not exist yet — return fallback
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
