import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Storage Consistency Checker - runs every 10 minutes via cron
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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get all galleries with completed uploads
    const { data: galleries, error: galleriesError } = await adminClient
      .from("galleries")
      .select("id, name, status, photo_count")
      .eq("status", "active");

    if (galleriesError) {
      throw new Error(`Failed to fetch galleries: ${galleriesError.message}`);
    }

    const consistencyReport = [];
    let totalIssues = 0;

    for (const gallery of galleries || []) {
      try {
        // Count photos in database
        const { count: dbPhotoCount, error: dbCountError } = await adminClient
          .from("gallery_photos")
          .select("*", { count: 'exact', head: true })
          .eq("gallery_id", gallery.id);

        if (dbCountError) {
          consistencyReport.push({
            gallery_id: gallery.id,
            gallery_name: gallery.name,
            issue: "database_count_error",
            db_count: null,
            storage_count: null,
            message: dbCountError.message
          });
          totalIssues++;
          continue;
        }

        // Count files in storage
        const storagePath = `galleries/${gallery.id}/`;
        const storageBucket = adminClient.storage.from("client-photos");

        // List all files in gallery storage path
        const { data: storageFiles, error: storageError } = await storageBucket
          .list(storagePath, { limit: 1000 });

        const storagePhotoCount = (storageFiles || []).filter(file =>
          !file.name.includes('/thumbnail/') &&
          !file.name.includes('/medium/') &&
          !file.name.includes('/watermarked/')
        ).length;

        // Check consistency
        const isConsistent = dbPhotoCount === storagePhotoCount;

        if (!isConsistent) {
          consistencyReport.push({
            gallery_id: gallery.id,
            gallery_name: gallery.name,
            issue: "count_mismatch",
            db_count: dbPhotoCount,
            storage_count: storagePhotoCount,
            message: `DB: ${dbPhotoCount}, Storage: ${storagePhotoCount}`
          });
          totalIssues++;

          // Auto-repair if storage has more files than DB (orphaned files)
          if (storagePhotoCount > dbPhotoCount) {
            await repairOrphanedFiles(adminClient, gallery.id, storageFiles || []);
          }
        } else {
          consistencyReport.push({
            gallery_id: gallery.id,
            gallery_name: gallery.name,
            issue: "consistent",
            db_count: dbPhotoCount,
            storage_count: storagePhotoCount,
            message: "Storage and database counts match"
          });
        }

      } catch (error) {
        consistencyReport.push({
          gallery_id: gallery.id,
          gallery_name: gallery.name,
          issue: "check_error",
          db_count: null,
          storage_count: null,
          message: error.message
        });
        totalIssues++;
      }
    }

    // Log the consistency check results
    await adminClient.from("system_logs").insert({
      event_type: "storage_consistency_check",
      details: {
        total_galleries: galleries?.length || 0,
        total_issues: totalIssues,
        report: consistencyReport
      },
      created_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        checked_at: new Date().toISOString(),
        total_galleries: galleries?.length || 0,
        total_issues: totalIssues,
        report: consistencyReport
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('admin_storage_consistency_check error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function repairOrphanedFiles(adminClient: any, galleryId: string, storageFiles: any[]) {
  try {
    // Get all photos currently in database for this gallery
    const { data: dbPhotos, error: dbError } = await adminClient
      .from("gallery_photos")
      .select("storage_path")
      .eq("gallery_id", galleryId);

    if (dbError) {
      console.error('Failed to get DB photos for repair:', dbError);
      return;
    }

    const dbPaths = new Set((dbPhotos || []).map(p => p.storage_path));

    // Find orphaned files (in storage but not in DB)
    const orphanedFiles = storageFiles.filter(file => {
      const fullPath = `galleries/${galleryId}/${file.name}`;
      return !dbPaths.has(fullPath);
    });

    if (orphanedFiles.length > 0) {
      // Create database records for orphaned files
      const orphanedRecords = orphanedFiles.map(file => ({
        gallery_id: galleryId,
        file_name: file.name,
        storage_path: `galleries/${galleryId}/${file.name}`,
        file_size: file.metadata?.size || 0,
        mime_type: getMimeTypeFromFilename(file.name),
        uploaded_by: 'system', // System repair
        checksum: null
      }));

      const { error: insertError } = await adminClient
        .from("gallery_photos")
        .insert(orphanedRecords);

      if (insertError) {
        console.error('Failed to repair orphaned files:', insertError);
      } else {
        console.log(`Repaired ${orphanedFiles.length} orphaned files for gallery ${galleryId}`);

        // Log the repair
        await adminClient.from("system_logs").insert({
          event_type: "storage_repair",
          details: {
            gallery_id: galleryId,
            repaired_files: orphanedFiles.length,
            file_names: orphanedFiles.map(f => f.name)
          },
          created_at: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('Error repairing orphaned files:', error);
  }
}

function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime'
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
