import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "GET") {
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

    // Extract announcement ID from URL path
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const announcementId = pathSegments[pathSegments.length - 1];

    if (!announcementId || announcementId === 'announcements') {
      throw new Error("Announcement ID is required");
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is a client
    const { data: profile, error: profileError } = await client
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile || profile.role !== "client") {
      throw new Error("Access restricted to clients only");
    }

    // Fetch the specific announcement with full details
    const { data: announcement, error: announcementError } = await client
      .from("announcements")
      .select(`
        id,
        title,
        description,
        content_html,
        image_url,
        media_url,
        media_type,
        category,
        tag,
        cta,
        created_at,
        views_count,
        comments_count,
        announcement_comments(
          id,
          comment,
          created_at,
          user_profiles(name, avatar_url)
        )
      `)
      .eq("id", announcementId)
      .eq("is_active", true)
      .maybeSingle();

    if (announcementError) {
      throw new Error(`Failed to fetch announcement: ${announcementError.message}`);
    }

    if (!announcement) {
      throw new Error("Announcement not found or not available");
    }

    // Check if user has read this announcement
    const { data: readRecord, error: readError } = await client
      .from("announcement_reads")
      .select("id")
      .eq("user_id", user.id)
      .eq("announcement_id", announcementId)
      .maybeSingle();

    const isRead = !!readRecord;

    // If not read, mark as read and increment view count
    if (!isRead) {
      // Mark as read
      await client
        .from("announcement_reads")
        .insert({
          user_id: user.id,
          announcement_id: announcementId,
          read_at: new Date().toISOString()
        })
        .select('id')
        .maybeSingle();

      // Increment view count
      await client
        .from("announcements")
        .update({
          views_count: (announcement.views_count || 0) + 1
        })
        .eq("id", announcementId);
    }

    // Parse content blocks if they exist
    let contentBlocks = null;
    if (announcement.content_html) {
      try {
        contentBlocks = JSON.parse(announcement.content_html);
      } catch (e) {
        console.warn('Failed to parse content blocks:', e);
      }
    }

    // Format comments
    const formattedComments = (announcement.announcement_comments || []).map(comment => ({
      id: comment.id,
      comment: comment.comment,
      created_at: comment.created_at,
      author: {
        name: comment.user_profiles?.name || 'Anonymous',
        avatar: comment.user_profiles?.avatar_url
      }
    }));

    // Format the response
    const formattedAnnouncement = {
      id: announcement.id,
      title: announcement.title,
      description: announcement.description,
      content_blocks: contentBlocks,
      image_url: announcement.image_url,
      media_url: announcement.media_url,
      media_type: announcement.media_type,
      category: announcement.category,
      tag: announcement.tag,
      cta: announcement.cta,
      created_at: announcement.created_at,
      stats: {
        views: (announcement.views_count || 0) + (isRead ? 0 : 1), // Include current view
        comments: announcement.comments_count || 0
      },
      is_read: true, // Now it's read
      comments: formattedComments,
      comment_count: formattedComments.length
    };

    return new Response(
      JSON.stringify({
        announcement: formattedAnnouncement
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('clients_announcements_id error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
