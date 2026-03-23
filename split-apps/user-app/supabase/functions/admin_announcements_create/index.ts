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
    const {
      title,
      description,
      content_blocks,
      category,
      tag,
      cta_text,
      cta_action,
      scheduled_for
    } = body ?? {};

    if (!title?.trim()) {
      throw new Error("Title is required");
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

    // Validate scheduled_for if provided
    let scheduledDate = null;
    if (scheduled_for) {
      const scheduledDateTime = new Date(scheduled_for);
      if (isNaN(scheduledDateTime.getTime())) {
        throw new Error("Invalid scheduled_for date format");
      }
      if (scheduledDateTime <= new Date()) {
        throw new Error("Scheduled date must be in the future");
      }
      scheduledDate = scheduledDateTime.toISOString();
    }

    // Create announcement record
    const { data: announcement, error: announcementError } = await adminClient
      .from("announcements")
      .insert({
        title: title.trim(),
        description: description?.trim(),
        content_html: content_blocks ? JSON.stringify(content_blocks) : null,
        category: category?.trim(),
        tag: tag?.trim(),
        cta: cta_text?.trim(),
        created_by: user.id,
        scheduled_for: scheduledDate,
        is_active: false, // Will be activated on publish
        views_count: 0,
        clicks_count: 0,
        comments_count: 0
      })
      .select('id')
      .single();

    if (announcementError) {
      throw new Error(`Failed to create announcement: ${announcementError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        announcement_id: announcement.id,
        status: scheduledDate ? 'scheduled' : 'draft',
        scheduled_for: scheduledDate,
        upload_allowed: true
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_announcements_create error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
