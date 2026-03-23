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
    const { announcement_id, publish_now } = body ?? {};
    if (!announcement_id) {
      throw new Error("Missing required field: announcement_id");
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

    // Verify announcement exists and belongs to admin
    const { data: announcement, error: announcementError } = await adminClient
      .from("announcements")
      .select("id, created_by, is_active, scheduled_for, title")
      .eq("id", announcement_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (announcementError || !announcement) {
      throw new Error("Announcement not found or access denied");
    }

    // Check if already published
    if (announcement.is_active) {
      throw new Error("Announcement is already published");
    }

    const now = new Date();
    let publishTime = now;

    // Handle scheduled publishing
    if (!publish_now && announcement.scheduled_for) {
      const scheduledTime = new Date(announcement.scheduled_for);
      if (scheduledTime > now) {
        publishTime = scheduledTime;
      }
    }

    // Publish the announcement
    const { error: publishError } = await adminClient
      .from("announcements")
      .update({
        is_active: true,
        scheduled_for: publish_now ? now.toISOString() : announcement.scheduled_for
      })
      .eq("id", announcement_id);

    if (publishError) {
      throw new Error(`Failed to publish announcement: ${publishError.message}`);
    }

    // If publishing now, create global notifications for all clients
    if (publish_now) {
      // Get all client users
      const { data: clientUsers, error: clientsError } = await adminClient
        .from("user_profiles")
        .select("id")
        .eq("role", "client");

      if (!clientsError && clientUsers && clientUsers.length > 0) {
        // Create notifications for all clients (in batches to avoid limits)
        const notifications = clientUsers.slice(0, 100).map(client => ({
          user_id: client.id,
          type: 'announcement',
          title: 'New Announcement!',
          body: announcement.title,
          data: {
            announcement_id: announcement_id,
            action_type: 'view_announcement'
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        announcement_id: announcement_id,
        published: publish_now,
        publish_time: publishTime.toISOString(),
        notifications_sent: publish_now && !clientsError
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_announcements_publish error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
