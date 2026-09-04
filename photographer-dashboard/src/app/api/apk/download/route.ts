import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type && !id) {
      return NextResponse.json({ error: 'Missing type or id parameter' }, { status: 400 });
    }

    const supabase = createServiceClient();

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

    const filePath = `${apkRecord.storage_path}/chunk-0000`;
    const { data: signedUrlData, error } = await supabase.storage
      .from('apk-files')
      .createSignedUrl(filePath, 3600);

    if (error || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: error?.message || 'Failed to generate URL' }, { status: 500 });
    }

    return NextResponse.json({
      download_url: signedUrlData.signedUrl,
      version: apkRecord.version,
      filename: apkRecord.filename,
      file_size: apkRecord.file_size,
      type: apkRecord.type,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
