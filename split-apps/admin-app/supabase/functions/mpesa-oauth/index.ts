// @ts-nocheck
/**
 * M-Pesa OAuth Token Generator with In-Memory Caching
 *
 * CRITICAL: Daraja OAuth tokens expire after ~3599 seconds (~1 hour).
 * This function caches tokens in memory to avoid fetching a new token per-request.
 *
 * Cache key format: "{consumer_key_suffix}_{environment}"
 * Cache TTL: matches Daraja's expiry minus 1-minute buffer
 *
 * On 400/401: throws error with raw Daraja response body for debugging.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * In-memory token cache
 * Key: "{last_8_chars_of_consumer_key}_{environment}"
 * Value: { token, expiresAt }
 *
 * NOTE: This cache is per-edge-function-instance.
 * In production with multiple instances, consider using Redis/Upstash.
 */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Base64-encode credentials for Daraja Basic Auth
 */
function encodeCredentials(consumerKey: string, consumerSecret: string): string {
  return btoa(`${consumerKey}:${consumerSecret}`);
}

/**
 * Get OAuth token from cache or fetch fresh from Daraja
 *
 * @param consumerKey - Daraja consumer key
 * @param consumerSecret - Daraja consumer secret
 * @param environment - 'sandbox' or 'production'
 * @returns Access token string
 * @throws {InvalidCredentialsError} on 400/401 from Daraja
 */
async function getOAuthToken(
  consumerKey: string,
  consumerSecret: string,
  environment: "sandbox" | "production"
): Promise<string> {
  // Build cache key from last 8 chars of consumer key + environment
  const keySuffix = consumerKey.slice(-8);
  const cacheKey = `${keySuffix}_${environment}`;

  // Check cache first
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[mpesa-oauth] Cache hit for ${cacheKey}`);
    return cached.token;
  }

  // Determine base URL based on environment
  // CRITICAL: Sandbox and production must NEVER be mixed in the same request
  const baseUrl = environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

  const auth = encodeCredentials(consumerKey, consumerSecret);

  console.log(`[mpesa-oauth] Fetching fresh token for ${environment}`);

  const response = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  const data = await response.json();

  // Handle Daraja errors explicitly - never silently fail
  if (!response.ok || !data.access_token) {
    const errorMessage = data.message || data.error || "Unknown error";
    const errorCode = data.code || response.status;

    console.error(`[mpesa-oauth] Daraja auth failed:`, {
      status: response.status,
      code: errorCode,
      message: errorMessage,
      // Include raw response for debugging but NEVER log credentials
      raw_response: data,
    });

    throw new Error(
      JSON.stringify({
        type: "InvalidCredentialsError",
        message: `Failed to authenticate with Safaricom: ${errorMessage}`,
        daraja_error: data,
        environment,
        status_code: response.status,
      })
    );
  }

  // Cache the token with TTL
  // Daraja tokens expire in ~3599 seconds, we use a 1-minute buffer
  const expiresInMs = (data.expires_in || 3599) * 1000;
  const cacheExpiry = Date.now() + expiresInMs - 60000; // 1 min buffer

  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: cacheExpiry,
  });

  console.log(`[mpesa-oauth] Token cached for ${Math.round(expiresInMs / 1000)}s`);

  return data.access_token;
}

/**
 * Clear token cache (useful for testing or when credentials change)
 */
function clearCache(): void {
  tokenCache.clear();
  console.log("[mpesa-oauth] Cache cleared");
}

// ============================================================================
// Edge Function Handler
// ============================================================================
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
    const { consumer_key, consumer_secret, environment, clear_cache } = body;

    // Handle cache clear request
    if (clear_cache) {
      clearCache();
      return new Response(
        JSON.stringify({ success: true, message: "Cache cleared" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!consumer_key || !consumer_secret) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: consumer_key and consumer_secret",
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
          error: "Invalid environment: must be 'sandbox' or 'production'",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get token (from cache or fresh)
    const startTime = Date.now();
    const accessToken = await getOAuthToken(
      consumer_key,
      consumer_secret,
      environment
    );
    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        access_token: accessToken,
        latency_ms: latencyMs,
        cached: tokenCache.has(`${consumer_key.slice(-8)}_${environment}`),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[mpesa-oauth] Error:", error);

    // Parse typed error if available
    let errorMessage = "Unknown error";
    let darajaError = null;

    if (error instanceof Error) {
      try {
        const parsed = JSON.parse(error.message);
        errorMessage = parsed.message || error.message;
        darajaError = parsed.daraja_error;
      } catch {
        errorMessage = error.message;
      }
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        daraja_error: darajaError,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
