import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const resolveSessionId = (url: string) => {
  const { pathname, searchParams } = new URL(url);
  const segments = pathname.split("/").filter(Boolean);
  const functionIndex = segments.indexOf("admin_upload_complete");
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

    const { data, error } = await adminClient.rpc("complete_upload_session", {
      session_id: sessionId,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;

    return new Response(
      JSON.stringify({
        gallery_id: result.gallery_id,
        uploaded_files: result.uploaded_files,
        failed_files: result.failed_files,
        total_files: result.total_files,
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
