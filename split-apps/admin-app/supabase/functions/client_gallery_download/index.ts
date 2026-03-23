import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const resolveIds = (url: string) => {
  const { pathname, searchParams } = new URL(url);
  const segments = pathname.split("/").filter(Boolean);
  const functionIndex = segments.indexOf("client_gallery_download");
  const galleryFromPath = functionIndex >= 0 ? segments[functionIndex + 1] : null;
  const photoFromPath = functionIndex >= 0 ? segments[functionIndex + 2] : null;
  return {
    galleryId: galleryFromPath || searchParams.get("gallery_id"),
    photoId: photoFromPath || searchParams.get("photo_id"),
  };
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { galleryId, photoId } = resolveIds(req.url);
    if (!galleryId || !photoId) {
      throw new Error("Missing identifiers");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: gallery, error: galleryError } = await adminClient
      .from("galleries")
      .select("id, client_id, is_paid")
      .eq("id", galleryId)
      .maybeSingle();
    if (galleryError || !gallery) {
      throw new Error("Gallery not found");
    }
    if (!gallery.is_paid) {
      return new Response(JSON.stringify({ error: "Payment required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: client } = await adminClient
      .from("clients")
      .select("id, user_id")
      .eq("id", gallery.client_id)
      .maybeSingle();
    if (!client || client.user_id !== user.id) {
      throw new Error("Forbidden");
    }

    const { data: photo, error: photoError } = await adminClient
      .from("photos")
      .select("id, file_url, file_name, file_size, mime_type")
      .eq("id", photoId)
      .eq("gallery_id", galleryId)
      .maybeSingle();
    if (photoError || !photo) {
      throw new Error("Photo not found");
    }

    const { data: signed, error: signedError } = await adminClient.storage
      .from("client-photos")
      .createSignedUrl(photo.file_url, 3600);
    if (signedError || !signed?.signedUrl) {
      throw new Error("Failed to sign URL");
    }
    const cdnBase = Deno.env.get("STORAGE_CDN_BASE_URL") ?? "";
    const signedUrl = (() => {
      if (!cdnBase) return signed.signedUrl;
      const parsed = new URL(signed.signedUrl);
      const base = cdnBase.endsWith("/") ? cdnBase.slice(0, -1) : cdnBase;
      return `${base}${parsed.pathname}${parsed.search}`;
    })();

    await adminClient.rpc("emit_event", {
      p_event_name: "PHOTO_DOWNLOAD",
      p_payload: { gallery_id: galleryId, photo_id: photoId },
      p_gallery_id: galleryId,
      p_client_id: gallery.client_id,
      p_admin_id: null,
    });

    return new Response(
      JSON.stringify({
        signed_url: signedUrl,
        file_name: photo.file_name,
        file_size: photo.file_size,
        mime_type: photo.mime_type,
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
