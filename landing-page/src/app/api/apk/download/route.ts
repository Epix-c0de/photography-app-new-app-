import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (type && type !== 'admin' && type !== 'client') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let apk;
    if (id) {
      const { data } = await supabase
        .from('apk_versions')
        .select('*')
        .eq('id', id)
        .single();
      apk = data;
    } else {
      const { data } = await supabase
        .from('apk_versions')
        .select('*')
        .eq('type', type || 'client')
        .eq('is_latest', true)
        .single();
      apk = data;
    }

    if (!apk) {
      return NextResponse.json({ error: 'APK not found' }, { status: 404 });
    }

    const chunkCount = (apk as any).chunk_count || 1;

    if (chunkCount <= 1) {
      const { data: signedUrl } = supabase.storage
        .from('apk-files')
        .getPublicUrl((apk as any).storage_path);

      return NextResponse.redirect(signedUrl.publicUrl);
    }

    // Chunked APK — fetch all chunks and stream as one response
    const chunkUrls: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkPath = `${(apk as any).storage_path}/chunk-${String(i).padStart(4, '0')}`;
      const { data: signedUrlData, error } = await supabase.storage
        .from('apk-files')
        .createSignedUrl(chunkPath, 3600);

      if (error || !signedUrlData?.signedUrl) {
        return NextResponse.json({ error: `Chunk ${i} not available` }, { status: 500 });
      }
      chunkUrls.push(signedUrlData.signedUrl);
    }

    const encoder = new TextEncoder();
    const filename = (apk as any).filename || `epix-client-v${(apk as any).version}.apk`;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const url of chunkUrls) {
            const res = await fetch(url);
            if (!res.ok || !res.body) {
              controller.error(new Error(`Failed to fetch chunk: ${res.status}`));
              return;
            }
            const reader = res.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
