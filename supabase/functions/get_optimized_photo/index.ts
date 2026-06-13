/// <reference lib="deno.ns" />
/**
 * get_optimized_photo
 *
 * Generates and caches a web-optimized version of a gallery photo.
 * - Max dimension: 1920px (longest side)
 * - JPEG quality: 92%
 * - Target file size: ≤5MB
 * - Caches result in `client-photos` bucket at path: optimized/<original_path>
 *
 * Called by the RPC get_photo_download_url when optimized_photo_url is NULL.
 * Can also be called directly for batch pre-processing.
 *
 * POST body: { photo_id: string }
 * Response: { url: string, cached: boolean }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';

const MAX_DIMENSION = 1920;
const JPEG_QUALITY   = 92;   // 0-100, 92 ≈ excellent quality, good compression
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB hard cap

Deno.serve(async (req: Request) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { photo_id } = await req.json() as { photo_id: string };

    if (!photo_id) {
      return json({ error: 'photo_id is required' }, 400);
    }

    // 1. Fetch photo record
    const { data: photo, error: photoErr } = await supabaseAdmin
      .from('gallery_photos')
      .select('id, photo_url, optimized_photo_url, gallery_id')
      .eq('id', photo_id)
      .single();

    if (photoErr || !photo) {
      return json({ error: 'Photo not found' }, 404);
    }

    // 2. If already optimized, return cached URL
    if (photo.optimized_photo_url) {
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('client-photos')
        .getPublicUrl(photo.optimized_photo_url);
      return json({ url: publicUrl, cached: true });
    }

    const sourcePath = photo.photo_url as string;

    // 3. Download original from storage
    const { data: fileBlob, error: dlErr } = await supabaseAdmin.storage
      .from('client-photos')
      .download(sourcePath);

    if (dlErr || !fileBlob) {
      return json({ error: `Failed to download source: ${dlErr?.message}` }, 500);
    }

    const originalBytes = new Uint8Array(await fileBlob.arrayBuffer());

    // 4. Decode image
    let img: Image;
    try {
      img = await Image.decode(originalBytes);
    } catch (decodeErr) {
      // If decode fails (e.g., unsupported format), return original URL
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('client-photos')
        .getPublicUrl(sourcePath);
      return json({ url: publicUrl, cached: false, fallback: true });
    }

    // 5. Resize if needed (maintain aspect ratio)
    if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / img.width, MAX_DIMENSION / img.height);
      const newW = Math.round(img.width * ratio);
      const newH = Math.round(img.height * ratio);
      img = img.resize(newW, newH);
    }

    // 6. Encode as JPEG at target quality
    let encodedBytes = await img.encodeJPEG(JPEG_QUALITY);

    // 7. If still >5MB, reduce quality iteratively
    let quality = JPEG_QUALITY;
    while (encodedBytes.byteLength > MAX_FILE_BYTES && quality > 60) {
      quality -= 5;
      encodedBytes = await img.encodeJPEG(quality);
    }

    // 8. Build optimized path: prefix with "optimized/"
    const optimizedPath = `optimized/${sourcePath}`;
    const optimizedDir  = optimizedPath.substring(0, optimizedPath.lastIndexOf('/'));

    // 9. Upload optimized file to client-photos bucket
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('client-photos')
      .upload(optimizedPath, new Blob([encodedBytes], { type: 'image/jpeg' }), {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '31536000', // 1-year CDN cache
      });

    if (uploadErr) {
      console.error('[OptimizedPhoto] Upload failed:', uploadErr.message);
      // Return original as fallback
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('client-photos')
        .getPublicUrl(sourcePath);
      return json({ url: publicUrl, cached: false, fallback: true });
    }

    // 10. Update DB record with optimized path
    await supabaseAdmin
      .from('gallery_photos')
      .update({ optimized_photo_url: optimizedPath })
      .eq('id', photo_id);

    // 11. Return public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('client-photos')
      .getPublicUrl(optimizedPath);

    return json({
      url: publicUrl,
      cached: false,
      original_bytes: originalBytes.byteLength,
      optimized_bytes: encodedBytes.byteLength,
      reduction_pct: Math.round((1 - encodedBytes.byteLength / originalBytes.byteLength) * 100),
      quality_used: quality,
    });

  } catch (err) {
    console.error('[OptimizedPhoto] Error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
