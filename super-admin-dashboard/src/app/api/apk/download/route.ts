import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabase(token?: string) {
  if (token) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

function getServiceSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type && !id) {
      return NextResponse.json({ error: 'Missing type or id parameter' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    let apkRecord;
    if (id) {
      const { data } = await supabase.from('apk_versions').select('*').eq('id', id).single();
      apkRecord = data;
    } else {
      const { data } = await supabase.from('apk_versions').select('*').eq('type', type).eq('is_latest', true).single();
      apkRecord = data;
    }

    if (!apkRecord) {
      return NextResponse.json({ error: 'APK not found' }, { status: 404 });
    }

    const chunkCount = (apkRecord as any).chunk_count || 1;

    if (chunkCount <= 1) {
      const { data: signedUrl, error: signError } = await supabase.storage
        .from('apk-files')
        .createSignedUrl((apkRecord as any).storage_path, 3600);

      if (signError) {
        return NextResponse.json({ error: signError.message }, { status: 500 });
      }

      return NextResponse.json({
        download_url: signedUrl.signedUrl,
        version: (apkRecord as any).version,
        filename: (apkRecord as any).filename,
        file_size: (apkRecord as any).file_size,
        type: (apkRecord as any).type,
        chunked: false,
      });
    }

    const chunkUrls: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkPath = `${(apkRecord as any).storage_path}/chunk-${String(i).padStart(4, '0')}`;
      const { data: signedUrl, error: signError } = await supabase.storage
        .from('apk-files')
        .createSignedUrl(chunkPath, 3600);

      if (signError) {
        return NextResponse.json({ error: `Failed to sign chunk ${i}: ${signError.message}` }, { status: 500 });
      }
      chunkUrls.push(signedUrl.signedUrl);
    }

    return NextResponse.json({
      download_url: chunkUrls[0],
      chunk_urls: chunkUrls,
      chunked: true,
      chunk_count: chunkCount,
      version: (apkRecord as any).version,
      filename: (apkRecord as any).filename,
      file_size: (apkRecord as any).file_size,
      type: (apkRecord as any).type,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
