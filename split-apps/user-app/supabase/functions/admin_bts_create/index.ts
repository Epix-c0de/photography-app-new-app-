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
    const { caption, shoot_type, expiry_hours } = body ?? {};
    if (!caption?.trim()) {
      throw new Error("Caption is required");
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

    // Calculate expiry time (default 72 hours)
    const expiryTime = expiry_hours && expiry_hours > 0
      ? new Date(Date.now() + (expiry_hours * 60 * 60 * 1000)).toISOString()
      : new Date(Date.now() + (72 * 60 * 60 * 1000)).toISOString();

    // Create BTS post record
    const { data: btsPost, error: postError } = await adminClient
      .from("bts_posts")
      .insert({
        title: caption.substring(0, 100), // Use caption as title, truncated
        created_by: user.id,
        shoot_type: shoot_type || 'General',
        is_active: false, // Will be activated on publish
        expires_at: expiryTime,
        views_count: 0,
        likes_count: 0,
        comments_count: 0
      })
      .select('id')
      .single();

    if (postError) {
      throw new Error(`Failed to create BTS post: ${postError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        bts_id: btsPost.id,
        upload_allowed: true,
        max_file_size: MAX_FILE_SIZE,
        allowed_types: Array.from(ALLOWED_MIME_TYPES),
        expiry_time: expiryTime
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_bts_create error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
