import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const resolveSessionId = (url: string) => {
  const { pathname, searchParams } = new URL(url);
  const segments = pathname.split("/").filter(Boolean);
  const functionIndex = segments.indexOf("admin_upload_file");
  const sessionFromPath = functionIndex >= 0 ? segments[functionIndex + 1] : null;
  return sessionFromPath || searchParams.get("session_id");
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sessionId = resolveSessionId(req.url);
    if (!sessionId) {
      throw new Error("Missing session_id");
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

    const { data: session, error: sessionError } = await adminClient
      .from("upload_sessions")
      .select("id, gallery_id, status")
      .eq("id", sessionId)
      .single();
    if (sessionError || !session) {
      throw new Error("Session not found");
    }
    if (!["initializing", "uploading"].includes(session.status)) {
      throw new Error("Session not accepting uploads");
    }
    if (!session.gallery_id) {
      throw new Error("Session missing gallery");
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("Missing file");
    }

    const metaFileName = form.get("file_name");
    const metaMimeType = form.get("mime_type");
    const metaFileSize = form.get("file_size");

    const fileName = String(metaFileName || file.name || `file-${crypto.randomUUID()}.jpg`);
    const fileSize = Number(metaFileSize || file.size || 0);
    const mimeType = String(metaMimeType || file.type || "image/jpeg");
    const ext = (fileName.split(".").pop() || "jpg").toLowerCase();
    const storagePath = `galleries/${session.gallery_id}/${crypto.randomUUID()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await adminClient.storage
      .from("client-photos")
      .upload(storagePath, arrayBuffer, { contentType: mimeType, upsert: false });

    const statusUpdate = session.status === "initializing" ? "uploading" : null;

    if (uploadError) {
      await adminClient.from("photos").insert({
        gallery_id: session.gallery_id,
        file_url: storagePath,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        upload_status: "failed",
      });
      await adminClient.rpc("bump_upload_session", {
        session_id: sessionId,
        uploaded_delta: 0,
        failed_delta: 1,
        new_status: statusUpdate,
      });
      return new Response(
        JSON.stringify({ success: false, error: uploadError.message }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const { error: insertError } = await adminClient.from("photos").insert({
      gallery_id: session.gallery_id,
      file_url: storagePath,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      upload_status: "uploaded",
    });
    if (insertError) {
      await adminClient.storage.from("client-photos").remove([storagePath]);
      await adminClient.from("photos").insert({
        gallery_id: session.gallery_id,
        file_url: storagePath,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        upload_status: "failed",
      });
      await adminClient.rpc("bump_upload_session", {
        session_id: sessionId,
        uploaded_delta: 0,
        failed_delta: 1,
        new_status: statusUpdate,
      });
      throw insertError;
    }

    await adminClient.rpc("bump_upload_session", {
      session_id: sessionId,
      uploaded_delta: 1,
      failed_delta: 0,
      new_status: statusUpdate,
    });

    return new Response(
      JSON.stringify({ success: true, file_url: storagePath }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
