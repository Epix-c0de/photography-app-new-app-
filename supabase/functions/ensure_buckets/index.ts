/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EnsureBucketsBody = {
  buckets?: string[];
  public?: boolean;
};

type Bucket = {
  id: string;
  name: string;
  owner: string;
  created_at: string;
  updated_at: string;
  public: boolean;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const body: EnsureBucketsBody = await req.json().catch(() => ({}));
    const required = body.buckets && body.buckets.length > 0
      ? body.buckets
      : ['client-photos', 'photos-clean', 'photos-watermarked', 'thumbnails', 'media', 'avatars'];
    const makePublic = !!body.public;

    const { data: existing } = await supabaseAdmin.storage.listBuckets();
    const existingIds = new Set((existing ?? []).map((b: Bucket) => b.id));

    const created: string[] = [];
    const already: string[] = [];
    for (const b of required) {
      if (existingIds.has(b)) {
        already.push(b);
        continue;
      }
      const { error } = await supabaseAdmin.storage.createBucket(b, {
        public: makePublic
      });
      if (!error) created.push(b);
    }

    // Update bucket configurations with larger limits
    const bucketConfigs = [
      { name: "client-photos", file_size_limit: 500 * 1024 * 1024 }, // 500MB
      { name: "bts-media", file_size_limit: 500 * 1024 * 1024 }, // 500MB
      { name: "thumbnails", file_size_limit: 10 * 1024 * 1024 }, // 10MB
      { name: "temp-uploads", file_size_limit: 500 * 1024 * 1024 }, // 500MB
    ];

    for (const config of bucketConfigs) {
      const { error } = await supabaseAdmin.storage.updateBucket(config.name, {
        file_size_limit: config.file_size_limit,
      });
      if (error) {
        console.error(`Error updating bucket ${config.name}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({ created, already }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
    });
  }
});
