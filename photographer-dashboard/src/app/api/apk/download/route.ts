import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type && !id) {
      return NextResponse.json({ error: 'Missing type or id parameter' }, { status: 400 });
    }

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

    const { data: urlData } = supabase.storage
      .from('apk-files')
      .getPublicUrl(apkRecord.storage_path);

    return NextResponse.json({
      download_url: urlData.publicUrl,
      version: apkRecord.version,
      filename: apkRecord.filename,
      file_size: apkRecord.file_size,
      type: apkRecord.type,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
