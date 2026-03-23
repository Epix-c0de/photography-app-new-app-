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
    const { session_id, storage_path, file_name, file_size, mime_type, checksum, file_uuid } = body ?? {};
    if (!session_id || !storage_path || !file_name || !file_size || !mime_type || !file_uuid) {
      throw new Error("Missing required fields: session_id, storage_path, file_name, file_size, mime_type, file_uuid");
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

    // Validate file type
    if (!ALLOWED_MIME_TYPES.has(String(mime_type))) {
      throw new Error(`Invalid file type: ${mime_type}. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`);
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

    // Verify file exists in storage
    const storageBucket = adminClient.storage.from("client-photos");
    const { data: fileList, error: listError } = await storageBucket
      .list(storage_path.split('/').slice(0, -1).join('/'), {
        search: storage_path.split('/').pop(),
        limit: 1
      });

    if (listError || !fileList || fileList.length === 0) {
      // Log verification failure
      await adminClient.from("upload_logs").insert({
        session_id: session_id,
        gallery_id: session.gallery_id,
        file_name: file_name,
        storage_path: storage_path,
        status: "verification_failed",
        message: "File not found in storage"
      });
      throw new Error("File verification failed: file not found in storage");
    }

    // Check file size matches
    const fileInfo = fileList[0];
    if (fileInfo.metadata?.size && Number(fileInfo.metadata.size) !== Number(file_size)) {
      await adminClient.from("upload_logs").insert({
        session_id: session_id,
        gallery_id: session.gallery_id,
        file_name: file_name,
        storage_path: storage_path,
        status: "verification_failed",
        message: `Size mismatch: expected ${file_size}, got ${fileInfo.metadata.size}`
      });
      throw new Error("File verification failed: size mismatch");
    }

    // Insert photo record into gallery_photos table
    const { data: photoRecord, error: photoError } = await adminClient
      .from("gallery_photos")
      .insert({
        gallery_id: session.gallery_id,
        file_name: file_name,
        photo_url: storage_path, // Actual column name in migration
        storage_path: storage_path, // New redundant column for compatibility with Edges
        file_size: file_size,
        mime_type: mime_type,
        checksum: checksum || null,
        uploaded_by: user.id,
        upload_session_id: session_id
      })
      .select('id')
      .single();

    if (photoError) {
      await adminClient.from("upload_logs").insert({
        session_id: session_id,
        gallery_id: session.gallery_id,
        file_name: file_name,
        storage_path: storage_path,
        status: "db_insert_failed",
        message: photoError.message
      });
      throw new Error(`Database insertion failed: ${photoError.message}`);
    }

    // Update session progress and status
    const newUploadedCount = (session.uploaded_files || 0) + 1;
    const updateData: any = {
      uploaded_files: newUploadedCount,
      updated_at: new Date().toISOString()
    };
    if (session.status === 'initializing') {
      updateData.status = 'uploading';
    }

    await adminClient
      .from("upload_sessions")
      .update(updateData)
      .eq("id", session_id);

    // Log successful confirmation
    await adminClient.from("upload_logs").insert({
      session_id: session_id,
      gallery_id: session.gallery_id,
      file_name: file_name,
      storage_path: storage_path,
      status: "confirmed",
      message: "File verified and database record created"
    });

    return new Response(
      JSON.stringify({
        success: true,
        photo_id: photoRecord.id,
        file_uuid: file_uuid,
        gallery_id: session.gallery_id,
        uploaded_count: newUploadedCount,
        total_files: session.total_files
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_upload_confirm error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
