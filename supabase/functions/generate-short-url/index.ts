import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const { url, brand_slug } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "Missing url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a short code
    const shortCode = generateShortCode(brand_slug);

    // Store in database
    const { error: insertError } = await supabase
      .from("short_urls")
      .insert({
        short_code: shortCode,
        original_url: url,
        brand_slug: brand_slug || "default",
        click_count: 0,
      });

    if (insertError) {
      // If table doesn't exist, just return the original URL
      console.warn("short_urls table not found:", insertError.message);
      return new Response(
        JSON.stringify({ 
          shortUrl: url,
          message: "Short URL table not available, using original URL"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Construct short URL
    const baseUrl = Deno.env.get("SHORT_URL_BASE") || "https://epx.vc";
    const shortUrl = `${baseUrl}/${shortCode}`;

    return new Response(
      JSON.stringify({
        shortUrl,
        shortCode,
        originalUrl: url,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Short URL error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate short URL" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateShortCode(brandSlug?: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  
  // Add brand prefix if available
  if (brandSlug) {
    const prefix = brandSlug.slice(0, 2).toUpperCase();
    code += prefix;
  }
  
  // Add random characters
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
}
