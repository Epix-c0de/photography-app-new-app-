/// <reference lib="deno.ns" />
import { createClient } from "@supabase/supabase-js";

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

Deno.serve(async (req: Request) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const body: EnsureBucketsBody = await req.json().catch(() => ({}));
    const required = body.buckets && body.buckets.length > 0
      ? body.buckets
      : ['photos-clean', 'photos-watermarked', 'thumbnails'];
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

    return new Response(
      JSON.stringify({ created, already }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
