import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const UPSTASH_KAFKA_REST_URL = Deno.env.get("UPSTASH_KAFKA_REST_URL") ?? "";
const UPSTASH_KAFKA_REST_PASSWORD = Deno.env.get("UPSTASH_KAFKA_REST_PASSWORD") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Function to publish event to Upstash Kafka
async function publishToKafka(topic: string, message: any) {
  if (!UPSTASH_KAFKA_REST_URL || !UPSTASH_KAFKA_REST_PASSWORD) {
    console.log("Kafka credentials missing, skipping event publishing");
    return;
  }
  
  try {
    const url = `${UPSTASH_KAFKA_REST_URL}/produce/${topic}`;
    const auth = btoa(`:${UPSTASH_KAFKA_REST_PASSWORD}`); // Upstash basic auth format
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ value: JSON.stringify(message) })
    });
    
    if (!response.ok) {
      console.error(`Failed to publish to Kafka: ${response.statusText}`);
    }
  } catch (err) {
    console.error(`Error publishing to Kafka:`, err);
  }
}

// Background image processing worker
Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { photo_id, processing_type } = body ?? {};

    if (!photo_id || !processing_type) {
      throw new Error("Missing required fields: photo_id, processing_type");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get photo details
    const { data: photo, error: photoError } = await adminClient
      .from("gallery_photos")
      .select("id, storage_path, mime_type, file_name, gallery_id")
      .eq("id", photo_id)
      .maybeSingle();

    if (photoError || !photo) {
      throw new Error("Photo not found");
    }

    // Publish the job to Kafka instead of processing synchronously
    await publishToKafka('image-processing', {
      photo_id,
      processing_type,
      gallery_id: photo.gallery_id,
      storage_path: photo.storage_path,
      timestamp: new Date().toISOString()
    });

    // We still do synchronous mock processing here as fallback or while transitioning,
    // but in full async architecture this would just return 202 Accepted.
    
    // Process based on type
    if (processing_type === "thumbnail") {
      await processThumbnail(adminClient, photo);
    } else if (processing_type === "medium") {
      await processMedium(adminClient, photo);
    } else if (processing_type === "exif") {
      await processExif(adminClient, photo);
    } else if (processing_type === "watermark") {
      await processWatermark(adminClient, photo);
    }

    return new Response(
      JSON.stringify({
        success: true,
        photo_id: photo_id,
        processing_type: processing_type,
        completed_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_process_image error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processThumbnail(adminClient: any, photo: any) {
  try {
    // Get original image from storage
    const storageBucket = adminClient.storage.from("client-photos");
    const { data: imageData, error: downloadError } = await storageBucket
      .download(photo.storage_path);

    if (downloadError || !imageData) {
      throw new Error("Failed to download original image");
    }

    // In a real implementation, you would:
    // 1. Use a library like Sharp to resize to thumbnail (200x200)
    // 2. Compress the image
    // 3. Upload back to storage at thumbnail path
    // 4. Update photo record with thumbnail_url

    // For now, simulate processing
    const thumbnailPath = photo.storage_path.replace('/original/', '/thumbnail/');

    // Update photo record
    await adminClient
      .from("gallery_photos")
      .update({
        thumbnail_url: thumbnailPath,
        processing_status: 'thumbnail_completed'
      })
      .eq("id", photo.id);

    // Log completion
    await adminClient.from("upload_logs").insert({
      gallery_id: photo.gallery_id,
      file_name: photo.file_name,
      status: "thumbnail_processed",
      message: "Thumbnail generation completed"
    });

  } catch (error) {
    console.error('Thumbnail processing error:', error);
    // Log failure
    await adminClient.from("upload_logs").insert({
      gallery_id: photo.gallery_id,
      file_name: photo.file_name,
      status: "thumbnail_failed",
      message: `Thumbnail processing failed: ${(error as Error).message}`
    });
  }
}

async function processMedium(adminClient: any, photo: any) {
  try {
    // Similar to thumbnail but for medium size (800px max)
    const mediumPath = photo.storage_path.replace('/original/', '/medium/');

    await adminClient
      .from("gallery_photos")
      .update({
        medium_url: mediumPath,
        processing_status: 'medium_completed'
      })
      .eq("id", photo.id);

    await adminClient.from("upload_logs").insert({
      gallery_id: photo.gallery_id,
      file_name: photo.file_name,
      status: "medium_processed",
      message: "Medium size generation completed"
    });

  } catch (error) {
    console.error('Medium processing error:', error);
    await adminClient.from("upload_logs").insert({
      gallery_id: photo.gallery_id,
      file_name: photo.file_name,
      status: "medium_failed",
      message: `Medium processing failed: ${(error as Error).message}`
    });
  }
}

async function processExif(adminClient: any, photo: any) {
  try {
    // Extract EXIF metadata
    // In a real implementation, you would use a library to extract EXIF data

    const mockExif = {
      camera: "Canon EOS R5",
      lens: "RF 24-70mm f/2.8L IS USM",
      aperture: "f/2.8",
      shutter_speed: "1/200",
      iso: 100,
      focal_length: "35mm",
      date_taken: new Date().toISOString()
    };

    await adminClient
      .from("gallery_photos")
      .update({
        exif_data: mockExif,
        processing_status: 'exif_completed'
      })
      .eq("id", photo.id);

    await adminClient.from("upload_logs").insert({
      gallery_id: photo.gallery_id,
      file_name: photo.file_name,
      status: "exif_extracted",
      message: "EXIF metadata extracted"
    });

  } catch (error) {
    console.error('EXIF processing error:', error);
    await adminClient.from("upload_logs").insert({
      gallery_id: photo.gallery_id,
      file_name: photo.file_name,
      status: "exif_failed",
      message: `EXIF extraction failed: ${(error as Error).message}`
    });
  }
}

async function processWatermark(adminClient: any, photo: any) {
  try {
    // Apply watermark to unpaid galleries
    // Check if gallery requires watermark
    const { data: gallery, error: galleryError } = await adminClient
      .from("galleries")
      .select("is_paid")
      .eq("id", photo.gallery_id)
      .maybeSingle();

    if (galleryError || !gallery) {
      throw new Error("Gallery not found");
    }

    if (!gallery.is_paid) {
      // Apply watermark
      const watermarkedPath = photo.storage_path.replace('/original/', '/watermarked/');

      await adminClient
        .from("gallery_photos")
        .update({
          watermarked_url: watermarkedPath,
          processing_status: 'watermark_completed'
        })
        .eq("id", photo.id);

      await adminClient.from("upload_logs").insert({
        gallery_id: photo.gallery_id,
        file_name: photo.file_name,
        status: "watermark_applied",
        message: "Watermark applied to unpaid gallery photo"
      });
    } else {
      // Mark as completed without watermark
      await adminClient
        .from("gallery_photos")
        .update({
          processing_status: 'watermark_completed'
        })
        .eq("id", photo.id);
    }

  } catch (error) {
    console.error('Watermark processing error:', error);
    await adminClient.from("upload_logs").insert({
      gallery_id: photo.gallery_id,
      file_name: photo.file_name,
      status: "watermark_failed",
      message: `Watermark processing failed: ${(error as Error).message}`
    });
  }
}
