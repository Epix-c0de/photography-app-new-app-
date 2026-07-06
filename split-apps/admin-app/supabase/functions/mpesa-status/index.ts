// @ts-nocheck
/**
 * M-Pesa Transaction Status Endpoint
 *
 * GET /mpesa-status?checkout_request_id=xxx
 *
 * Simply reads the transactions table row by CheckoutRequestID.
 * Returns: { status, receiptNumber?, failureReason? }
 *
 * This is what the polling UI in the client app hits.
 * Keep this as a pure read - all actual state transitions
 * happen in the callback handler (mpesa-callback), not here.
 */

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
    const url = new URL(req.url);
    const checkoutRequestId = url.searchParams.get("checkout_request_id");

    if (!checkoutRequestId) {
      return new Response(
        JSON.stringify({ error: "Missing checkout_request_id parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Query the transaction by CheckoutRequestID
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("status, mpesa_receipt_number, result_code, result_desc, amount, phone_number, created_at")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    if (error) {
      console.error("[mpesa-status] Database error:", error);
      return new Response(
        JSON.stringify({ error: "Database query failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!transaction) {
      // Transaction not found - could be pending or invalid
      return new Response(
        JSON.stringify({
          status: "pending",
          message: "Transaction not found or still processing",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the transaction status
    return new Response(
      JSON.stringify({
        status: transaction.status,
        receipt_number: transaction.mpesa_receipt_number || null,
        failure_reason: transaction.result_desc || null,
        result_code: transaction.result_code || null,
        amount: transaction.amount,
        phone_number: transaction.phone_number,
        created_at: transaction.created_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[mpesa-status] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
