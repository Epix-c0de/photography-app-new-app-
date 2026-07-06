// @ts-nocheck
/**
 * M-Pesa Test Connection
 *
 * Tests Daraja API credentials by attempting an OAuth token request.
 * Does NOT attempt a real STK push (avoids confusing the user with a phone prompt).
 *
 * Returns: { success, latencyMs, error? }
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
    const { consumer_key, consumer_secret, environment } = body;

    // Validate required fields
    if (!consumer_key || !consumer_secret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing consumer_key or consumer_secret",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!environment || !["sandbox", "production"].includes(environment)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid environment",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine base URL
    // CRITICAL: Sandbox and production must NEVER be mixed
    const baseUrl = environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    // Base64-encode credentials
    const auth = btoa(`${consumer_key}:${consumer_secret}`);

    console.log(`[mpesa-test-connection] Testing ${environment} credentials`);

    const startTime = Date.now();

    // Attempt OAuth token request
    const response = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const latencyMs = Date.now() - startTime;
    const data = await response.json();

    // Check if token was obtained successfully
    if (response.ok && data.access_token) {
      console.log(`[mpesa-test-connection] Success (${latencyMs}ms)`);

      return new Response(
        JSON.stringify({
          success: true,
          latency_ms: latencyMs,
          token_type: data.token_type || "Bearer",
          expires_in: data.expires_in || 3599,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Failed - return detailed error from Daraja
    console.error(`[mpesa-test-connection] Failed:`, data);

    return new Response(
      JSON.stringify({
        success: false,
        latency_ms: latencyMs,
        error: data.message || data.error || "Authentication failed",
        daraja_error: data,
        status_code: response.status,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[mpesa-test-connection] Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
