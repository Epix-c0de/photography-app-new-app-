import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const galleryId = url.searchParams.get("gallery_id");
    if (!galleryId) {
      throw new Error("Missing gallery_id");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile || !["admin", "super_admin"].includes(profile.role)) {
      throw new Error("Forbidden");
    }

    const { data: gallery, error: galleryError } = await adminClient
      .from("galleries")
      .select("id, created_by_admin_id, owner_admin_id, expected_file_count, upload_status")
      .eq("id", galleryId)
      .maybeSingle();
    if (galleryError || !gallery) {
      throw new Error("Gallery not found");
    }
    if (![gallery.created_by_admin_id, gallery.owner_admin_id].includes(user.id)) {
      throw new Error("Forbidden");
    }

    const { data: photos, error: photosError } = await adminClient
      .from("photos")
      .select("file_name, file_url, upload_status")
      .eq("gallery_id", galleryId);
    if (photosError) throw photosError;

    const uploadedFiles = (photos ?? [])
      .filter((p: any) => p.upload_status === "uploaded")
      .map((p: any) => p.file_name || p.file_url);

    const { data: failedLogs } = await adminClient
      .from("upload_logs")
      .select("file_name")
      .eq("gallery_id", galleryId)
      .eq("status", "upload_failed")
      .order("created_at", { ascending: false });

    const failedFiles = Array.from(new Set((failedLogs ?? []).map((f: any) => f.file_name).filter(Boolean)));
    const expectedCount = gallery.expected_file_count ?? 0;
    const pendingCount = Math.max(0, expectedCount - uploadedFiles.length);

    return new Response(
      JSON.stringify({
        gallery_id: galleryId,
        upload_status: gallery.upload_status,
        expected_files: expectedCount,
        uploaded_files: uploadedFiles,
        failed_files: failedFiles,
        pending_files: pendingCount,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
