import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const accessCodeRaw = body?.access_code;
    if (!accessCodeRaw) {
      throw new Error("Missing access_code");
    }

    const identifier =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: attempt } = await adminClient
      .from("access_code_attempts")
      .select("attempts, window_start")
      .eq("identifier", identifier)
      .maybeSingle();

    if (attempt) {
      const windowStart = new Date(attempt.window_start).getTime();
      if (now - windowStart > WINDOW_MS) {
        await adminClient
          .from("access_code_attempts")
          .update({ attempts: 1, window_start: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("identifier", identifier);
      } else if (attempt.attempts >= MAX_ATTEMPTS) {
        return new Response(JSON.stringify({ error: "Too many attempts" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        await adminClient
          .from("access_code_attempts")
          .update({ attempts: attempt.attempts + 1, updated_at: new Date().toISOString() })
          .eq("identifier", identifier);
      }
    } else {
      await adminClient.from("access_code_attempts").insert({
        identifier,
        attempts: 1,
      });
    }

    const accessCode = String(accessCodeRaw).trim().toUpperCase();
    const { data: gallery, error: galleryError } = await adminClient
      .from("galleries")
      .select("id, access_code, is_active, expires_at, total_photos, client_name, upload_status")
      .eq("access_code", accessCode)
      .eq("is_active", true)
      .eq("upload_status", "completed")
      .maybeSingle();
    if (galleryError || !gallery) {
      throw new Error("Gallery not found");
    }
    if (gallery.expires_at && new Date(gallery.expires_at).getTime() <= now) {
      throw new Error("Gallery expired");
    }

    const { data: photos, error: photosError } = await adminClient
      .from("photos")
      .select("id, file_url, file_name, file_size, mime_type, upload_status, created_at, galleries!inner(is_active)")
      .eq("gallery_id", gallery.id)
      .eq("upload_status", "uploaded")
      .eq("galleries.is_active", true)
      .order("created_at", { ascending: true });
    if (photosError) throw photosError;

    type PhotoRow = {
      id: string;
      file_url: string;
      file_name: string | null;
      file_size: number | null;
      mime_type: string | null;
      upload_status: string;
      created_at: string;
    };
    type SignedUrlRow = {
      path: string;
      signedUrl: string;
      error?: string;
    };

    const photoRows = (photos as PhotoRow[] | null) || [];
    const paths = photoRows.map((p) => p.file_url).filter((p) => !!p);
    const signedMap = new Map<string, string>();
    const cdnBase = Deno.env.get("STORAGE_CDN_BASE_URL") ?? "";
    if (paths.length > 0) {
      const { data: signedUrls, error: signedError } = await adminClient.storage
        .from("client-photos")
        .createSignedUrls(paths, 3600);
      if (signedError) throw signedError;
      const signedRows = (signedUrls as SignedUrlRow[] | null) || [];
      signedRows.forEach((item) => {
        if (item?.path && item?.signedUrl) {
          if (cdnBase) {
            const parsed = new URL(item.signedUrl);
            const base = cdnBase.endsWith("/") ? cdnBase.slice(0, -1) : cdnBase;
            signedMap.set(item.path, `${base}${parsed.pathname}${parsed.search}`);
          } else {
            signedMap.set(item.path, item.signedUrl);
          }
        }
      });
    }

    const responsePhotos = photoRows.map((p) => ({
      id: p.id,
      file_url: p.file_url,
      signed_url: signedMap.get(p.file_url) || null,
      file_name: p.file_name,
      file_size: p.file_size,
      mime_type: p.mime_type,
      created_at: p.created_at,
    }));

    return new Response(
      JSON.stringify({
        gallery_id: gallery.id,
        client_name: gallery.client_name,
        access_code: gallery.access_code,
        total_photos: gallery.total_photos,
        photos: responsePhotos,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
