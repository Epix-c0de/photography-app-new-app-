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

    // Parse query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const category = url.searchParams.get('category');

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

    // Build query for active announcements
    let query = client
      .from("announcements")
      .select(`
        id,
        title,
        description,
        image_url,
        media_url,
        media_type,
        category,
        tag,
        cta,
        created_at,
        views_count,
        comments_count,
        announcement_comments(count)
      `)
      .eq("is_active", true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by category if specified
    if (category) {
      query = query.eq('category', category);
    }

    const { data: announcements, error: announcementsError } = await query;

    if (announcementsError) {
      throw new Error(`Failed to fetch announcements: ${announcementsError.message}`);
    }

    // Get user's read status for these announcements
    const announcementIds = announcements?.map(a => a.id) || [];
    let readStatus = new Map();

    if (announcementIds.length > 0) {
      // Note: This assumes there's an announcement_reads table for tracking reads
      // If not, we'll need to create one or track differently
      const { data: readData, error: readError } = await client
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", user.id)
        .in("announcement_id", announcementIds);

      if (!readError && readData) {
        readStatus = new Map(readData.map(read => [read.announcement_id, true]));
      }
    }

    // Format the response
    const formattedAnnouncements = (announcements || []).map(announcement => ({
      id: announcement.id,
      title: announcement.title,
      description: announcement.description,
      image_url: announcement.image_url,
      media_url: announcement.media_url,
      media_type: announcement.media_type,
      category: announcement.category,
      tag: announcement.tag,
      cta: announcement.cta,
      created_at: announcement.created_at,
      stats: {
        views: announcement.views_count || 0,
        comments: announcement.comments_count || 0
      },
      is_read: readStatus.has(announcement.id),
      has_media: !!(announcement.image_url || announcement.media_url)
    }));

    // Get unique categories for filtering
    const categories = [...new Set(announcements?.map(a => a.category).filter(Boolean) || [])];

    return new Response(
      JSON.stringify({
        announcements: formattedAnnouncements,
        categories: categories,
        pagination: {
          offset: offset,
          limit: limit,
          has_more: formattedAnnouncements.length === limit
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('clients_announcements error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
