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

    const now = new Date().toISOString();

    // Fetch active, non-expired BTS posts
    const { data: btsPosts, error: postsError } = await client
      .from("bts_posts")
      .select(`
        id,
        title,
        media_url,
        media_type,
        shoot_type,
        created_at,
        expires_at,
        views_count,
        likes_count,
        comments_count,
        target_audience
      `)
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (postsError) {
      throw new Error(`Failed to fetch BTS feed: ${postsError.message}`);
    }

    // Get user's engagement data (likes) for these posts
    const postIds = btsPosts?.map(p => p.id) || [];
    let userLikes = new Map();

    if (postIds.length > 0) {
      const { data: likesData, error: likesError } = await client
        .from("bts_likes")
        .select("bts_id")
        .eq("user_id", user.id)
        .in("bts_id", postIds);

      if (!likesError && likesData) {
        userLikes = new Map(likesData.map(like => [like.bts_id, true]));
      }
    }

    // Format the response
    const feedPosts = (btsPosts || []).map(post => ({
      id: post.id,
      title: post.title,
      media_url: post.media_url,
      media_type: post.media_type,
      shoot_type: post.shoot_type,
      created_at: post.created_at,
      expires_at: post.expires_at,
      stats: {
        views: post.views_count || 0,
        likes: post.likes_count || 0,
        comments: post.comments_count || 0
      },
      user_liked: userLikes.has(post.id),
      is_expired: post.expires_at && new Date(post.expires_at) < new Date()
    }));

    return new Response(
      JSON.stringify({
        posts: feedPosts,
        pagination: {
          offset: offset,
          limit: limit,
          has_more: feedPosts.length === limit
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('clients_bts_feed error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
