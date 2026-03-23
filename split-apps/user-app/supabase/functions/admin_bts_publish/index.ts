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
    const { bts_id, final_caption } = body ?? {};
    if (!bts_id) {
      throw new Error("Missing required field: bts_id");
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

    // Verify BTS post exists and belongs to admin
    const { data: btsPost, error: postError } = await adminClient
      .from("bts_posts")
      .select("id, created_by, media_url, is_active, title")
      .eq("id", bts_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (postError || !btsPost) {
      throw new Error("BTS post not found or access denied");
    }

    // Check if already published
    if (btsPost.is_active) {
      throw new Error("BTS post is already published");
    }

    // Check if media exists
    if (!btsPost.media_url) {
      throw new Error("Cannot publish BTS post without media. Upload media first.");
    }

    // Update caption if provided
    const updatedCaption = final_caption?.trim() || btsPost.title;

    // Publish the BTS post
    const { error: publishError } = await adminClient
      .from("bts_posts")
      .update({
        is_active: true,
        title: updatedCaption,
        scheduled_for: new Date().toISOString()
      })
      .eq("id", bts_id);

    if (publishError) {
      throw new Error(`Failed to publish BTS post: ${publishError.message}`);
    }

    // Create global notification for all clients (BTS posts are global)
    // Get all client users
    const { data: clientUsers, error: clientsError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("role", "client");

    if (!clientsError && clientUsers && clientUsers.length > 0) {
      // Create notifications for all clients (in batches to avoid limits)
      const notifications = clientUsers.slice(0, 50).map(client => ({
        user_id: client.id,
        type: 'bts_post',
        title: 'New BTS Content!',
        body: `Check out our latest behind-the-scenes content: ${updatedCaption}`,
        data: {
          bts_id: bts_id,
          action_type: 'view_bts'
        }
      }));

      const { error: notificationError } = await adminClient
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error('Failed to create notifications:', notificationError);
        // Don't fail the publish for notification issues
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        bts_id: bts_id,
        published: true,
        caption: updatedCaption,
        notifications_sent: !clientsError && clientUsers && clientUsers.length > 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_bts_publish error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
