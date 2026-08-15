import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Check for recent pending request (prevent spam - 1 per hour)
    const { data: recentRequest } = await supabase
      .from("data_export_requests")
      .select("id, status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("requested_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (recentRequest) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "You already have a pending export request. Please wait for it to complete.",
          request_id: recentRequest.id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create export request record
    const { data: exportRequest, error: insertError } = await supabase
      .from("data_export_requests")
      .insert({
        user_id: userId,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error("Failed to create export request");
    }

    // Gather all user data in parallel
    const [
      profileResult,
      galleriesResult,
      photosResult,
      unlockedResult,
      downloadsResult,
      favoritesResult,
      notificationsResult,
      bookingsResult,
      paymentsResult,
    ] = await Promise.all([
      // 1. Profile
      supabase
        .from("user_profiles")
        .select("id, name, email, phone, avatar_url, role, created_at")
        .eq("id", userId)
        .single(),

      // 2. Galleries (where user is client)
      supabase
        .from("galleries")
        .select("id, name, shoot_type, is_locked, access_code, created_at, client_id")
        .eq("client_id", userId),

      // 3. Gallery photos
      supabase
        .from("gallery_photos")
        .select("id, gallery_id, photo_url, file_name, file_size, created_at")
        .in("gallery_id", 
          (await supabase.from("galleries").select("id").eq("client_id", userId)).data?.map((g: any) => g.id) || []
        ),

      // 4. Unlocked galleries
      supabase
        .from("unlocked_galleries")
        .select("id, gallery_id, unlocked_at")
        .eq("user_id", userId),

      // 5. Download history
      supabase
        .from("download_history")
        .select("id, gallery_id, gallery_name, photo_count, downloaded_at, format")
        .eq("user_id", userId),

      // 6. Favorites
      supabase
        .from("favorites")
        .select("id, photo_id, created_at")
        .eq("user_id", userId),

      // 7. Notifications
      supabase
        .from("notifications")
        .select("id, type, title, body, read, created_at")
        .eq("user_id", userId),

      // 8. Bookings
      supabase
        .from("bookings")
        .select("id, title, date, status, notes, created_at")
        .eq("user_id", userId),

      // 9. Payment history
      supabase
        .from("transactions")
        .select("id, amount, currency, status, description, created_at")
        .eq("user_id", userId),
    ]);

    // Compile export data
    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      profile: profileResult.data,
      galleries: galleriesResult.data || [],
      photos: photosResult.data || [],
      unlocked_galleries: unlockedResult.data || [],
      download_history: downloadsResult.data || [],
      favorites: favoritesResult.data || [],
      notifications: notificationsResult.data || [],
      bookings: bookingsResult.data || [],
      payments: paymentsResult.data || [],
      summary: {
        total_galleries: galleriesResult.data?.length || 0,
        total_photos: photosResult.data?.length || 0,
        total_downloads: downloadsResult.data?.length || 0,
        total_favorites: favoritesResult.data?.length || 0,
        total_bookings: bookingsResult.data?.length || 0,
        account_created: profileResult.data?.created_at,
      },
    };

    // Update request with data
    const { error: updateError } = await supabase
      .from("data_export_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        export_data: exportData,
      })
      .eq("id", exportRequest.id);

    if (updateError) {
      throw new Error("Failed to save export data");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Your data has been compiled successfully.",
        request_id: exportRequest.id,
        data: exportData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Data export error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process data export" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
