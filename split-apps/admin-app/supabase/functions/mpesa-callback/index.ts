// @ts-nocheck
/**
 * M-Pesa Callback Handler - Rewrite
 *
 * POST /mpesa-callback
 *
 * Handles both STK Push and C2B callbacks from Safaricom.
 *
 * CRITICAL RULES:
 * 1. ALWAYS respond 200 with {"ResultCode":0,"ResultDesc":"Success"} to Safaricom
 *    regardless of internal processing outcome, or they will retry relentlessly
 * 2. Handle retries idempotently - check if CheckoutRequestID already processed
 * 3. Parse CallbackMetadata defensively - fields can be ABSENT
 * 4. Map known Safaricom result codes to human-readable reasons
 * 5. Log internal failures separately - never surface as non-200 to Daraja
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

/**
 * Handle STK Push callback
 *
 * CallbackMetadata structure:
 * {
 *   stkCallback: {
 *     MerchantRequestID: "...",
 *     CheckoutRequestID: "...",
 *     ResultCode: 0,
 *     ResultDesc: "...",
 *     CallbackMetadata: {
 *       Item: [
 *         { Name: "Amount", Value: 100 },
 *         { Name: "MpesaReceiptNumber", Value: "QHH13B0BHD" },
 *         { Name: "Balance" },
 *         { Name: "TransactionDate", Value: 20230801143022 },
 *         { Name: "PhoneNumber", Value: 254712345678 }
 *       ]
 *     }
 *   }
 * }
 *
 * NOTE: Fields can be ABSENT - always check before accessing
 */
