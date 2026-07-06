import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: "jpeg" | "webp" | "png";
}

const PRESETS: Record<string, CompressionOptions> = {
  thumbnail: { maxWidth: 400, maxHeight: 400, quality: 80, format: "jpeg" },
  preview: { maxWidth: 1200, maxHeight: 1200, quality: 85, format: "jpeg" },
  standard: { maxWidth: 2400, maxHeight: 2400, quality: 88, format: "jpeg" },
  full: { maxWidth: 4000, maxHeight: 4000, quality: 90, format: "jpeg" },
};

const TARGET_SIZES = {
  maxBytes: 10 * 1024 * 1024, // 10MB
  targetBytes: 5 * 1024 * 1024, // 5MB target
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, preset = "standard", filename } = await req.json();

    if (!imageBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: "Missing imageBase64 or mimeType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const options = PRESETS[preset] || PRESETS.standard;

    // Decode base64 to bytes
    const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));

    // Use client-side compression info to guide server-side
    // Since Edge Functions don't have ImageMagick, we return the original
    // with compression recommendations for the client to handle
    const originalSize = imageBytes.length;

    // If already small enough, return as-is
    if (originalSize <= TARGET_SIZES.targetBytes) {
      return new Response(
        JSON.stringify({
          success: true,
          needsCompression: false,
          compressedBase64: imageBase64,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: "0%",
          format: mimeType.includes("png") ? "png" : "jpg",
          filename: filename || "image",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // For large images, signal that client-side compression is needed
    // The client will use Canvas API to compress
    return new Response(
      JSON.stringify({
        success: true,
        needsCompression: true,
        recommendation: {
          maxWidth: options.maxWidth,
          quality: options.quality,
          preset,
        },
        originalSize,
        message: "Image too large for server compression. Use client-side compression.",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Compression error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Compression failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
