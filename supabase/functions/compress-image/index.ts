import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Image } from "imagescript";

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

const TARGET_SIZE = 5 * 1024 * 1024; // 5MB target

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
    const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const originalSize = imageBytes.length;

    // If already small enough, return as-is
    if (originalSize <= TARGET_SIZE) {
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode and resize using imagescript
    const img = await Image.decode(imageBytes);
    let { width, height } = img;

    // Scale down proportionally
    if (width > options.maxWidth || height > options.maxHeight) {
      const ratio = Math.min(options.maxWidth / width, options.maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const resized = img.resize(width, height);

    // Encode to JPEG with quality
    const quality = Math.round(options.quality * 100);
    const compressedBytes = await resized.encodeJPEG({ quality });
    const compressedSize = compressedBytes.length;

    // Convert to base64
    let base64 = "";
    for (let i = 0; i < compressedBytes.length; i++) {
      base64 += String.fromCharCode(compressedBytes[i]);
    }
    const compressedBase64 = btoa(base64);

    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1) + "%";

    console.log(
      `Compressed: ${originalSize} -> ${compressedSize} (${compressionRatio}), ${width}x${height}, q${quality}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        needsCompression: false,
        compressedBase64,
        originalSize,
        compressedSize,
        compressionRatio,
        format: "jpg",
        filename: (filename || "image").replace(/\.[^.]+$/, ".jpg"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
