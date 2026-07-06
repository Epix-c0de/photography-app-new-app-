// @ts-nocheck
/**
 * M-Pesa STK Push Query
 *
 * Fallback endpoint for cases where the callback never arrives.
 * Calls Daraja's /mpesa/stkpushquery/v1/query to ask Safaricom
 * for the transaction status directly.
 *
 * Use this as a final check before showing timeout messages to users.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Get OAuth token (simplified version - in production, share cache with mpesa-oauth)
 */
async function getAccessToken(
  consumerKey: string,
  consumerSecret: string,
  baseUrl: string
): Promise<string> {
  const auth = btoa(`${consumerKey}:${consumerSecret}`);
  const response = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  const data = await response.json();
  if (!data.access_token) {
    throw new Error("Failed to get access token");
  }
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { checkout_request_id, environment } = body;

    if (!checkout_request_id) {
      return new Response(
        JSON.stringify({ error: "Missing checkout_request_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine base URL
    const baseUrl = environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    // Get credentials from environment or request
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY") || body.consumer_key;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET") || body.consumer_secret;

    if (!consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ error: "Missing M-Pesa credentials" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get access token
    const accessToken = await getAccessToken(consumerKey, consumerSecret, baseUrl);

    // Query STK Push status
    const response = await fetch(
      `${baseUrl}/mpesa/stkpushquery/v1/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          CheckoutRequestID: checkout_request_id,
        }),
      }
    );

    const data = await response.json();

    // Parse response
    const resultCode = parseInt(data.ResultCode || "-1");
    const isPending = resultCode === 1032; // Request in progress
    const isSuccess = resultCode === 0;
    const isFailed = !isPending && !isSuccess;

    // Map common result codes
    const resultCodeMessages: Record<number, string> = {
      0: "Success",
      1032: "Request still in progress (pending)",
      1037: "Request timed out",
      1: "Insufficient balance",
      2001: "Wrong PIN",
    };

    return new Response(
      JSON.stringify({
        result_code: resultCode,
        result_description: data.ResultDesc || resultCodeMessages[resultCode] || "Unknown",
        checkout_request_id,
        is_success: isSuccess,
        is_pending: isPending,
        is_failed: isFailed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[mpesa-stkquery] Error:", error);
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
