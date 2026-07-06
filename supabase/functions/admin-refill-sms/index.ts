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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is super_admin
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile || profile.role !== "super_admin") {
      throw new Error("Forbidden: Super admin access required");
    }

    const body = await req.json();
    const { admin_id, amount, reason } = body ?? {};

    // Validate inputs
    if (!admin_id || !amount || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid params: admin_id and positive amount required");
    }

    // Verify target admin exists
    const { data: targetAdmin, error: targetError } = await adminClient
      .from("user_profiles")
      .select("id, role")
      .eq("id", admin_id)
      .maybeSingle();
    if (targetError || !targetAdmin) {
      throw new Error("Target admin not found");
    }

    // Increment SMS balance via RPC
    const { data: newBalance, error: rpcError } = await adminClient.rpc("increment_sms_balance", {
      p_admin_id: admin_id,
      p_amount: amount
    });

    if (rpcError) {
      throw new Error(`Failed to increment SMS balance: ${rpcError.message}`);
    }

    // Log to audit trail
    await adminClient.from("admin_audit_logs").insert({
      admin_id: user.id,
      action: 'sms_refill',
      target_admin_id: admin_id,
      amount,
      reason: reason || `Super admin refilled ${amount} SMS credits`,
      metadata: { balance_after: newBalance }
    });

    return new Response(
      JSON.stringify({
        success: true,
        admin_id,
        amount,
        balance_after: newBalance,
        message: `Successfully refilled ${amount} SMS credits`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin-refill-sms error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
