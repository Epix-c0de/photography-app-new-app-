// @ts-nocheck
/**
 * M-Pesa C2B Validation Endpoint
 *
 * For direct Paybill deposits (not initiated via STK push).
 * Safaricom calls this endpoint BEFORE accepting a payment.
 * Returning a non-200 response will reject the payment.
 *
 * CRITICAL: Always respond 200 to accept the payment.
 * Log validation attempts for auditing.
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload = await req.json();

    // Log the incoming validation request
    console.log("[mpesa-c2b-validation] Received validation request:", {
      TransactionType: payload.TransactionType,
      TransID: payload.TransID,
      TransAmount: payload.TransAmount,
      BusinessShortCode: payload.BusinessShortCode,
      BillRefNumber: payload.BillRefNumber,
      MSISDN: payload.MSISDN,
    });

    // C2B Validation payload structure:
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

    // Validate required fields
    if (!payload.TransID || !payload.TransAmount || !payload.MSISDN) {
      console.error("[mpesa-c2b-validation] Missing required fields in payload");
      // Still respond 200 to avoid Safaricom retries
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Optional: Validate the business shortcode exists in our system
    const { data: gateway } = await supabase
      .from("payment_gateways")
      .select("id, client_id, is_active")
      .eq("shortcode", payload.BusinessShortCode)
      .eq("gateway_type", "paybill")
      .eq("is_active", true)
      .maybeSingle();

    if (!gateway) {
      console.warn(
        `[mpesa-c2b-validation] No active gateway found for shortcode ${payload.BusinessShortCode}`
      );
      // Accept anyway - don't reject payments to unknown shortcodes
      // Log for manual review
    }

    // Optional: Validate amount is reasonable
    const amount = parseFloat(payload.TransAmount);
    if (isNaN(amount) || amount <= 0) {
      console.error(`[mpesa-c2b-validation] Invalid amount: ${payload.TransAmount}`);
      // Accept anyway - let the confirmation handler deal with it
    }

    // Always respond 200 to accept the payment
    // Only reject if there's a critical validation failure
    console.log("[mpesa-c2b-validation] Validation passed, accepting payment");

    return new Response(
      JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Accepted",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: unknown) {
    console.error("[mpesa-c2b-validation] Error:", error);

    // ALWAYS respond 200 even on internal errors
    // Safaricom will retry relentlessly on non-200
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
