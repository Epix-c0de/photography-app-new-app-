/// <reference lib="deno.ns" />
import { createClient } from "@supabase/supabase-js";
import { Image } from "imagescript";

// Load font from URL (Roboto Regular)
const FONT_URL = "https://github.com/google/fonts/raw/main/apache/roboto/Roboto-Regular.ttf";
let cachedFont: Uint8Array | null = null;

type PipelineBody = {
  sourceBucket: string;
  sourcePath: string;
  galleryId: string;
  watermarkText?: string;
  opacity?: number; // 0..1
};

Deno.serve(async (req: Request) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: PipelineBody = await req.json();
    const { sourceBucket, sourcePath, galleryId } = body;
    const watermarkText = body.watermarkText ?? 'Protected';
    const opacity = Math.max(0, Math.min(1, body.opacity ?? 0.25));

    // Download original
    const { data: file, error: dlError } = await supabaseAdmin.storage
      .from(sourceBucket)
      .download(sourcePath);
    if (dlError || !file) throw new Error(dlError?.message ?? 'Failed to download source image');
    const buf = new Uint8Array(await file.arrayBuffer());
    const img = await Image.decode(buf);

    if (!cachedFont) {
      const fontRes = await fetch(FONT_URL);
      if (!fontRes.ok) throw new Error("Failed to load font");
      cachedFont = new Uint8Array(await fontRes.arrayBuffer());
    }
    const font = cachedFont;

    // Generate watermark
    let wmImg = img.clone();
    const text = watermarkText || "Protected";
    // Assuming RGBA white with opacity
    const opacityVal = Math.floor(255 * (opacity ?? 0.25));
    // Render text to an image first
    // Image.renderText(font: Uint8Array, size: number, text: string, color: number)
    const textImg = await Image.renderText(
      font, 
      48, 
      text, 
      Image.rgbaToColor(255, 255, 255, opacityVal)
    );

    // Composite centered or random
    const x = Math.floor((wmImg.width - textImg.width) / 2);
    const y = Math.floor((wmImg.height - textImg.height) / 2);
    
    // Composite
    wmImg = wmImg.composite(textImg, x, y);
    
    const watermarkedBytes = await wmImg.encode();
    const watermarkedCopy = new Uint8Array(watermarkedBytes);

    // Generate thumbnail (max width 512)
    let thumbImg = img.clone();
    if (thumbImg.width > 512) {
      // Calculate height maintaining aspect ratio
      const newHeight = Math.floor((thumbImg.height * 512) / thumbImg.width);
      thumbImg = thumbImg.resize(512, newHeight);
    }
    const thumbnailBytes = await thumbImg.encode();
    const thumbnailCopy = new Uint8Array(thumbnailBytes);

    const baseName = sourcePath.split('/').pop()!;
    const nameNoExt = baseName.includes('.') ? baseName.slice(0, baseName.lastIndexOf('.')) : baseName;
    const watermarkedPath = `${galleryId}/${nameNoExt}_wm.png`;
    const thumbnailPath = `${galleryId}/${nameNoExt}_thumb.png`;

    // Upload generated assets
    const { error: wmError } = await supabaseAdmin.storage
      .from('photos-watermarked')
      .upload(watermarkedPath, new Blob([watermarkedCopy]), { contentType: 'image/png', upsert: true });
    if (wmError) throw new Error(wmError.message);

    const { error: thError } = await supabaseAdmin.storage
      .from('thumbnails')
      .upload(thumbnailPath, new Blob([thumbnailCopy]), { contentType: 'image/png', upsert: true });
    if (thError) throw new Error(thError.message);

    return new Response(
      JSON.stringify({
        watermarkedPath,
        thumbnailPath,
        width: img.width,
        height: img.height
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
