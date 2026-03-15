import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Resume Upload Status API
Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "GET") {
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

    // Get gallery_id from query params
    const url = new URL(req.url);
    const galleryId = url.searchParams.get('gallery_id');

    if (!galleryId) {
      throw new Error("Missing required parameter: gallery_id");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role and gallery ownership
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile || !["admin", "super_admin"].includes(profile.role)) {
      throw new Error("Forbidden: Admin access required");
    }

    // Get gallery details
    const { data: gallery, error: galleryError } = await adminClient
      .from("galleries")
      .select("id, name, status, photo_count, created_at")
      .eq("id", galleryId)
      .eq("owner_admin_id", user.id)
      .maybeSingle();

    if (galleryError || !gallery) {
      throw new Error("Gallery not found or access denied");
    }

    // Get upload session details
    const { data: session, error: sessionError } = await adminClient
      .from("upload_sessions")
      .select("id, total_files, uploaded_files, failed_files, status, created_at")
      .eq("gallery_id", galleryId)
      .maybeSingle();

    // Get detailed upload progress from logs
    const { data: uploadLogs, error: logsError } = await adminClient
      .from("upload_logs")
      .select("file_name, status, message, created_at")
      .eq("gallery_id", galleryId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get current photos in gallery
    const { data: photos, error: photosError } = await adminClient
      .from("gallery_photos")
      .select("id, file_name, storage_path, file_size, upload_session_id")
      .eq("gallery_id", galleryId);

    // Analyze upload status
    const uploadedFiles = photos?.length || 0;
    const totalFiles = session?.total_files || uploadedFiles;

    const failedFiles = (uploadLogs || []).filter(log =>
      log.status === 'upload_failed' ||
      log.status === 'verification_failed' ||
      log.status === 'db_insert_failed'
    ).length;

    const pendingFiles = Math.max(0, totalFiles - uploadedFiles - failedFiles);

    const resumeData = {
      gallery: {
        id: gallery.id,
        name: gallery.name,
        status: gallery.status,
        created_at: gallery.created_at
      },
      session: session ? {
        id: session.id,
        status: session.status,
        created_at: session.created_at
      } : null,
      progress: {
        total_files: totalFiles,
        uploaded_files: uploadedFiles,
        pending_files: pendingFiles,
        failed_files: failedFiles,
        completion_percentage: totalFiles > 0 ? Math.round((uploadedFiles / totalFiles) * 100) : 0
      },
      can_resume: gallery.status === 'pending_upload' || session?.status === 'active',
      recent_logs: (uploadLogs || []).slice(0, 10).map(log => ({
        file_name: log.file_name,
        status: log.status,
        message: log.message,
        timestamp: log.created_at
      }))
    };

    return new Response(
      JSON.stringify(resumeData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_upload_resume_status error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
