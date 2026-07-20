import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Authenticate user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Not authenticated");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Verify super_admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || profile?.role !== "super_admin") {
      throw new Error("Unauthorized: super_admin role required");
    }

    const body = await req.json();
    const adminId = String(body?.admin_id ?? "");
    const credits = Number(body?.credits ?? 0);
    const reason = String(body?.reason ?? "Manual adjustment");
    const adjustmentType = String(body?.adjustment_type ?? "add");

    if (!adminId) throw new Error("Missing admin_id");
    if (!Number.isFinite(credits) || credits <= 0) throw new Error("Invalid credits amount");
    if (!["add", "deduct"].includes(adjustmentType)) throw new Error("adjustment_type must be 'add' or 'deduct'");

    // Verify target admin exists
    const { data: targetAdmin, error: targetError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, name")
      .eq("id", adminId)
      .single();
    if (targetError || !targetAdmin) throw new Error("Target admin not found");

    // Upsert credits
    const { data: existingCredits } = await supabaseAdmin
      .from("sms_credits")
      .select("balance, total_purchased")
      .eq("admin_id", adminId)
      .single();

    let newBalance: number;
    let newTotalPurchased: number;

    if (existingCredits) {
      const currentBalance = existingCredits.balance || 0;
      const currentPurchased = existingCredits.total_purchased || 0;

      if (adjustmentType === "deduct" && currentBalance < credits) {
        throw new Error(`Insufficient credits. Current balance: ${currentBalance}`);
      }

      newBalance = adjustmentType === "add" ? currentBalance + credits : currentBalance - credits;
      newTotalPurchased = adjustmentType === "add" ? currentPurchased + credits : currentPurchased;

      const { error: updateError } = await supabaseAdmin
        .from("sms_credits")
        .update({ balance: newBalance, total_purchased: newTotalPurchased })
        .eq("admin_id", adminId);
      if (updateError) throw new Error("Failed to update credits");
    } else {
      newBalance = adjustmentType === "add" ? credits : 0;
      newTotalPurchased = adjustmentType === "add" ? credits : 0;

      const { error: insertError } = await supabaseAdmin
        .from("sms_credits")
        .insert({ admin_id: adminId, balance: newBalance, total_purchased: newTotalPurchased });
      if (insertError) throw new Error("Failed to create credit record");
    }

    // Update user_profiles.sms_credits
    await supabaseAdmin
      .from("user_profiles")
      .update({ sms_credits: newBalance })
      .eq("id", adminId);

    // Log transaction
    await supabaseAdmin.from("sms_purchase_transactions").insert({
      admin_id: adminId,
      package_id: null,
      sms_count: adjustmentType === "add" ? credits : -credits,
      amount: 0,
      status: "completed",
      mpesa_receipt: `manual:${reason}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: newBalance,
        message: `${adjustmentType === "add" ? "Added" : "Deducted"} ${credits} credits for ${targetAdmin.name}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
