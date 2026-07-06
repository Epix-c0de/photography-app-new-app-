// @ts-nocheck
/**
 * M-Pesa C2B URL Registration
 *
 * For Paybill only: one-time setup call to register ValidationURL and ConfirmationURL
 * with Safaricom's C2B API. This is called automatically right after a Paybill
 * config is saved and verified, NOT left as a manual step.
 *
 * Endpoint: POST /mpesa/c2b/v1/registerurl
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Get OAuth token
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
    const {
      gateway_id,
      shortcode,
      consumer_key,
      consumer_secret,
      environment,
      validation_url,
      confirmation_url,
    } = body;

    // Validate required fields
    if (!shortcode || !consumer_key || !consumer_secret) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only Paybill supports C2B URL registration
    // Till numbers use Buy Goods which doesn't support C2B registration
    console.log(`[mpesa-c2b-register] Registering C2B URLs for Paybill ${shortcode}`);

    // Determine base URL
    const baseUrl = environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    // Get access token
    const accessToken = await getAccessToken(consumer_key, consumer_secret, baseUrl);

    // Register C2B URLs
    // ValidationURL: Called before accepting a payment (can reject)
    // ConfirmationURL: Called after payment is completed (for processing)
    const response = await fetch(
      `${baseUrl}/mpesa/c2b/v1/registerurl`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ShortCode: shortcode,
          ResponseType: "Completed", // "Completed" or "Cancelled"
          ValidationURL: validation_url,
          ConfirmationURL: confirmation_url,
        }),
      }
    );

    const data = await response.json();

    if (data.ResponseCode === "0" || data.ResponseDescription) {
      console.log(`[mpesa-c2b-register] Success:`, data);

      return new Response(
        JSON.stringify({
          success: true,
          message: data.ResponseDescription || "C2B URLs registered successfully",
          gateway_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Registration failed
    console.error(`[mpesa-c2b-register] Failed:`, data);

    return new Response(
      JSON.stringify({
        success: false,
        error: data.errorMessage || data.ResponseDescription || "Registration failed",
        daraja_error: data,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[mpesa-c2b-register] Error:", error);
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
