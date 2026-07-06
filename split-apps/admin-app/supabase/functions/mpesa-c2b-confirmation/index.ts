// @ts-nocheck
/**
 * M-Pesa C2B Confirmation Endpoint
 *
 * For direct Paybill deposits (not initiated via STK push).
 * Safaricom calls this endpoint AFTER a payment is completed.
 *
 * CRITICAL: Always respond 200 to Safaricom regardless of internal processing outcome,
 * or they will retry relentlessly. Log internal failures separately.
 *
 * Idempotency: Check if TransID has already been processed before acting.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Map known Safaricom result codes to human-readable reasons
 */
function mapResultCode(code: number): string {
  const codes: Record<number, string> = {
    0: "Success",
    1032: "Request cancelled by user",
    1037: "Request timed out",
    1: "Insufficient balance",
    2001: "Wrong M-Pesa PIN entered",
    2003: "Duplicate transaction reference",
    2026: "Debit account insufficient funds",
    2027: "Credit account does not exist",
  };
  return codes[code] || `Payment failed (code: ${code})`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json();

    // C2B Confirmation payload structure:
    // {
    //   TransactionType: "PayBill",
    //   TransID: "QHH13B0BHD",
    //   TransTime: "20230801143022",
    //   TransAmount: 100,
    //   BusinessShortCode: "123456",
    //   BillRefNumber: "Account123",
    //   InvoiceNumber: "",
    //   OrgAccountBalance: 10000,
    //   ThirdPartyTransID: "",
    //   MSISDN: "254712345678",
    //   FirstName: "John",
    //   MiddleName: "Doe",
    //   LastName: "Smith"
    // }

    console.log("[mpesa-c2b-confirmation] Received confirmation:", {
      TransID: payload.TransID,
      TransAmount: payload.TransAmount,
      MSISDN: payload.MSISDN,
      BillRefNumber: payload.BillRefNumber,
    });

    // Validate required fields
    if (!payload.TransID || !payload.TransAmount || !payload.MSISDN) {
      console.error("[mpesa-c2b-confirmation] Missing required fields");
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // IDEMPOTENCY CHECK: Skip if already processed
    const { data: existingTransaction } = await supabase
      .from("transactions")
      .select("id, status")
      .eq("trans_id", payload.TransID)
      .maybeSingle();

    if (existingTransaction && existingTransaction.status !== "pending") {
      console.log(
        `[mpesa-c2b-confirmation] Transaction ${payload.TransID} already processed, skipping`
      );
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Already processed" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Find the gateway for this shortcode
    const { data: gateway } = await supabase
      .from("payment_gateways")
      .select("id, client_id")
      .eq("shortcode", payload.BusinessShortCode)
      .eq("gateway_type", "paybill")
      .eq("is_active", true)
      .maybeSingle();

    // Parse transaction time
    const transTime = payload.TransTime
      ? new Date(
          payload.TransTime.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
            "$1-$2-$3T$4:$5:$6"
        )
      )
      : new Date();

    const amount = parseFloat(payload.TransAmount);
    const clientId = gateway?.client_id || null;
    const gatewayId = gateway?.id || null;

    // Create or update transaction record
    if (existingTransaction) {
      // Update existing pending transaction
      await supabase
        .from("transactions")
        .update({
          status: "success",
          trans_id: payload.TransID,
          mpesa_receipt_number: payload.TransID,
          result_code: 0,
          result_desc: "C2B payment confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTransaction.id);
    } else {
      // Create new transaction record
      await supabase.from("transactions").insert({
        client_id: clientId,
        gateway_id: gatewayId,
        trans_id: payload.TransID,
        phone_number: payload.MSISDN,
        amount: amount,
        status: "success",
        mpesa_receipt_number: payload.TransID,
        result_code: 0,
        result_desc: "C2B payment confirmed",
        transaction_type: "c2b",
        account_reference: payload.BillRefNumber,
        created_at: transTime.toISOString(),
      });
    }

    // Also update the old mpesa_transactions table for backward compatibility
    const { data: existingMpesaTx } = await supabase
      .from("mpesa_transactions")
      .select("id")
      .eq("checkout_request_id", payload.TransID)
      .maybeSingle();

    if (!existingMpesaTx) {
      await supabase.from("mpesa_transactions").insert({
        phone_number: payload.MSISDN,
        amount: amount,
        status: "success",
        mpesa_receipt: payload.TransID,
        checkout_request_id: payload.TransID,
      });
    }

    // Also update the old payments table for backward compatibility
    await supabase
      .from("payments")
      .update({
        status: "paid",
        mpesa_receipt_number: payload.TransID,
        updated_at: new Date().toISOString(),
      })
      .eq("mpesa_checkout_request_id", payload.TransID);

    console.log(
      `[mpesa-c2b-confirmation] Transaction ${payload.TransID} processed successfully`
    );

    // ALWAYS respond 200 to Safaricom
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: unknown) {
    console.error("[mpesa-c2b-confirmation] Error:", error);

    // ALWAYS respond 200 to Safaricom even on internal errors
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
