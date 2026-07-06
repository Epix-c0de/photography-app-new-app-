// @ts-nocheck
/**
 * M-Pesa STK Push - Rewrite
 *
 * Initiates an STK Push to the customer's phone via Safaricom Daraja API.
 *
 * CRITICAL QUIRKS:
 * 1. Timestamp MUST be in Africa/Nairobi timezone, format YYYYMMDDHHmmss
 * 2. TransactionType: 'CustomerPayBillOnline' for Paybill, 'CustomerBuyGoodsOnline' for Till
 * 3. Password = Base64(shortcode + passkey + timestamp)
 * 4. Amount must be >= 1 and rounded to integer
 * 5. Phone must be in 2547XXXXXXXX format
 * 6. Store CheckoutRequestID BEFORE returning to caller for polling
 * 7. Rate limit per client to prevent abuse
 * 8. Check for duplicate payments within 2-minute window
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// RATE LIMITING (in-memory, per-instance)
// ============================================================================
const RATE_LIMIT = 5; // Max STK pushes per client per minute
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

function checkRateLimit(clientId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);

  if (!entry || now > entry.resetAt) {
    // First request or window expired - allow and start new window
    rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT) {
    // Rate limit exceeded
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  // Increment count
  entry.count += 1;
  return { allowed: true };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize Kenyan phone number to 2547XXXXXXXX format
 */
function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if ((digits.startsWith("07") || digits.startsWith("01")) && digits.length === 10)
    return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  return null;
}

/**
 * Get timestamp in Africa/Nairobi timezone (YYYYMMDDHHmmss)
 * CRITICAL: Wrong timezone silently breaks STK push with a cryptic 400
 */
