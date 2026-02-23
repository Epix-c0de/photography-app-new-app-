import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
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
    const { admin_id, client_name, client_phone, total_files } = body ?? {};
    if (!admin_id || !client_name || !client_phone || !total_files) {
      throw new Error("Missing required fields");
    }
    if (admin_id !== user.id) {
      throw new Error("Admin mismatch");
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

    const { data, error } = await adminClient.rpc("init_upload_session", {
      admin_id,
      client_name,
      client_phone,
      total_files,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error("Initialization failed");

    return new Response(
      JSON.stringify({
        session_id: result.session_id,
        access_code: result.access_code,
        gallery_id: result.gallery_id,
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
