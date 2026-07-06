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

    const { gallery_id, photographer_id, client_id, total_amount, deposit_amount, number_of_installments } = await req.json();

    if (!gallery_id || !photographer_id || !total_amount || !number_of_installments) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deposit = deposit_amount || 0;
    const balance = total_amount - deposit;
    const installmentAmount = Math.ceil(balance / number_of_installments);

    // Create the plan
    const { data: plan, error: planError } = await supabase
      .from("installment_plans")
      .insert({
        gallery_id,
        photographer_id,
        client_id,
        total_amount,
        deposit_amount: deposit,
        balance_amount: balance,
        number_of_installments,
        installment_amount: installmentAmount,
        status: deposit > 0 ? "awaiting_deposit" : "active",
      })
      .select("id")
      .single();

    if (planError) throw planError;

    // Create individual installment payment records
    const payments = [];
    for (let i = 1; i <= number_of_installments; i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i);

      payments.push({
        plan_id: plan.id,
        installment_number: i,
        amount: installmentAmount,
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending",
      });
    }

    const { error: paymentsError } = await supabase.from("installment_payments").insert(payments);

    if (paymentsError) throw paymentsError;

    return new Response(
      JSON.stringify({
        success: true,
        plan_id: plan.id,
        total_amount,
        deposit_amount: deposit,
        balance_amount: balance,
        number_of_installments,
        installment_amount: installmentAmount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Installment plan error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create installment plan" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