async function handleSTKCallback(supabase: any, stkCallback: any) {
  const {
    MerchantRequestID,
    CheckoutRequestID,
    ResultCode,
    ResultDesc,
    CallbackMetadata,
  } = stkCallback;

  console.log("[mpesa-callback] STK callback received:", {
    CheckoutRequestID,
    ResultCode,
  });

  // ── IDEMPOTENCY CHECK ─────────────────────────────────────────────
  // Check if this transaction has already been processed
  const { data: existingTransaction, error: existingError } = await supabase
    .from("mpesa_transactions")
    .select("id, status")
    .eq("checkout_request_id", CheckoutRequestID)
    .maybeSingle();

  if (existingError) {
    console.error("[mpesa-callback] Error checking existing transaction:", existingError);
  }

  // Skip if already processed (not pending)
  if (existingTransaction && existingTransaction.status !== "pending") {
    console.log(
      `[mpesa-callback] Transaction ${CheckoutRequestID} already processed as ${existingTransaction.status}, skipping`
    );
    return;
  }

  if (!existingTransaction) {
    console.error(
      `[mpesa-callback] No pending transaction found for ${CheckoutRequestID}`
    );
    // Still process - Safaricom might send callback before our insert completes
  }

  // ── PARSE RESULT ──────────────────────────────────────────────────
  if (ResultCode === 0) {
    // SUCCESS: Extract fields from CallbackMetadata
    // CRITICAL: Safaricom returns this as an array of {Name, Value} objects
    // Fields can be ABSENT - parse defensively
    const items = CallbackMetadata?.Item || [];

    const getMetaValue = (name: string) => {
      const item = items.find((i: any) => i.Name === name);
      return item?.Value;
    };

    const mpesaReceipt = getMetaValue("MpesaReceiptNumber") || "";
    const transactionDate = getMetaValue("TransactionDate");
    const phoneNumber = getMetaValue("PhoneNumber");
    const amount = getMetaValue("Amount");

    console.log("[mpesa-callback] Payment successful:", {
      Receipt: mpesaReceipt,
      Amount: amount,
    });

    // ── UPDATE MPESA TRANSACTIONS TABLE ──────────────────────────────
    await supabase
      .from("mpesa_transactions")
      .update({
        status: "success",
        mpesa_receipt: mpesaReceipt,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", CheckoutRequestID);

    // ── UPDATE UNIFIED TRANSACTIONS TABLE ────────────────────────────
    await supabase
      .from("transactions")
      .update({
        status: "success",
        mpesa_receipt_number: mpesaReceipt,
        result_code: ResultCode,
        result_desc: ResultDesc,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", CheckoutRequestID);

    // ── UPDATE PAYMENTS TABLE (backward compatibility) ───────────────
    await supabase
      .from("payments")
      .update({
        status: "paid",
        mpesa_receipt_number: mpesaReceipt,
        updated_at: new Date().toISOString(),
      })
      .eq("mpesa_checkout_request_id", CheckoutRequestID);

    // ── UNLOCK GALLERY IF APPLICABLE ─────────────────────────────────
    // Get gallery_id from the transaction
    const { data: txData } = await supabase
      .from("mpesa_transactions")
      .select("gallery_id")
      .eq("checkout_request_id", CheckoutRequestID)
      .maybeSingle();

    if (txData?.gallery_id) {
      await supabase
        .from("galleries")
        .update({ is_paid: true, is_locked: false })
        .eq("id", txData.gallery_id);

      console.log(`[mpesa-callback] Gallery ${txData.gallery_id} unlocked`);
    }
  } else {
    // FAILURE: Update status and record the failure reason
    const failureReason = mapResultCode(ResultCode);

    console.log("[mpesa-callback] Payment failed:", {
      ResultCode,
      Reason: failureReason,
    });

    // ── UPDATE MPESA TRANSACTIONS TABLE ──────────────────────────────
    await supabase
      .from("mpesa_transactions")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", CheckoutRequestID);

    // ── UPDATE UNIFIED TRANSACTIONS TABLE ────────────────────────────
    await supabase
      .from("transactions")
      .update({
        status: "failed",
        result_code: ResultCode,
        result_desc: failureReason,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", CheckoutRequestID);

    // ── UPDATE PAYMENTS TABLE (backward compatibility) ───────────────
    await supabase
      .from("payments")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("mpesa_checkout_request_id", CheckoutRequestID);
  }
}

/**
 * Handle C2B callback (direct Paybill deposits)
 *
 * C2B callback structure:
 * {
 *   c2bCallback: {
 *     TransactionType: "PayBill",
 *     TransID: "QHH13B0BHD",
 *     TransTime: "20230801143022",
 *     TransAmount: 100,
 *     BusinessShortCode: "123456",
 *     BillRefNumber: "Account123",
 *     MSISDN: "254712345678",
 *     FirstName: "John",
 *     ...
 *   }
 * }
 */
async function handleC2BCallback(supabase: any, c2bCallback: any) {
  const {
    TransactionType,
    TransID,
    TransTime,
    TransAmount,
    BusinessShortCode,
    BillRefNumber,
    MSISDN,
    FirstName,
    MiddleName,
    LastName,
  } = c2bCallback;

  console.log(`[mpesa-callback] C2B payment received: ${TransAmount} from ${MSISDN}`);

  // ── IDEMPOTENCY CHECK ─────────────────────────────────────────────
  const { data: existingTx } = await supabase
    .from("transactions")
    .select("id, status")
    .eq("trans_id", TransID)
    .maybeSingle();

  if (existingTx && existingTx.status !== "pending") {
    console.log(`[mpesa-callback] C2B transaction ${TransID} already processed, skipping`);
    return;
  }

  // ── FIND GATEWAY FOR THIS SHORTCODE ───────────────────────────────
  const { data: gateway } = await supabase
    .from("payment_gateways")
    .select("id, client_id")
    .eq("shortcode", BusinessShortCode)
    .eq("gateway_type", "paybill")
    .eq("is_active", true)
    .maybeSingle();

  // ── FIND ADMIN WITH THIS MOBILE NUMBER (backward compatibility) ───
  const { data: adminSettings } = await supabase
    .from("simple_payment_settings")
    .select("admin_id, mpesa_number, business_name, auto_verification")
    .eq("mpesa_number", BillRefNumber || MSISDN)
    .maybeSingle();

  if (!gateway && !adminSettings) {
    console.error(
      `[mpesa-callback] No gateway or admin found for shortcode ${BusinessShortCode}`
    );
    return;
  }

  // ── PARSE TRANSACTION TIME ────────────────────────────────────────
  const transTime = TransTime
    ? new Date(
        TransTime.replace(
          /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
          "$1-$2-$3T$4:$5:$6"
        )
      )
    : new Date();

  const amount = parseFloat(TransAmount);
  const clientId = gateway?.client_id || null;
  const gatewayId = gateway?.id || null;

  // ── CREATE/UPDATE TRANSACTION RECORD ──────────────────────────────
  if (existingTx) {
    await supabase
      .from("transactions")
      .update({
        status: "success",
        trans_id: TransID,
        mpesa_receipt_number: TransID,
        result_code: 0,
        result_desc: "C2B payment confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingTx.id);
  } else {
    await supabase.from("transactions").insert({
      client_id: clientId,
      gateway_id: gatewayId,
      trans_id: TransID,
      phone_number: MSISDN,
      amount: amount,
      status: "success",
      mpesa_receipt_number: TransID,
      result_code: 0,
      result_desc: "C2B payment confirmed",
      transaction_type: "c2b",
      account_reference: BillRefNumber,
      created_at: transTime.toISOString(),
    });
  }

  // ── BACKWARD COMPATIBILITY: Update old tables ─────────────────────
  await supabase
    .from("mpesa_transactions")
    .update({
      status: "success",
      mpesa_receipt: TransID,
      updated_at: new Date().toISOString(),
    })
    .eq("checkout_request_id", TransID);

  await supabase
    .from("payments")
    .update({
      status: "paid",
      mpesa_receipt_number: TransID,
      updated_at: new Date().toISOString(),
    })
    .eq("mpesa_checkout_request_id", TransID);

  console.log(`[mpesa-callback] C2B transaction ${TransID} processed successfully`);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
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

    // Log the incoming callback (mask sensitive data)
    console.log("[mpesa-callback] Received callback:", {
      hasStkCallback: !!payload.Body?.stkCallback,
      hasC2bCallback: !!payload.Body?.c2bCallback,
    });

    // ── HANDLE BOTH STK PUSH AND C2B CALLBACKS ──────────────────────
    const stkCallback = payload.Body?.stkCallback;
    const c2bCallback = payload.Body?.c2bCallback;

    if (stkCallback) {
      await handleSTKCallback(supabase, stkCallback);
    } else if (c2bCallback) {
      await handleC2BCallback(supabase, c2bCallback);
    } else {
      console.error("[mpesa-callback] Invalid payload - neither STK nor C2B");
      // Still respond 200 to avoid Safaricom retries
    }

    // ── ALWAYS RESPOND 200 TO SAFARICOM ─────────────────────────────
    // CRITICAL: Regardless of internal processing outcome,
    // always respond with success, or Safaricom will retry relentlessly
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
    console.error("[mpesa-callback] Error:", error);

    // ALWAYS respond 200 even on internal errors
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
