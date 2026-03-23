import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "video/mp4",
  "video/quicktime",
  "video/mov"
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for BTS videos

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body = await req.json();
    const { bts_id, file_name, file_size, mime_type } = body ?? {};
    if (!bts_id || !file_name || !file_size || !mime_type) {
      throw new Error("Missing required fields: bts_id, file_name, file_size, mime_type");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile || !["admin", "super_admin"].includes(profile.role)) {
      throw new Error("Forbidden: Admin access required");
    }

    // Validate file type and size
    if (!ALLOWED_MIME_TYPES.has(String(mime_type))) {
      throw new Error(`Invalid file type: ${mime_type}. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`);
    }
    if (Number(file_size) > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${file_size} bytes. Max allowed: ${MAX_FILE_SIZE} bytes`);
    }

    // Verify BTS post exists and belongs to admin
    const { data: btsPost, error: postError } = await adminClient
      .from("bts_posts")
      .select("id, created_by, media_url")
      .eq("id", bts_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (postError || !btsPost) {
      throw new Error("BTS post not found or access denied");
    }

    // Check if media already exists
    if (btsPost.media_url) {
      throw new Error("BTS post already has media attached");
    }

    // Generate storage path: bts/{bts_id}/{file_uuid}.{ext}
    const fileUuid = crypto.randomUUID();
    const fileExtension = file_name.split('.').pop()?.toLowerCase() || 'jpg';
    const storagePath = `bts/${bts_id}/${fileUuid}.${fileExtension}`;

    // Create signed upload URL with longer expiry
    const storageBucket = adminClient.storage.from("bts-media");
    const { data: signedUrlData, error: signedError } = await storageBucket
      .createSignedUploadUrl(storagePath, {
        upsert: false,
        expires_in: 1800
      });

    if (signedError || !signedUrlData?.signedUrl) {
      throw new Error("Failed to generate upload URL");
    }

    return new Response(
      JSON.stringify({
        upload_url: signedUrlData.signedUrl,
        storage_path: storagePath,
        file_uuid: fileUuid,
        expires_in: 600,
        bts_id: bts_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_bts_upload_media error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