function getNairobiTimestamp(): string {
  const now = new Date();
  const nairobiTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Africa/Nairobi" })
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${nairobiTime.getFullYear()}${pad(nairobiTime.getMonth() + 1)}${pad(
    nairobiTime.getDate()
  )}${pad(nairobiTime.getHours())}${pad(nairobiTime.getMinutes())}${pad(
    nairobiTime.getSeconds()
  )}`;
}

/**
 * Generate STK Push password
 * Password = Base64(shortcode + passkey + timestamp)
 */
function generatePassword(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

/**
 * Map Safaricom result codes to human-readable messages
 */
function mapResultCode(code: number): string {
  const codes: Record<number, string> = {
    1032: "Request cancelled by user",
    1037: "Request timed out",
    1: "Insufficient balance",
    2001: "Wrong M-Pesa PIN entered",
    1039: "Invalid developer/plugin ID",
    2003: "Duplicate transaction reference",
  };
  return codes[code] || `Payment failed (code: ${code})`;
}

// ============================================================================
// EDGE FUNCTION HANDLER
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

    const { phone_number, amount, gallery_id, account_reference, description } =
      await req.json();

    // ── VALIDATE INPUTS ──────────────────────────────────────────────
    if (!phone_number || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone_number, amount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(String(phone_number));
    if (!normalizedPhone) {
      return new Response(
        JSON.stringify({
          error: "Invalid phone number. Use format: 0712345678 or 254712345678",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountToCharge = Math.max(1, Math.round(Number(amount)));
    if (isNaN(amountToCharge) || amountToCharge <= 0) {
      return new Response(
        JSON.stringify({ error: "Amount must be a positive number" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── FETCH GALLERY IF PROVIDED ────────────────────────────────────
    let clientId = null;
    let galleryName = description || "Payment";

    // Use gallery owner or a default key for rate limiting
    let rateLimitKey = "default";

    if (gallery_id) {
      const { data: gallery, error: galleryError } = await supabase
        .from("galleries")
        .select("id, owner_admin_id, client_id, name, is_locked, is_paid")
        .eq("id", gallery_id)
        .single();

      if (galleryError || !gallery) {
        return new Response(
          JSON.stringify({ error: "Gallery not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!gallery.is_locked || gallery.is_paid) {
        return new Response(
          JSON.stringify({ error: "Gallery is already unlocked or paid" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      clientId = gallery.client_id;
      galleryName = `Unlock Gallery: ${gallery.name}`;
      rateLimitKey = gallery.owner_admin_id || "default";

      // ── PREVENT DUPLICATE PAYMENTS ─────────────────────────────────
      // Check for existing successful or recent pending transactions
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: existingTx } = await supabase
        .from("mpesa_transactions")
        .select("id, status, created_at")
        .eq("gallery_id", gallery_id)
        .or(
          `status.eq.success,and(status.eq.pending,created_at.gt.${tenMinutesAgo})`
        )
        .maybeSingle();

      if (existingTx) {
        if (existingTx.status === "success") {
          return new Response(
            JSON.stringify({ error: "Gallery already paid" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        return new Response(
          JSON.stringify({
            error: "A payment is already pending. Please wait 10 minutes before retrying.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ── GET PAYMENT SETTINGS ─────────────────────────────────────────
    // Try simple_payment_settings first, then advanced payment_settings
    let mpesaSettings = null;

    // First try Simple Payment Settings
    const { data: simpleSettings } = await supabase
      .from("simple_payment_settings")
      .select("*")
      .eq("admin_id", gallery?.owner_admin_id || "")
      .maybeSingle();

    if (simpleSettings && simpleSettings.mpesa_number) {
      // Use platform-wide credentials
      mpesaSettings = {
        environment: "sandbox",
        consumer_key: Deno.env.get("PLATFORM_MPESA_CONSUMER_KEY") || Deno.env.get("MPESA_CONSUMER_KEY"),
        consumer_secret: Deno.env.get("PLATFORM_MPESA_CONSUMER_SECRET") || Deno.env.get("MPESA_CONSUMER_SECRET"),
        shortcode: Deno.env.get("PLATFORM_MPESA_SHORTCODE") || Deno.env.get("MPESA_SHORTCODE"),
        passkey: Deno.env.get("PLATFORM_MPESA_PASSKEY") || Deno.env.get("MPESA_PASSKEY"),
      };
    } else {
      // Fallback to advanced Daraja settings
      const { data: advancedSettings, error: settingsError } = await supabase
        .from("payment_settings")
        .select("*")
        .eq("admin_id", gallery?.owner_admin_id || "")
        .single();

      if (settingsError || !advancedSettings) {
        console.error("Payment settings missing for admin:", gallery?.owner_admin_id);
        return new Response(
          JSON.stringify({
            error: "M-PESA is not configured. Please set up payment in admin settings.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      mpesaSettings = advancedSettings;
    }

    const {
      environment,
      consumer_key,
      consumer_secret,
      shortcode,
      passkey,
    } = mpesaSettings;

    if (!consumer_key || !consumer_secret || !shortcode || !passkey) {
      return new Response(
        JSON.stringify({ error: "M-PESA configuration is incomplete" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── DETERMINE BASE URL ──────────────────────────────────────────
    // CRITICAL: Sandbox and production must NEVER be mixed
    const baseUrl =
      environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    // ── CHECK RATE LIMIT ────────────────────────────────────────────
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: `Too many payment attempts. Please wait ${Math.ceil((rateCheck.retryAfterMs || 0) / 1000)} seconds.`,
          retry_after_ms: rateCheck.retryAfterMs,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── GENERATE ACCESS TOKEN ────────────────────────────────────────
    const auth = btoa(`${consumer_key}:${consumer_secret}`);
    const tokenRes = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("Failed to get access token:", tokenData);
      return new Response(
        JSON.stringify({
          error: "Failed to authenticate with Safaricom",
          daraja_error: tokenData,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── GENERATE PASSWORD AND TIMESTAMP ──────────────────────────────
    // CRITICAL: Timestamp must be in Africa/Nairobi timezone
    const timestamp = getNairobiTimestamp();
    const password = generatePassword(shortcode, passkey, timestamp);

    // ── INITIATE STK PUSH ───────────────────────────────────────────
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;
    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      // CRITICAL: TransactionType depends on gateway type
      // Paybill: 'CustomerPayBillOnline'
      // Till: 'CustomerBuyGoodsOnline'
      TransactionType: "CustomerPayBillOnline",
      Amount: amountToCharge,
      PartyA: normalizedPhone,
      PartyB: shortcode,
      PhoneNumber: normalizedPhone,
      CallBackURL: callbackUrl,
      AccountReference: account_reference || `GAL-${(gallery_id || "TXN").slice(0, 8).toUpperCase()}`,
      TransactionDesc: galleryName,
    };

    // Log request (NEVER log credentials or passkey)
    console.log("[mpesa-stk-push] Initiating STK Push:", {
      shortcode,
      environment,
      amount: amountToCharge,
      phone: normalizedPhone.substring(0, 6) + "****", // Mask phone
    });

    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkBody),
    });

    const stkData = await stkRes.json();

    // Log response (mask sensitive data)
    console.log("[mpesa-stk-push] STK Push response:", {
      ResponseCode: stkData.ResponseCode,
      ResponseDescription: stkData.ResponseDescription,
    });

    if (stkData.ResponseCode !== "0") {
      return new Response(
        JSON.stringify({
          error: stkData.ResponseDescription || "STK Push failed",
          daraja_error: stkData,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── CREATE TRANSACTION RECORD ────────────────────────────────────
    // Store CheckoutRequestID BEFORE returning for polling
    const { error: insertError } = await supabase.from("mpesa_transactions").insert({
      gallery_id: gallery_id || null,
      client_id: clientId,
      phone_number: normalizedPhone,
      amount: amountToCharge,
      merchant_request_id: stkData.MerchantRequestID,
      checkout_request_id: stkData.CheckoutRequestID,
      status: "pending",
    });

    if (insertError) {
      console.error("Failed to record mpesa transaction:", insertError);
      // Don't fail the request - the STK push was sent successfully
    }

    // Also add to unified transactions table
    await supabase.from("transactions").insert({
      client_id: clientId,
      phone_number: normalizedPhone,
      amount: amountToCharge,
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      status: "pending",
      transaction_type: "stk_push",
    });

    // Also add to global payments table for unified history/accounting
    const { error: paymentError } = await supabase.from("payments").insert({
      owner_admin_id: gallery?.owner_admin_id || null,
      client_id: clientId,
      gallery_id: gallery_id || null,
      amount: amountToCharge,
      status: "pending",
      mpesa_checkout_request_id: stkData.CheckoutRequestID,
      phone_number: normalizedPhone,
    });

    if (paymentError) {
      console.error("Failed to record global payment:", paymentError);
    }

    return new Response(
      JSON.stringify({
        message: "STK Push sent successfully",
        checkout_request_id: stkData.CheckoutRequestID,
        ...stkData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
