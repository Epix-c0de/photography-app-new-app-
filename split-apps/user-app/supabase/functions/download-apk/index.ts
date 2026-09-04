/**
 * download-apk — Returns signed URLs for all chunks of a specific APK version.
 *
 * GET /download-apk?id=<apk_version_id>
 *
 * Returns { chunked: boolean, chunkUrls: string[], downloadUrl: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type") || "client";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let apkRecord;
    if (id) {
      const { data } = await supabase
        .from("apk_versions")
        .select("*")
        .eq("id", id)
        .single();
      apkRecord = data;
    } else {
      const { data } = await supabase
        .from("apk_versions")
        .select("*")
        .eq("type", type)
        .eq("is_latest", true)
        .single();
      apkRecord = data;
    }

    if (!apkRecord) {
      return new Response(JSON.stringify({ error: "APK not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chunkCount = (apkRecord as any).chunk_count || 1;

    if (chunkCount <= 1) {
      const filePath = `${(apkRecord as any).storage_path}/chunk-0000`;
      const { data: signedUrl } = await supabase.storage
        .from("apk-files")
        .createSignedUrl(filePath, 3600);

      return new Response(
        JSON.stringify({
          chunked: false,
          downloadUrl: signedUrl?.signedUrl || "",
          version: (apkRecord as any).version,
          filename: (apkRecord as any).filename,
          fileSize: (apkRecord as any).file_size,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const chunkUrls: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkPath = `${(apkRecord as any).storage_path}/chunk-${String(i).padStart(4, "0")}`;
      const { data: signedUrl, error } = await supabase.storage
        .from("apk-files")
        .createSignedUrl(chunkPath, 3600);

      if (error) {
        return new Response(
          JSON.stringify({ error: `Failed to sign chunk ${i}: ${error.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      chunkUrls.push(signedUrl.signedUrl);
    }

    return new Response(
      JSON.stringify({
        chunked: true,
        chunkUrls,
        chunkCount,
        version: (apkRecord as any).version,
        filename: (apkRecord as any).filename,
        fileSize: (apkRecord as any).file_size,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
