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

    const { data: signedUrl, error: signError } = await supabase.storage
      .from('apk-files')
      .createSignedUrl(apkRecord.storage_path, 3600);

    if (signError) {
      return NextResponse.json({ error: signError.message }, { status: 500 });
    }

    return NextResponse.json({
      download_url: signedUrl.signedUrl,
      version: apkRecord.version,
      filename: apkRecord.filename,
      file_size: apkRecord.file_size,
      type: apkRecord.type,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
