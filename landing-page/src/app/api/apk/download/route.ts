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
    const action = searchParams.get('action'); // 'metadata' or 'stream'

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
    const filename = (apk as any).filename || `epix-${(apk as any).type}-v${(apk as any).version}.apk`;

    // ── Metadata mode: return JSON with chunk info ──
    if (action === 'metadata') {
      if (chunkCount <= 1) {
        const filePath = `${(apk as any).storage_path}/chunk-0000`;
        const { data: signedUrlData, error } = await supabase.storage
          .from('apk-files')
          .createSignedUrl(filePath, 3600);

        if (error || !signedUrlData?.signedUrl) {
          return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
        }

        return NextResponse.json({
          chunked: false,
          download_url: signedUrlData.signedUrl,
          version: (apk as any).version,
          filename,
          file_size: (apk as any).file_size || 0,
          type: (apk as any).type,
          changelog: (apk as any).changelog || null,
        });
      }

      // Chunked — return chunk signed URLs
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

      return NextResponse.json({
        chunked: true,
        chunk_urls: chunkUrls,
        chunk_count: chunkCount,
        version: (apk as any).version,
        filename,
        file_size: (apk as any).file_size || 0,
        type: (apk as any).type,
        changelog: (apk as any).changelog || null,
      });
    }

    // ── Stream mode: fetch chunks and stream as single binary ──
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
