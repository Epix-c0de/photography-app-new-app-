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

    const { action, referral_code, user_id } = await req.json();

    // Get current user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_code") {
      // Get or create referral code for user
      const { data: existing } = await supabase
        .from("referrals")
        .select("referral_code")
        .eq("referrer_id", user.id)
        .limit(1)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            referral_code: existing.referral_code 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate new code
      const { data: code, error: codeError } = await supabase
        .rpc("generate_referral_code", { p_user_id: user.id });

      if (codeError) throw codeError;

      // Create initial referral record
      await supabase.from("referrals").insert({
        referrer_id: user.id,
        referral_code: code,
        status: "pending",
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          referral_code: code 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "apply") {
      // Apply referral code
      if (!referral_code) {
        return new Response(
          JSON.stringify({ error: "Missing referral_code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: result, error: processError } = await supabase
        .rpc("process_referral", {
          p_referral_code: referral_code.toUpperCase(),
          p_new_user_id: user.id,
        });

      if (processError) throw processError;

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "stats") {
      // Get referral stats
      const { data: stats, error: statsError } = await supabase
        .rpc("get_referral_stats", { p_photographer_id: user.id });

      if (statsError) throw statsError;

      // Get credit balance
      const { data: balance, error: balanceError } = await supabase
        .rpc("get_credit_balance", { p_photographer_id: user.id });

      if (balanceError) throw balanceError;

      return new Response(
        JSON.stringify({
          success: true,
          stats: stats?.[0] || {
            total_referrals: 0,
            pending_referrals: 0,
            completed_referrals: 0,
            total_credits_earned: 0,
            referral_code: null,
          },
          credit_balance: balance || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "share") {
      // Generate share link
      const { data: stats } = await supabase
        .rpc("get_referral_stats", { p_photographer_id: user.id });

      const code = stats?.[0]?.referral_code;
      if (!code) {
        return new Response(
          JSON.stringify({ error: "No referral code found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch domain from platform_settings
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'platform_domain')
        .single();
      const domain = settings?.value || 'https://epixvisuals.co.ke';

      const shareUrl = `${domain}/signup?ref=${code}`;
      const shareText = `Join Epix Visuals as a photographer! Use my referral code: ${code}\n\nSign up here: ${shareUrl}`;

      return new Response(
        JSON.stringify({
          success: true,
          share_url: shareUrl,
          share_text: shareText,
          referral_code: code,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Referral error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Referral processing failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
