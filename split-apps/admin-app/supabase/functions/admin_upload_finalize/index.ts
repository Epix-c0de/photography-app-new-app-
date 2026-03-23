import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const { session_id } = body ?? {};
    if (!session_id) {
      throw new Error("Missing required field: session_id");
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

    // Check if all files have been uploaded
    if (session.uploaded_files !== session.total_files) {
      throw new Error(`Upload incomplete: ${session.uploaded_files}/${session.total_files} files uploaded`);
    }

    // Verify gallery exists and get client info
    const { data: gallery, error: galleryError } = await adminClient
      .from("galleries")
      .select("id, name, client_id, status")
      .eq("id", session.gallery_id)
      .maybeSingle();

    if (galleryError || !gallery) {
      throw new Error("Gallery not found");
    }

    // Check gallery status - should be pending_upload
    if (gallery.status !== 'pending_upload') {
      throw new Error(`Gallery is not in pending_upload status: ${gallery.status}`);
    }

    // Count actual photos in gallery_photos table to double-check
    const { count: photoCount, error: photoCountError } = await adminClient
      .from("gallery_photos")
      .select("*", { count: 'exact', head: true })
      .eq("gallery_id", session.gallery_id);

    if (photoCountError) {
      throw new Error(`Failed to count gallery photos: ${photoCountError.message}`);
    }

    if (photoCount !== session.total_files) {
      throw new Error(`Photo count mismatch: expected ${session.total_files}, found ${photoCount}`);
    }

    // Mark gallery as active
    const { error: updateGalleryError } = await adminClient
      .from("galleries")
      .update({
        status: 'active',
        is_locked: false,
        is_paid: false, // Can be updated later when payment is processed
        photo_count: photoCount,
        finalized_at: new Date().toISOString(),
        finalized_by: user.id
      })
      .eq("id", session.gallery_id);

    if (updateGalleryError) {
      throw new Error(`Failed to finalize gallery: ${updateGalleryError.message}`);
    }

    // Mark upload session as completed
    const { error: updateSessionError } = await adminClient
      .from("upload_sessions")
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq("id", session_id);

    if (updateSessionError) {
      console.error('Failed to update session status:', updateSessionError);
      // Don't fail the whole operation for this
    }

    // Create client-specific notification
    const { error: notificationError } = await adminClient
      .from("notifications")
      .insert({
        user_id: gallery.client_id,
        type: 'gallery_ready',
        title: 'Your Photos Are Ready!',
        body: `Your gallery "${gallery.name}" with ${photoCount} photos is now ready to view.`,
        data: {
          gallery_id: session.gallery_id,
          gallery_name: gallery.name,
          photo_count: photoCount,
          action_type: 'view_gallery'
        }
      });

    if (notificationError) {
      console.error('Failed to create notification:', notificationError);
      // Don't fail the whole operation for notification issues
    }

    // Log finalization success
    await adminClient.from("upload_logs").insert({
      session_id: session_id,
      gallery_id: session.gallery_id,
      status: "gallery_finalized",
      message: `Gallery activated with ${photoCount} photos. Notification sent to client.`
    });

    return new Response(
      JSON.stringify({
        success: true,
        gallery_id: session.gallery_id,
        client_id: gallery.client_id,
        uploaded_files: session.uploaded_files,
        total_files: session.total_files,
        photo_count: photoCount,
        notification_sent: !notificationError
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_upload_finalize error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
