import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_SIZE = Number(Deno.env.get("UPLOAD_MAX_BYTES") ?? "104857600"); // 100MB
const CHUNK_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/tif",
  "image/gif",
  "image/bmp",
  "image/x-adobe-dng",
  "image/x-canon-cr2",
  "image/x-canon-cr3",
  "image/x-nikon-nef",
  "image/x-sony-arw",
  "image/x-fuji-raf",
  "image/x-olympus-orf",
  "image/x-panasonic-rw2",
  "image/x-pentax-pef",
  "application/octet-stream",
  "video/mp4",
  "video/quicktime",
  "video/mov"
]);

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
    const { session_id, file_name, file_size, mime_type, checksum } = body ?? {};
    if (!session_id || !file_name || !mime_type) {
      throw new Error(`Missing required fields. Got: session_id=${!!session_id}, file_name=${!!file_name}, mime_type=${!!mime_type}`);
    }
    // file_size can be 0 for unknown sizes — default to treating it as valid
    const resolvedFileSize = Number(file_size) || 0;
    // Normalize mime type — default unknown to image/jpeg rather than blocking
    const normalizedMime = ALLOWED_MIME_TYPES.has(String(mime_type)) ? mime_type : 'image/jpeg';

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

    // File size check (skip if 0/unknown)
    if (resolvedFileSize > 0 && resolvedFileSize > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${resolvedFileSize} bytes. Max allowed: ${MAX_FILE_SIZE} bytes (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)`);
    }

    // Verify upload session and get session details
    const { data: session, error: sessionError } = await adminClient
      .from("upload_sessions")
      .select("id, gallery_id, admin_id, client_id, status, total_files, uploaded_files")
      .eq("id", session_id)
      .eq("admin_id", user.id)
      .maybeSingle();

    if (sessionError || !session) {
      throw new Error("Upload session not found or access denied");
    }
    if (!['active', 'initializing', 'uploading'].includes(session.status)) {
      throw new Error(`Session is not active: ${session.status}`);
    }

    // Check for duplicate checksum
    if (checksum) {
      const { data: existingFile } = await adminClient
        .from("gallery_photos")
        .select("id")
        .eq("gallery_id", session.gallery_id)
        .eq("checksum", checksum)
        .maybeSingle();

      if (existingFile) {
        throw new Error("Duplicate file detected - file with same checksum already exists in gallery");
      }
    }

    // Generate unique file ID and storage path following convention: /clients/{client_id}/galleries/{gallery_id}/{file_uuid}.{ext}
    const fileUuid = crypto.randomUUID();
    const fileExtension = file_name.split('.').pop()?.toLowerCase() || 'jpg';
    const storagePath = `clients/${session.client_id}/galleries/${session.gallery_id}/${fileUuid}.${fileExtension}`;

    // Determine if file needs special handling (just log for now)
    const needsChunking = Number(file_size) > CHUNK_SIZE_THRESHOLD;
    if (needsChunking) {
      console.log(`Large file detected: ${file_size} bytes - client should handle chunking`);
    }

    // Transition to uploading status if initializing
    if (session.status === 'initializing') {
      await adminClient
        .from("upload_sessions")
        .update({ status: 'uploading' })
        .eq("id", session_id);
    }

    // Create signed upload URL (Supabase handles large files via signed URLs)
    const storageBucket = adminClient.storage.from("client-photos");
    const { data: signedUrlData, error: signedError } = await storageBucket
      .createSignedUploadUrl(storagePath);

    if (signedError || !signedUrlData?.signedUrl) {
      throw new Error("Failed to generate upload URL");
    }

    // Log upload attempt
    await adminClient.from("upload_logs").insert({
      session_id: session_id,
      gallery_id: session.gallery_id,
      file_name: file_name,
      storage_path: storagePath,
      file_size: resolvedFileSize,
      mime_type: normalizedMime,
      checksum: checksum || null,
      status: "upload_url_generated",
      message: `Upload URL generated for ${normalizedMime}${needsChunking ? ` (large: ${resolvedFileSize} bytes)` : ''}`
    });

    return new Response(
      JSON.stringify({
        upload_url: signedUrlData.signedUrl,
        storage_path: storagePath,
        file_uuid: fileUuid,
        expires_in: 600,
        needs_chunking: needsChunking,
        recommended_chunk_size: CHUNK_SIZE_THRESHOLD
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_upload_file error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
