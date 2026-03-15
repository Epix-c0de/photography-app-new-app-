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
    const { admin_id, client_id, gallery_name, total_files, estimated_total_size } = body ?? {};
    if (!admin_id || !client_id || !gallery_name) {
      throw new Error("Missing required fields: admin_id, client_id, gallery_name");
    }
    // total_files can be 0 (valid), so check explicitly for undefined/null
    const resolvedTotalFiles = total_files ?? 0;
    if (admin_id !== user.id) {
      throw new Error("Admin ID mismatch");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Call the atomic RPC to initialize both records
    const { data: initData, error: rpcError } = await adminClient.rpc('init_upload_session', {
      admin_id: user.id,
      client_id: client_id,
      gallery_name: gallery_name,
      total_files: resolvedTotalFiles,
      estimated_total_size: estimated_total_size || null
    });

    if (rpcError) {
      console.error('RPC Error (init_upload_session):', rpcError);
      throw new Error(`Failed to initialize upload session: ${rpcError.message}`);
    }

    const session = Array.isArray(initData) ? initData[0] : initData;

    return new Response(
      JSON.stringify({
        session_id: session.session_id,
        access_code: session.access_code,
        gallery_id: session.gallery_id,
        parallel_upload_limit: session.parallel_upload_limit,
        storage_path_prefix: `clients/${client_id}/galleries/${session.gallery_id}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_upload_init error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
