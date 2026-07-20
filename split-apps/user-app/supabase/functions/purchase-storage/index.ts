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
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "super_admin") throw new Error("Unauthorized: super_admin role required");

    const body = await req.json();
    const adminId = String(body?.admin_id ?? "");
    const tierId = String(body?.tier_id ?? "");
    const storageMb = Number(body?.storage_mb ?? 0);
    const amountKes = Number(body?.amount_kes ?? 0);
    const mpesaReceipt = body?.mpesa_receipt ? String(body.mpesa_receipt) : null;
    const phoneNumber = body?.phone_number ? String(body.phone_number) : null;

    if (!adminId) throw new Error("Missing admin_id");
    if (!Number.isFinite(storageMb) || storageMb <= 0) throw new Error("Invalid storage_mb");

    // Verify target admin exists
    const { data: targetAdmin } = await supabaseAdmin
      .from("user_profiles")
      .select("id, name")
      .eq("id", adminId)
      .single();
    if (!targetAdmin) throw new Error("Target admin not found");

    // If tier_id provided, verify it exists and get price
    let finalStorageMb = storageMb;
    let finalAmount = amountKes;
    if (tierId) {
      const { data: tier } = await supabaseAdmin
        .from("storage_tiers")
        .select("storage_mb, price_kes")
        .eq("id", tierId)
        .single();
      if (!tier) throw new Error("Storage tier not found");
      finalStorageMb = tier.storage_mb;
      finalAmount = tier.price_kes;
    }

    // Record purchase
    const { error: purchaseError } = await supabaseAdmin
      .from("storage_purchases")
      .insert({
        admin_id: adminId,
        tier_id: tierId || null,
        storage_mb: finalStorageMb,
        amount_kes: finalAmount,
        mpesa_receipt: mpesaReceipt,
        phone_number: phoneNumber,
        status: "completed",
      });
    if (purchaseError) throw new Error("Failed to record purchase");

    // Update admin's extra storage
    const { data: existing } = await supabaseAdmin
      .from("admin_storage_allocations")
      .select("extra_storage_mb")
      .eq("admin_id", adminId)
      .single();

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("admin_storage_allocations")
        .update({ extra_storage_mb: existing.extra_storage_mb + finalStorageMb, updated_at: new Date().toISOString() })
        .eq("admin_id", adminId);
      if (updateError) throw new Error("Failed to update allocation");
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("admin_storage_allocations")
        .insert({ admin_id: adminId, extra_storage_mb: finalStorageMb });
      if (insertError) throw new Error("Failed to create allocation");
    }

    // Get updated allocation
    const { data: updated } = await supabaseAdmin
      .from("admin_storage_allocations")
      .select("base_storage_mb, extra_storage_mb")
      .eq("admin_id", adminId)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Allocated ${finalStorageMb}MB to ${targetAdmin.name}`,
        total_storage_mb: (updated?.base_storage_mb || 10240) + (updated?.extra_storage_mb || 0),
        extra_storage_mb: updated?.extra_storage_mb || 0,
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
